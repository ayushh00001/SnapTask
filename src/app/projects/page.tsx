'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
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
    if (!newName.trim()) return
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1)
    if (!orgs?.length) return
    const orgId = orgs[0].org_id
    const { data, error } = await supabase.from('projects').insert({
      org_id: orgId,
      name: newName,
      description: newDesc || null,
      status: 'planning',
      created_by: userData.user.id,
    }).select().single()
    if (error) { toast.error(error.message); return }
    await logActivity(orgId, userData.user.id, 'create_project', 'project', data.id, { name: data.name })
    setShowCreate(false); setNewName(''); setNewDesc('')
    router.push(`/projects/${data.id}`)
  }

  const handleAiCreate = async () => {
    if (!newDesc.trim()) { toast.error('Describe your project'); return }
    setAiLoading(true)
    try {
      const plan = await extractTasksFromText(newDesc)
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1)
      if (!orgs?.length) return
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

      const { data: project, error } = await supabase.from('projects').insert({
        org_id: orgId,
        name: plan.projectName || newName || 'Untitled',
        description: plan.guide || plan.description || newDesc,
        status: 'active',
        created_by: userData.user.id,
      }).select().single()
      if (error) { toast.error(error.message); return }

      for (const phase of plan.phases) {
        const { data: phaseData } = await supabase.from('project_phases').insert({
          project_id: project.id, name: phase.name, order: phase.order,
        }).select().single()
        if (phaseData) {
          const phaseTasks = tasksWithAssignees.filter(t => t.phase === phase.name)
          for (const task of phaseTasks) {
            await supabase.from('tasks').insert({
              project_id: project.id, phase_id: phaseData.id, title: task.title,
              priority: task.priority || 'medium', status: 'todo', created_by: userData.user.id,
              assignee_id: task.assignee || null,
              estimated_hours: task.estimated_hours,
              description: task.instructions || null,
            })
          }
        }
      }
      await logActivity(orgId, userData.user.id, 'create_project', 'project', project.id, { name: project.name, ai: true })
      toast.success(members.length > 0
        ? `Project created with AI! Tasks assigned to ${members.length} team members.`
        : 'Project created with AI!')
      setShowCreate(false); setNewName(''); setNewDesc('')
      router.push(`/projects/${project.id}`)
    } catch {
      toast.error('AI extraction failed. Try typing manually.')
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
            title="No projects yet"
            description="Create your first project — type a description and AI builds the plan"
            action={<Button onClick={() => setShowCreate(true)}>Create project</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <button key={project.id} onClick={() => router.push(`/projects/${project.id}`)} className="text-left group">
              <Card className="h-full hover:shadow-md transition-all duration-200 border-border-light hover:border-border">
                <CardContent className="p-4">
                  {project.photo_url && (
                    <img src={project.photo_url} alt="" className="w-full h-24 object-cover mb-3" />
                  )}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-medium text-sm text-notion-text truncate group-hover:text-notion-accent transition-colors">{project.name}</h3>
                    <Badge color={statusColor(project.status)} className="capitalize flex-shrink-0">{project.status}</Badge>
                  </div>
                  {project.description && (
                    <p className="text-xs text-notion-text-secondary line-clamp-2">{project.description}</p>
                  )}
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

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setAiLoading(false) }} title="Create project" subtitle="Describe your project and let AI build the plan">
        <div className="space-y-4">
          <Input id="pname" label="Project name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Q3 Marketing Campaign" />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Describe your project</label>
            <textarea
              className="block w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 min-h-[120px] transition-all duration-150"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Describe what needs to be built, or paste meeting notes. AI will extract tasks..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleCreate} className="flex-1" variant="secondary" disabled={!newName.trim()}>Create manually</Button>
            <Button onClick={handleAiCreate} loading={aiLoading} className="flex-1" disabled={!newDesc.trim()}>
              {aiLoading ? 'Thinking...' : 'Generate with AI'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
