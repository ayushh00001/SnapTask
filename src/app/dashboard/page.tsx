'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Project, ProjectTask, AiPrediction } from '@/lib/types'
import { formatDateShort, isOverdue, statusColor } from '@/lib/utils'

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [predictions, setPredictions] = useState<AiPrediction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1)
      if (!orgs?.length) { setLoading(false); return }
      const orgId = orgs[0].org_id

      const [projectsRes, predictionsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
        supabase.from('ai_predictions').select('*').eq('project_id', orgId).order('created_at', { ascending: false }).limit(5),
      ])
      setProjects(projectsRes.data || [])
      setPredictions(predictionsRes.data || [])

      if (projectsRes.data?.length) {
        const { data: tasksData } = await supabase
          .from('tasks').select('*')
          .in('project_id', projectsRes.data.map(p => p.id))
          .order('due_date', { ascending: true })
        setTasks(tasksData || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const dueToday = tasks.filter(t => {
    if (!t.due_date) return false
    const today = new Date().toDateString()
    return new Date(t.due_date).toDateString() === today
  })

  const overdue = tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your projects and tasks</p>
        </div>
        <Link href="/projects">
          <Button>New project</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Active projects</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{projects.filter(p => p.status === 'active').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Due today</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{dueToday.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Overdue</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{overdue.length}</p>
          </CardContent>
        </Card>
      </div>

      {predictions.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">AI Predictions</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {predictions.map(p => (
              <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">{p.message}</p>
                  <p className="text-xs text-amber-600 mt-1">{formatDateShort(p.created_at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Recent projects</h2>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-gray-500">No projects yet</p>
              <Link href="/projects">
                <Button variant="primary" className="mt-4">Create your first project</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 5).map(project => (
                <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900">{project.name}</p>
                    <p className="text-sm text-gray-500">{project.tasks?.length || 0} tasks</p>
                  </div>
                  <Badge color={project.status === 'active' ? 'green' : project.status === 'paused' ? 'amber' : project.status === 'completed' ? 'blue' : 'gray'}>
                    {project.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
