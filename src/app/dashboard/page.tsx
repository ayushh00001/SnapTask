'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ActivityFeed } from '@/components/activity/activity-feed'
import { EmptyState } from '@/components/ui/empty-state'
import type { Project, ProjectTask, AiPrediction } from '@/lib/types'
import { formatDateShort, isOverdue, statusColor } from '@/lib/utils'

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [predictions, setPredictions] = useState<AiPrediction[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1)
      if (!orgs?.length) { setLoading(false); return }
      const orgId = orgs[0].org_id
      setOrgId(orgId)

      const { data: projectsData } = await supabase
        .from('projects').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
      setProjects(projectsData || [])

      let tasksData: ProjectTask[] = []
      if (projectsData?.length) {
        const projectIds = projectsData.map(p => p.id)
        const { data } = await supabase
          .from('tasks').select('*')
          .in('project_id', projectIds)
          .order('due_date', { ascending: true })
        tasksData = data || []

        const { data: predictionsData } = await supabase
          .from('ai_predictions').select('*')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }).limit(5)
        setPredictions(predictionsData || [])
      }
      setTasks(tasksData)
      setLoading(false)
    }
    load()
  }, [])

  const dueToday = tasks.filter(t => {
    if (!t.due_date) return false
    return new Date(t.due_date).toDateString() === new Date().toDateString()
  })

  const overdue = tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-0.5">Your workspace overview</p>
        </div>
        <Link href="/projects">
          <Button size="sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New project
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Active projects', value: projects.filter(p => p.status === 'active').length, icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
          { label: 'Due today', value: dueToday.length, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
          { label: 'Overdue', value: overdue.length, icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        ].map((stat, i) => (
          <div key={stat.label} className="animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
            <Card className="h-full">
              <CardContent className="flex items-center gap-3 !p-4">
                <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-text-secondary font-medium">{stat.label}</p>
                  <p className={`text-2xl font-bold ${overdue.length > 0 && stat.label === 'Overdue' ? 'text-danger' : 'text-text'}`}>{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {predictions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-text">AI Insights</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {predictions.map(p => (
              <div key={p.id} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-orange-soft border border-orange/10">
                <svg className="w-4 h-4 text-orange mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm text-text">{p.message}</p>
                  <p className="text-xs text-text-muted mt-0.5">{formatDateShort(p.created_at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Recent projects</h2>
            {projects.length > 0 && (
              <Link href="/projects" className="text-xs text-accent hover:text-accent-hover font-medium">View all</Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <EmptyState
              type="projects"
              title="No projects yet"
              description="Create your first project to get started"
              action={<Link href="/projects"><Button>Create your first project</Button></Link>}
            />
          ) : (
            <div className="space-y-1">
              {projects.slice(0, 5).map(project => {
                const taskCount = tasks.filter(t => t.project_id === project.id).length
                return (
                  <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-hover transition-colors -mx-1 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-bg-secondary flex items-center justify-center group-hover:bg-accent-soft transition-colors">
                        <svg className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-text font-medium group-hover:text-accent transition-colors">{project.name}</p>
                        <p className="text-xs text-text-muted">{taskCount} tasks</p>
                      </div>
                    </div>
                    <Badge color={statusColor(project.status)} className="capitalize">{project.status}</Badge>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {orgId && <ActivityFeed orgId={orgId} />}
    </div>
  )
}
