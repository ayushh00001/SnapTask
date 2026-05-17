'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatDateShort, getInitials } from '@/lib/utils'
import type { ActivityLog, Profile } from '@/lib/types'

const actionIcons: Record<string, string> = {
  create_project: 'M12 4v16m8-8H4',
  update_project: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  create_task: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
  update_task: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  complete_task: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  invite_member: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
}

const actionColors: Record<string, string> = {
  create_project: 'bg-notion-blue',
  update_project: 'bg-notion-orange',
  create_task: 'bg-notion-accent',
  update_task: 'bg-notion-purple',
  complete_task: 'bg-notion-green',
  invite_member: 'bg-[#6940a5]',
}

export function ActivityFeed({ orgId, limit = 10 }: { orgId?: string; limit?: number }) {
  const [activities, setActivities] = useState<(ActivityLog & { profile?: Profile })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    const supabase = createClient()
    supabase
      .from('activity_logs')
      .select('*, profile:user_id(id, email, name, avatar_url, created_at)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data }) => {
        setActivities(data || [])
        setLoading(false)
      })
  }, [orgId, limit])

  if (loading) return null
  if (activities.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-notion-bg-secondary flex items-center justify-center">
            <svg className="w-3 h-3 text-notion-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-notion-text">Activity</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {activities.map(a => (
          <div key={a.id} className="flex items-start gap-3 py-2.5">
            <div className={`w-6 h-6 ${actionColors[a.action] || 'bg-notion-gray'} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={actionIcons[a.action] || 'M13 10V3L4 14h7v7l9-11h-7z'} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-notion-text">
                <span className="font-medium">{a.profile?.name || 'Someone'}</span>{' '}
                {a.action.replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-notion-text-muted mt-0.5">{formatDateShort(a.created_at)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export async function logActivity(
  orgId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  const supabase = createClient()
  await supabase.from('activity_logs').insert({
    org_id: orgId, user_id: userId, action, entity_type: entityType, entity_id: entityId, metadata,
  })
}
