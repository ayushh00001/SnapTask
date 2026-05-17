-- SnapTask Database Schema
-- Run this in Supabase SQL Editor

-- 1. Profiles table (syncs with auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Org members can view each other's profiles"
  ON profiles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members om1
      WHERE om1.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM org_members om2
        WHERE om2.org_id = om1.org_id AND om2.user_id = profiles.id
      )
    )
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_members.org_id = is_org_member.org_id AND org_members.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_members.org_id = is_org_admin.org_id AND org_members.user_id = auth.uid() AND org_members.role IN ('owner', 'admin'));
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_members.org_id = is_org_owner.org_id AND org_members.user_id = auth.uid() AND org_members.role = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.org_members om ON om.org_id = p.org_id
    WHERE p.id = can_access_project.project_id AND om.user_id = auth.uid()
  );
$$;

CREATE POLICY "Members can view their org"
  ON organizations FOR SELECT USING (public.is_org_member(id));

CREATE POLICY "Owners can update their org"
  ON organizations FOR UPDATE USING (public.is_org_owner(id));

-- 3. Org members
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org members"
  ON org_members FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "Admins can invite members"
  ON org_members FOR INSERT WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Owners can update org members"
  ON org_members FOR UPDATE USING (public.is_org_owner(org_id));

CREATE POLICY "Owners can remove org members"
  ON org_members FOR DELETE USING (public.is_org_owner(org_id));

-- Auto-create org when first user signs up
CREATE OR REPLACE FUNCTION handle_first_org()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (NEW.name || '''s Org', lower(replace(NEW.name, ' ', '-')) || '-' || substr(NEW.id::text, 1, 8), NEW.id)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.org_members (org_id, user_id, role)
  SELECT id, NEW.id, 'owner' FROM public.organizations WHERE created_by = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_first_org();

-- 4. Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'paused', 'completed')),
  photo_url TEXT,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view projects"
  ON projects FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "Members can create projects"
  ON projects FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "Members can update projects"
  ON projects FOR UPDATE USING (public.is_org_member(org_id));

CREATE POLICY "Members can delete projects"
  ON projects FOR DELETE USING (public.is_org_admin(org_id));

-- 5. Project phases
CREATE TABLE IF NOT EXISTS project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  "order" INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view phases"
  ON project_phases FOR SELECT USING (public.can_access_project(project_id));

CREATE POLICY "Members can manage phases"
  ON project_phases FOR INSERT WITH CHECK (public.can_access_project(project_id));

CREATE POLICY "Members can update phases"
  ON project_phases FOR UPDATE USING (public.can_access_project(project_id));

CREATE POLICY "Members can delete phases"
  ON project_phases FOR DELETE USING (public.can_access_project(project_id));

-- 6. Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  due_date TIMESTAMPTZ,
  "order" INT DEFAULT 0,
  estimated_hours NUMERIC(5,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tasks"
  ON tasks FOR SELECT USING (public.can_access_project(project_id));

CREATE POLICY "Members can create tasks"
  ON tasks FOR INSERT WITH CHECK (public.can_access_project(project_id));

CREATE POLICY "Members can update tasks"
  ON tasks FOR UPDATE USING (public.can_access_project(project_id));

CREATE POLICY "Members can delete tasks"
  ON tasks FOR DELETE USING (public.can_access_project(project_id));

-- 7. Subtasks
CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage subtasks" ON subtasks FOR ALL USING (
  EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND public.can_access_project(tasks.project_id))
);

-- 8. Task comments
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage comments" ON task_comments FOR ALL USING (
  EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_comments.task_id AND public.can_access_project(tasks.project_id))
);

-- 9. Invites
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage invites" ON invites FOR ALL USING (public.is_org_admin(org_id));

-- 10. AI predictions
CREATE TABLE IF NOT EXISTS ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('risk', 'bottleneck', 'overdue', 'workload')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view predictions" ON ai_predictions FOR SELECT USING (public.can_access_project(project_id));
CREATE POLICY "Members can create predictions" ON ai_predictions FOR INSERT WITH CHECK (public.can_access_project(project_id));

-- 11. Subscriptions
CREATE TABLE IF NOT EXISTS org_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
  plan_id TEXT DEFAULT 'free',
  paddle_subscription_id TEXT UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view subscription" ON org_subscriptions FOR SELECT USING (public.is_org_member(org_id));

-- 12. Activity log
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view activity logs" ON activity_logs FOR SELECT USING (public.is_org_member(org_id));

-- 13. Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join waitlist" ON waitlist FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_project ON ai_predictions(project_id);
