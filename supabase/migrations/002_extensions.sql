-- Storage bucket for project photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-photos', 'project-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Project photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-photos');

CREATE POLICY "Project photos authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Project photos owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT org_members.org_id::text FROM org_members WHERE org_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Project photos owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT org_members.org_id::text FROM org_members WHERE org_members.user_id = auth.uid()
    )
  );

-- Milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Milestones project access" ON milestones
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()))
  );

-- Task dependencies
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depends_on UUID[] NOT NULL DEFAULT '{}';

-- Time tracking
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  description TEXT,
  billable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Time entries task access" ON time_entries
  FOR ALL USING (
    task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())))
  );

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date TIMESTAMPTZ,
  issued_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_date TIMESTAMPTZ,
  notes TEXT,
  line_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invoices org access" ON invoices
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- Ship log for One-Tap Ship Mode
CREATE TABLE IF NOT EXISTS ship_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shipped_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  total_tasks INTEGER NOT NULL DEFAULT 0,
  timeline_days INTEGER,
  insights JSONB DEFAULT '{}',
  retrospective TEXT
);

ALTER TABLE ship_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ship logs project access" ON ship_logs
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()))
  );

-- Project templates
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom' CHECK (category IN ('website', 'app', 'mobile', 'marketing', 'custom')),
  phases JSONB NOT NULL DEFAULT '[]',
  tasks JSONB NOT NULL DEFAULT '[]',
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates org read" ON project_templates FOR SELECT USING (
  org_id IS NULL OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
CREATE POLICY "Templates org insert" ON project_templates FOR INSERT WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
CREATE POLICY "Templates org delete" ON project_templates FOR DELETE USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Push subs self" ON push_subscriptions FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_ship_logs_project ON ship_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_templates_org ON project_templates(org_id);
