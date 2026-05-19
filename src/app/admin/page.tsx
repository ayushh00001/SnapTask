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

interface InvoiceData {
  total_invoiced: number
  total_paid: number
  total_overdue: number
  invoices_by_status: { status: string; count: number; total: number }[]
  recent_invoices: { invoice_number: string; client_name: string; amount: number; status: string; created_at: string }[]
}

interface TimeData {
  total_hours_logged: number
  billable_hours: number
  hours_by_user: { name: string; hours: number }[]
}

interface ProjectRevenue {
  name: string
  hours_logged: number
  invoices_total: number
  effective_rate: number
}

export default function AdminPage() {
  const [stats, setStats] = useState<DbStats | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [timeData, setTimeData] = useState<TimeData | null>(null)
  const [projectRevenues, setProjectRevenues] = useState<ProjectRevenue[]>([])
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

      // Invoice data
      const { data: invoices } = await supabase.from('invoices').select('*')
      const invByStatus: Record<string, { count: number; total: number }> = {}
      let totalInvoiced = 0, totalPaid = 0, totalOverdue = 0
      ;(invoices || []).forEach(inv => {
        if (!invByStatus[inv.status]) invByStatus[inv.status] = { count: 0, total: 0 }
        invByStatus[inv.status].count++
        invByStatus[inv.status].total += Number(inv.amount)
        totalInvoiced += Number(inv.amount)
        if (inv.status === 'paid') totalPaid += Number(inv.amount)
        if (inv.status === 'overdue') totalOverdue += Number(inv.amount)
      })

      // Time tracking data
      const { data: timeEntries } = await supabase.from('time_entries').select('*, tasks!inner(project_id)')
      const totalMin = (timeEntries || []).reduce((s, e) => s + (e.duration_minutes || 0), 0)

      const { data: profiles } = await supabase.from('profiles').select('id, name')
      const hoursByUser: Record<string, number> = {}
      ;(timeEntries || []).forEach(e => {
        if (!hoursByUser[e.user_id]) hoursByUser[e.user_id] = 0
        hoursByUser[e.user_id] += (e.duration_minutes || 0)
      })

      const { data: projects } = await supabase.from('projects').select('id, name')

      // Project revenue calc (hours * estimated rate from invoices)
      const projRev: ProjectRevenue[] = []
      if (projects) {
        for (const p of projects) {
          const projInvoices = (invoices || []).filter(i => i.project_id === p.id)
          const projTime = (timeEntries || []).filter(e => {
            const task = e as unknown as { tasks: { project_id: string } }
            return task.tasks?.project_id === p.id
          })
          const projHours = projTime.reduce((s, e) => s + (e.duration_minutes || 0), 0) / 60
          const projInvTotal = projInvoices.reduce((s, i) => s + Number(i.amount), 0)
          if (projHours > 0 || projInvTotal > 0) {
            projRev.push({
              name: p.name,
              hours_logged: Math.round(projHours * 10) / 10,
              invoices_total: projInvTotal,
              effective_rate: projHours > 0 ? Math.round(projInvTotal / projHours * 100) / 100 : 0,
            })
          }
        }
      }
      projRev.sort((a, b) => b.invoices_total - a.invoices_total)

      setInvoiceData({
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        total_overdue: totalOverdue,
        invoices_by_status: Object.entries(invByStatus).map(([status, d]) => ({ status, count: d.count, total: d.total })),
        recent_invoices: (invoices || []).slice(0, 10).map(i => ({
          invoice_number: i.invoice_number,
          client_name: i.client_name || 'Unknown',
          amount: Number(i.amount),
          status: i.status,
          created_at: i.created_at,
        })),
      })

      setTimeData({
        total_hours_logged: Math.round(totalMin / 60 * 10) / 10,
        billable_hours: Math.round((timeEntries || []).filter(e => e.billable).reduce((s, e) => s + (e.duration_minutes || 0), 0) / 60 * 10) / 10,
        hours_by_user: Object.entries(hoursByUser).map(([userId, min]) => ({
          name: profiles?.find(p => p.id === userId)?.name || 'Unknown',
          hours: Math.round(min / 60 * 10) / 10,
        })).sort((a, b) => b.hours - a.hours),
      })

      setProjectRevenues(projRev)

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
      <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!stats) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Revenue Intelligence</h1>
        <p className="text-text-secondary text-sm mt-1">Financial overview, profitability, and team productivity</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold text-text-primary">{stats.total_users}</p><p className="text-xs text-text-muted mt-0.5">Users</p></CardContent></Card>
        <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold text-text-primary">{stats.total_orgs}</p><p className="text-xs text-text-muted mt-0.5">Organizations</p></CardContent></Card>
        <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold text-text-primary">{stats.total_projects}</p><p className="text-xs text-text-muted mt-0.5">Projects</p></CardContent></Card>
        <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold text-text-primary">{stats.total_tasks}</p><p className="text-xs text-text-muted mt-0.5">Tasks</p></CardContent></Card>
        <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold text-text-primary">{stats.total_invites}</p><p className="text-xs text-text-muted mt-0.5">Invites</p></CardContent></Card>
        <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold text-text-primary">{stats.waitlist_count}</p><p className="text-xs text-text-muted mt-0.5">Waitlist</p></CardContent></Card>
      </div>

      {invoiceData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-5">
                <p className="text-xs text-text-muted uppercase tracking-wide font-medium">Total Invoiced</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${invoiceData.total_invoiced.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="p-5">
                <p className="text-xs text-text-muted uppercase tracking-wide font-medium">Total Collected</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">${invoiceData.total_paid.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="p-5">
                <p className="text-xs text-text-muted uppercase tracking-wide font-medium">Overdue</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">${invoiceData.total_overdue.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {projectRevenues.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-text-primary">Project Profitability</h2>
                  <Badge color="blue">{projectRevenues.length} projects</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {projectRevenues.map((pr, i) => (
                    <div key={pr.name} className="flex items-center justify-between p-3 bg-surface-muted rounded-xl animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{pr.name}</p>
                        <p className="text-xs text-text-muted">{pr.hours_logged}h logged</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-text-primary">${pr.invoices_total.toLocaleString()}</p>
                        <p className={`text-xs ${pr.effective_rate >= 50 ? 'text-emerald-600' : pr.effective_rate >= 25 ? 'text-amber-600' : 'text-red-600'}`}>
                          ${pr.effective_rate}/hr
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {timeData && timeData.total_hours_logged > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><h2 className="font-semibold text-text-primary">Time Tracking</h2></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-surface-muted rounded-xl text-center">
                  <p className="text-2xl font-bold text-text-primary">{timeData.total_hours_logged}h</p>
                  <p className="text-xs text-text-muted">Total logged</p>
                </div>
                <div className="p-4 bg-surface-muted rounded-xl text-center">
                  <p className="text-2xl font-bold text-brand-600">{timeData.billable_hours}h</p>
                  <p className="text-xs text-text-muted">Billable</p>
                </div>
              </div>
              {timeData.hours_by_user.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-text-muted font-medium mb-2">By team member</p>
                  {timeData.hours_by_user.slice(0, 10).map((u, i) => (
                    <div key={u.name} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-text-primary">{u.name}</span>
                      <span className="text-sm font-medium text-text-secondary">{u.hours}h</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-text-primary">Invoice Status</h2></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {invoiceData?.invoices_by_status.map(s => (
                  <div key={s.status} className="flex items-center justify-between p-3 bg-surface-muted rounded-xl">
                    <Badge color={
                      s.status === 'paid' ? 'green' : s.status === 'sent' ? 'blue' :
                      s.status === 'overdue' ? 'red' : s.status === 'draft' ? 'gray' : 'amber'
                    } className="capitalize">{s.status}</Badge>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text-primary">${s.total.toLocaleString()}</p>
                      <p className="text-xs text-text-muted">{s.count} invoice{s.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
                {(!invoiceData?.invoices_by_status || invoiceData.invoices_by_status.length === 0) && (
                  <p className="text-sm text-text-muted text-center py-8">No invoices yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {stats.tasks_by_status.length > 0 && (
        <Card>
          <CardHeader><h2 className="font-semibold text-text-primary">Tasks by status</h2></CardHeader>
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
          <CardHeader><h2 className="font-semibold text-text-primary">Recent signups</h2></CardHeader>
          <CardContent>
            {stats.recent_signups.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No users yet</p>
            ) : (
              <div className="space-y-1">
                {stats.recent_signups.map(u => (
                  <div key={u.email} className="flex items-center justify-between p-3 bg-surface-muted rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{u.name}</p>
                      <p className="text-xs text-text-muted">{u.email}</p>
                    </div>
                    <p className="text-xs text-text-muted">{formatDateShort(u.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold text-text-primary">Organizations</h2></CardHeader>
          <CardContent>
            {stats.recent_orgs.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No organizations yet</p>
            ) : (
              <div className="space-y-1">
                {stats.recent_orgs.map(o => (
                  <div key={o.name} className="flex items-center justify-between p-3 bg-surface-muted rounded-xl">
                    <p className="text-sm font-medium text-text-primary">{o.name}</p>
                    <p className="text-xs text-text-muted">{formatDateShort(o.created_at)}</p>
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
