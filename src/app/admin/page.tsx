'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateShort } from '@/lib/utils'

interface DbStats {
  total_users: number
  total_orgs: number
  total_projects: number
  total_tasks: number
  total_invites: number
  waitlist_count: number
  tasks_by_status: { status: string; count: number }[]
  recent_signups: { email: string; name: string; created_at: string }[]
  recent_orgs: { name: string; created_at: string }[]
}

export default function AdminPage() {
  const [stats, setStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [usersRes, orgsRes, projectsRes, tasksRes, invitesRes, waitlistRes] = await Promise.all([
        supabase.from('profiles').select('*').limit(50),
        supabase.from('organizations').select('*').limit(50),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('status'),
        supabase.from('invites').select('id', { count: 'exact', head: true }),
        supabase.from('waitlist').select('id', { count: 'exact', head: true }),
      ])

      const tasksByStatus: Record<string, number> = {}
      ;(tasksRes.data || []).forEach(t => {
        tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1
      })

      setStats({
        total_users: usersRes.data?.length || 0,
        total_orgs: orgsRes.data?.length || 0,
        total_projects: projectsRes.count || 0,
        total_tasks: (tasksRes.data || []).length,
        total_invites: invitesRes.count || 0,
        waitlist_count: waitlistRes.count || 0,
        tasks_by_status: Object.entries(tasksByStatus).map(([status, count]) => ({ status, count })),
        recent_signups: (usersRes.data || []).slice(0, 10).map(u => ({ email: u.email, name: u.name, created_at: u.created_at })),
        recent_orgs: (orgsRes.data || []).slice(0, 10).map(o => ({ name: o.name, created_at: o.created_at })),
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  )
  if (!stats) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">System overview and analytics</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{stats.total_users}</p><p className="text-xs text-gray-500">Users</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{stats.total_orgs}</p><p className="text-xs text-gray-500">Organizations</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{stats.total_projects}</p><p className="text-xs text-gray-500">Projects</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{stats.total_tasks}</p><p className="text-xs text-gray-500">Tasks</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{stats.total_invites}</p><p className="text-xs text-gray-500">Invites sent</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-gray-900">{stats.waitlist_count}</p><p className="text-xs text-gray-500">Waitlist</p></CardContent></Card>
      </div>

      {stats.tasks_by_status.length > 0 && (
        <Card>
          <CardHeader><h2 className="font-semibold text-gray-900">Tasks by status</h2></CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {stats.tasks_by_status.map(s => (
                <Badge key={s.status} color={
                  s.status === 'done' ? 'green' : s.status === 'in_progress' ? 'blue' :
                  s.status === 'review' ? 'purple' : s.status === 'todo' ? 'amber' : 'gray'
                }>
                  {s.status}: {s.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><h2 className="font-semibold text-gray-900">Recent signups</h2></CardHeader>
          <CardContent>
            {stats.recent_signups.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No users yet — deploy the app!</p>
            ) : (
              <div className="space-y-2">
                {stats.recent_signups.map(u => (
                  <div key={u.email} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <p className="text-xs text-gray-400">{formatDateShort(u.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold text-gray-900">Organizations</h2></CardHeader>
          <CardContent>
            {stats.recent_orgs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No organizations yet</p>
            ) : (
              <div className="space-y-2">
                {stats.recent_orgs.map(o => (
                  <div key={o.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{o.name}</p>
                    <p className="text-xs text-gray-400">{formatDateShort(o.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
