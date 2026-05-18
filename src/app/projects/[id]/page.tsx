'use client'

import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { TaskCard } from '@/components/tasks/task-card'
import { NewTaskForm } from '@/components/tasks/new-task-form'
import type { TaskFormData } from '@/components/tasks/new-task-form'
import { AiInsights } from '@/components/ai/ai-insights'
import { AiAgentChat } from '@/components/ai/ai-agent-chat'
import { notifyTaskCompleted } from '@/lib/notifications'
import type { Project, ProjectPhase, ProjectTask, Profile } from '@/lib/types'
import { statusColor } from '@/lib/utils'
import { toast } from 'sonner'

type SupabaseClient = ReturnType<typeof createClient>

const statusColumns = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
]

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [showAiAgent, setShowAiAgent] = useState(false)
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  const getSupabase = (): SupabaseClient => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  const refreshTasks = async () => {
    const supabase = getSupabase()
    const [phasesRes, tasksRes] = await Promise.all([
      supabase.from('project_phases').select('*').eq('project_id', id).order('order'),
      supabase.from('tasks').select('*').eq('project_id', id),
    ])
    setPhases(phasesRes.data || [])
    if (tasksRes.error) console.error('Task fetch error:', tasksRes.error)
    setTasks(tasksRes.data || [])
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('guide') === 'true') {
      setShowAiAgent(true)
    }
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    async function load() {
      const { data: projectData } = await supabase.from('projects').select('*').eq('id', id).single()
      if (!projectData) { router.push('/projects'); return }
      setProject(projectData)

      await refreshTasks()

      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1)
        if (orgs?.length) {
          setOrgId(orgs[0].org_id)
          const { data: memberProfiles } = await supabase
            .from('org_members')
            .select('user_id')
            .eq('org_id', orgs[0].org_id)
          if (memberProfiles?.length) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('*')
              .in('id', memberProfiles.map(m => m.user_id))
            setMembers(profiles || [])
          }
        }
      }
      setLoading(false)
    }
    load()

    const channel = supabase.channel(`project-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${id}` }, payload => {
        if (payload.eventType === 'INSERT') {
          setTasks(prev => [...prev, payload.new as ProjectTask])
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } as ProjectTask : t))
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, router])

  const handleDrop = async (taskId: string, newStatus: string) => {
    const supabase = getSupabase()
    const task = tasks.find(t => t.id === taskId)
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as ProjectTask['status'] } : t))

    if (newStatus === 'done' && task && orgId) {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const memberIds = members.map(m => m.id)
        notifyTaskCompleted(taskId, task.title, id, userData.user.id, orgId, memberIds)
      }
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    const supabase = getSupabase()
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    toast.success('Task deleted')
  }

  const handleDeleteProject = async () => {
    if (!confirm('Delete this project and all tasks?')) return
    const supabase = getSupabase()
    await supabase.from('projects').delete().eq('id', id)
    toast.success('Project deleted')
    router.push('/projects')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-4 h-4 border-[2px] border-notion-text border-t-transparent rounded-full" />
    </div>
  )
  if (!project) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-notion-text truncate">{project.name}</h1>
            <Badge color={statusColor(project.status)} className="capitalize flex-shrink-0">{project.status}</Badge>
          </div>
          {project.description && (
            project.description.startsWith('## Project Guide') ? (
              <details className="mt-2 group">
                <summary className="text-sm text-brand-500 cursor-pointer hover:text-brand-600 transition-colors font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  View AI Supervisor Guide
                </summary>
                <div className="mt-2 p-3 bg-notion-bg-hover border border-notion-border text-sm text-notion-text-secondary leading-relaxed whitespace-pre-line">
                  {project.description.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-notion-text mb-1 text-base">{line.replace('## ', '')}</h3>
                    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-notion-text mb-1">{line.replace(/\*\*/g, '')}</p>
                    if (line.match(/^\d+\./)) return <p key={i} className="ml-4 mb-0.5">{line}</p>
                    if (line.startsWith('•')) return <p key={i} className="ml-2 mb-0.5">{line}</p>
                    return <p key={i} className="mb-0.5">{line}</p>
                  })}
                </div>
              </details>
            ) : (
              <p className="mt-0.5 text-sm text-notion-text-secondary line-clamp-2">{project.description}</p>
            )
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
          <Button variant="accent" onClick={() => setShowAiAgent(true)} size="sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Agent
          </Button>
          <Button variant="secondary" onClick={() => setShowAiModal(true)} size="sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Insights
          </Button>
          <Button variant="secondary" onClick={() => { setSelectedPhase(null); setShowTaskForm(true) }} size="sm">+ Add</Button>
          <Button variant="danger" onClick={handleDeleteProject} size="sm">Delete</Button>
        </div>
      </div>

      {phases.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {phases.map(phase => (
            <Badge key={phase.id} color="blue">{phase.name}</Badge>
          ))}
        </div>
      )}

      {tasks.length > 0 && (
        <NextStepBar tasks={tasks} onOpenAgent={() => setShowAiAgent(true)} />
      )}

      <div className="flex items-center gap-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
        <span>Tasks in state: <strong>{tasks.length}</strong></span>
        <span>Todo: <strong>{tasks.filter(t => t.status === 'todo').length}</strong></span>
        <span>In Progress: <strong>{tasks.filter(t => t.status === 'in_progress').length}</strong></span>
        <span>Done: <strong>{tasks.filter(t => t.status === 'done').length}</strong></span>
        <button onClick={() => refreshTasks()} className="ml-auto underline hover:no-underline">Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {statusColumns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key)
          return (
            <div
              key={col.key}
              className="bg-notion-bg-secondary p-3 min-h-[200px]"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const taskId = e.dataTransfer.getData('taskId')
                if (taskId) handleDrop(taskId, col.key)
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-xs text-notion-text-secondary uppercase tracking-wide">{col.label}</h3>
                <span className="text-xs text-notion-text-muted">{colTasks.length}</span>
              </div>
              <div className="space-y-1.5">
                {colTasks.map(task => (
                  <TaskCard key={task.id} task={task} members={members} onDelete={handleDeleteTask} onUpdate={() => {}} />
                ))}
                <button
                  onClick={() => { setSelectedPhase(null); setShowTaskForm(true) }}
                  className="w-full py-1.5 text-xs text-notion-text-muted hover:text-notion-text-secondary hover:bg-notion-bg-hover transition-colors"
                >
                  + Add
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={showTaskForm} onClose={() => setShowTaskForm(false)} title="Add task">
        <NewTaskForm
          projectId={id}
          phases={phases}
          members={members}
          selectedPhase={selectedPhase}
          onSuccess={async (data: TaskFormData) => {
            const supabase = getSupabase()
            const { data: userData } = await supabase.auth.getUser()
            if (!userData.user) { toast.error('Not authenticated'); return }
            const { error } = await supabase.from('tasks').insert({
              project_id: id,
              phase_id: data.phase_id,
              title: data.title,
              description: data.description,
              priority: data.priority,
              status: data.status,
              assignee_id: data.assignee_id,
              due_date: data.due_date,
              estimated_hours: data.estimated_hours,
              created_by: userData.user.id,
            })
            if (error) { toast.error('Task failed: ' + error.message); return }
            toast.success('Task added')
            setShowTaskForm(false)
            await refreshTasks()
          }}
        />
      </Modal>

      <Modal open={showAiAgent} onClose={() => setShowAiAgent(false)} title="AI Agent Chat" subtitle="Ask AI to assign tasks, review progress, and give instructions" className="max-w-xl">
        <AiAgentChat project={project} tasks={tasks} members={members} onAssign={() => refreshTasks()} />
      </Modal>

      <Modal open={showAiModal} onClose={() => setShowAiModal(false)} title="AI Insights" className="max-w-2xl">
        <AiInsights project={project} tasks={tasks} />
      </Modal>
    </div>
  )
}

function NextStepBar({ tasks, onOpenAgent }: { tasks: ProjectTask[]; onOpenAgent: () => void }) {
  const done = tasks.filter(t => t.status === 'done').length
  const total = tasks.length
  const pct = Math.round(done / total * 100)
  const nextTask = tasks.find(t => t.status === 'todo' || t.status === 'backlog')
  const inProgress = tasks.filter(t => t.status === 'in_progress').length

  if (done === total) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm">
        <span className="text-green-600 font-medium">All {total} tasks done!</span>
        <span className="text-green-500">Ready for the next project.</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-sm">
      <div className="flex items-center gap-3">
        <div className="w-24 h-1.5 bg-brand-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-brand-700 font-medium">{pct}%</span>
        {inProgress > 0 && <span className="text-brand-600">{inProgress} in progress</span>}
        {nextTask && (
          <span className="text-brand-600 ml-2">
            Next: <span className="font-medium text-brand-800">{nextTask.title}</span>
          </span>
        )}
      </div>
      <button
        onClick={onOpenAgent}
        className="text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1"
      >
        Ask AI how to do it
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
