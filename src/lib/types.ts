export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Profile {
  id: string
  email: string
  name: string
  avatar_url: string | null
  created_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  created_at: string
  created_by: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  joined_at: string
  profile?: Profile
}

export interface Project {
  id: string
  org_id: string
  name: string
  description: string | null
  status: 'planning' | 'active' | 'paused' | 'completed'
  photo_url: string | null
  created_at: string
  updated_at: string
  created_by: string
  due_date: string | null
  phases?: ProjectPhase[]
  tasks?: ProjectTask[]
}

export interface ProjectPhase {
  id: string
  project_id: string
  name: string
  order: number
  created_at: string
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface ProjectTask {
  id: string
  project_id: string
  phase_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee_id: string | null
  created_by: string
  due_date: string | null
  order: number
  estimated_hours: number | null
  created_at: string
  updated_at: string
  assignee?: Profile
  subtasks?: SubTask[]
  comments?: TaskComment[]
}

export interface SubTask {
  id: string
  task_id: string
  title: string
  completed: boolean
  created_at: string
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
  profile?: Profile
}

export interface Invite {
  id: string
  org_id: string
  email: string
  role: OrgRole
  token: string
  accepted: boolean
  created_at: string
  expires_at: string
}

export interface SubscriptionPlan {
  id: string
  name: 'Free' | 'Pro' | 'Team' | 'Enterprise'
  price: number
  max_projects: number
  max_members: number
  ai_enabled: boolean
}

export interface OrgSubscription {
  id: string
  org_id: string
  plan_id: string
  paddle_subscription_id: string | null
  status: 'active' | 'past_due' | 'cancelled' | 'trialing'
  current_period_start: string
  current_period_end: string
  created_at: string
}

export interface AiPrediction {
  id: string
  project_id: string
  type: 'risk' | 'bottleneck' | 'overdue' | 'workload'
  severity: 'low' | 'medium' | 'high'
  message: string
  details: Record<string, unknown>
  created_at: string
}

export interface AppNotification {
  id: string
  user_id: string
  org_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'completion'
  link: string | null
  read: boolean
  created_at: string
}

export interface ActivityLog {
  id: string
  org_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}
