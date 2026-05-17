import { createClient } from '@/lib/supabase/client'

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

export async function createNotification(params: {
  userId: string
  orgId: string
  title: string
  message: string
  type?: AppNotification['type']
  link?: string
}) {
  const supabase = createClient()
  await supabase.from('notifications').insert({
    user_id: params.userId,
    org_id: params.orgId,
    title: params.title,
    message: params.message,
    type: params.type || 'info',
    link: params.link || null,
  })
}

export async function notifyTaskCompleted(
  taskId: string,
  taskTitle: string,
  projectId: string,
  completedByUserId: string,
  orgId: string,
  memberIds: string[],
) {
  const supabase = createClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', memberIds.filter(id => id !== completedByUserId))

  if (!profiles?.length) return

  const { data: completer } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', completedByUserId)
    .single()

  const completerName = completer?.name || 'Someone'

  for (const member of profiles) {
    await supabase.from('notifications').insert({
      user_id: member.id,
      org_id: orgId,
      title: 'Task completed',
      message: `${completerName} completed "${taskTitle}"`,
      type: 'completion',
      link: `/projects/${projectId}`,
    })
  }
}
