'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import type { Project } from '@/lib/types'
import { formatDateShort, statusColor } from '@/lib/utils'
import { toast } from 'sonner'
import { extractTasksFromText, distributeTasksEvenly } from '@/lib/ai/gemini'
import { logActivity } from '@/components/activity/activity-feed'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; done: number }>>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const router = useRouter()

  async function loadProjects() {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1)
    if (!orgs?.length) { setLoading(false); return }
    const { data } = await supabase.from('projects').select('*').eq('org_id', orgs[0].org_id).order('created_at', { ascending: false })
    setProjects(data || [])
    if (data?.length) {
      const { data: tasks } = await supabase.from('tasks').select('project_id, status').in('project_id', data.map(p => p.id))
      const counts: Record<string, { total: number; done: number }> = {}
      ;(tasks || []).forEach(t => {
        if (!counts[t.project_id]) counts[t.project_id] = { total: 0, done: 0 }
        counts[t.project_id].total++
        if (t.status === 'done') counts[t.project_id].done++
      })
      setTaskCounts(counts)
    }
    setLoading(false)
  }

  useEffect(() => { loadProjects() }, [])

  const handleCreate = async () => {
    if (!newDesc.trim()) { toast.error('Describe what you want to build'); return }
    setAiLoading(true)
    try {
      setProgressMsg('AI is analyzing your project...')
      const plan = await extractTasksFromText(newDesc, (msg) => setProgressMsg(msg))

      if (!plan.tasks || plan.tasks.length === 0) {
        console.error('Plan has no tasks:', plan)
        toast.error('AI could not generate tasks. Please try a more detailed description.')
        setAiLoading(false)
        return
      }

      setProgressMsg('Creating project...')
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { setAiLoading(false); return }
      const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1)
      if (!orgs?.length) { setAiLoading(false); return }
      const orgId = orgs[0].org_id

      const { data: memberProfiles } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('org_id', orgId)
      let members: { id: string; name: string }[] = []
      if (memberProfiles?.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', memberProfiles.map(m => m.user_id))
        members = profiles || []
      }

      const tasksWithAssignees = distributeTasksEvenly(plan.tasks, members)

      const fullGuide = plan.research
        ? `${plan.research}\n\n---\n\n${plan.guide}`
        : (plan.guide || plan.description || newDesc)

      const { data: project, error } = await supabase.from('projects').insert({
        org_id: orgId,
        name: plan.projectName || 'New Project',
        description: fullGuide,
        status: 'active',
        created_by: userData.user.id,
      }).select().single()
      if (error) { toast.error(error.message); setAiLoading(false); return }

      setProgressMsg('Setting up tasks...')
      let createdCount = 0
      for (const phase of plan.phases) {
        const { data: phaseData, error: phaseErr } = await supabase.from('project_phases').insert({
          project_id: project.id, name: phase.name, order: phase.order,
        }).select().single()
        if (phaseErr) { console.error('Phase insert error:', phaseErr); continue }
        if (phaseData) {
          const phaseTasks = tasksWithAssignees.filter(t => t.phase === phase.name)
          for (const task of phaseTasks) {
            const { error: taskErr } = await supabase.from('tasks').insert({
              project_id: project.id, phase_id: phaseData.id, title: task.title,
              priority: task.priority || 'medium', status: 'todo', created_by: userData.user.id,
              assignee_id: task.assignee || null,
              estimated_hours: task.estimated_hours,
              description: task.instructions || null,
            })
            if (taskErr) console.error('Task insert error:', taskErr)
            else createdCount++
          }
        }
      }

      if (createdCount === 0) {
        toast.error('Could not create tasks. The project was created but has no tasks.')
        setAiLoading(false)
        return
      }

      await logActivity(orgId, userData.user.id, 'create_project', 'project', project.id, { name: project.name, ai: true })
      toast.success(`Project created with ${createdCount} tasks!`)
      setShowCreate(false); setNewDesc('')
      router.push(`/projects/${project.id}?guide=true`)
    } catch (e) {
      console.error('Project creation error:', e)
      toast.error(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-notion-text">Projects</h1>
          <p className="text-sm text-notion-text-secondary mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New project</Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            type="projects"
            title="Start your first project"
            description="Describe what you want to build — AI will create a complete plan with tasks and instructions"
            action={<Button onClick={() => setShowCreate(true)}>Create project</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, i) => (
            <button key={project.id} onClick={() => router.push(`/projects/${project.id}`)} className="text-left group animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
              <Card className="h-full border-border-light hover:border-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-medium text-sm text-notion-text truncate group-hover:text-notion-accent transition-colors">{project.name}</h3>
                    <Badge color={statusColor(project.status)} className="capitalize flex-shrink-0">{project.status}</Badge>
                  </div>
                  {taskCounts[project.id] && taskCounts[project.id].total > 0 && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-notion-text-muted">{taskCounts[project.id].done}/{taskCounts[project.id].total} done</span>
                        <span className="font-medium text-notion-text-secondary">{Math.round(taskCounts[project.id].done / taskCounts[project.id].total * 100)}%</span>
                      </div>
                      <div className="w-full h-1 bg-notion-bg-secondary">
                        <div
                          className="h-full bg-notion-accent transition-all duration-500"
                          style={{ width: `${taskCounts[project.id].done / taskCounts[project.id].total * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-notion-border flex items-center justify-between text-[11px] text-notion-text-muted">
                    <span>Created {formatDateShort(project.created_at)}</span>
                    {taskCounts[project.id]?.total ? <span>{taskCounts[project.id].total} task{taskCounts[project.id].total !== 1 ? 's' : ''}</span> : <span>0 tasks</span>}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setAiLoading(false); setNewDesc('') }} title="Create project" subtitle="Describe what you want to build — AI does the rest">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Describe your project</label>
            <textarea
              className="block w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 min-h-[140px] transition-all duration-150"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Example: Build a landing page for my SaaS startup with pricing, features, and a contact form. Use Next.js and Tailwind CSS."
              autoFocus
            />
            <p className="text-xs text-notion-text-muted">AI will research your project, create tasks with step-by-step instructions, and guide you through building it.</p>
          </div>
          {aiLoading && progressMsg && (
            <div className="flex items-center gap-2 text-sm text-brand-600">
              <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              {progressMsg}
            </div>
          )}
          <Button onClick={handleCreate} loading={aiLoading} className="w-full" disabled={!newDesc.trim()}>
            {aiLoading ? (progressMsg || 'Working...') : 'Create project with AI'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
