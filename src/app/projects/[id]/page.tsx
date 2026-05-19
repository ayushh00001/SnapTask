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
import { statusColor, formatDateShort, cn, isOverdue } from '@/lib/utils'
import { toast } from 'sonner'
import { TaskDetailModal } from '@/components/tasks/task-detail-modal'
import { Confetti } from '@/components/ui/confetti'

type SupabaseClient = ReturnType<typeof createClient>
type ViewMode = 'kanban' | 'list' | 'calendar'

const statusColumns = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
]

interface Milestone {
  id: string
  project_id: string
  name: string
  description: string | null
  due_date: string | null
  status: 'pending' | 'in_progress' | 'completed'
  order_index: number
}

interface TimeEntry {
  id: string
  task_id: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
}

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
  const [showShipModal, setShowShipModal] = useState(false)
  const [showTemplateSave, setShowTemplateSave] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [newMilestoneDate, setNewMilestoneDate] = useState('')
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null)
  const [timeEntries, setTimeEntries] = useState<Record<string, TimeEntry[]>>({})
  const [activeTimers, setActiveTimers] = useState<Record<string, string>>({})
  const [confettiActive, setConfettiActive] = useState(false)
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

  const refreshMilestones = async () => {
    const supabase = getSupabase()
    const { data } = await supabase.from('milestones').select('*').eq('project_id', id).order('order_index')
    setMilestones(data || [])
  }

  const refreshTimeEntries = async () => {
    const supabase = getSupabase()
    const taskIds = tasks.map(t => t.id)
    if (taskIds.length === 0) return
    const { data } = await supabase.from('time_entries').select('*').in('task_id', taskIds)
    const grouped: Record<string, TimeEntry[]> = {}
    ;(data || []).forEach(e => {
      if (!grouped[e.task_id]) grouped[e.task_id] = []
      grouped[e.task_id].push(e)
    })
    setTimeEntries(grouped)

    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      const running: Record<string, string> = {}
      ;(data || []).filter(e => e.user_id === userData.user!.id && !e.ended_at).forEach(e => {
        running[e.task_id] = e.id
      })
      setActiveTimers(running)
    }
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

  useEffect(() => { if (tasks.length > 0) refreshTimeEntries() }, [tasks.length])

  const handleDrop = async (taskId: string, newStatus: string) => {
    const supabase = getSupabase()
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
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

  const handleAddMilestone = async () => {
    if (!newMilestoneName.trim()) return
    const supabase = getSupabase()
    const { error } = await supabase.from('milestones').insert({
      project_id: id,
      name: newMilestoneName,
      due_date: newMilestoneDate || null,
      order_index: milestones.length,
    })
    if (error) { toast.error(error.message); return }
    setNewMilestoneName(''); setNewMilestoneDate(''); setShowMilestoneForm(false)
    refreshMilestones()
    toast.success('Milestone added')
  }

  const handleToggleMilestone = async (m: Milestone) => {
    const next = m.status === 'completed' ? 'pending' : 'completed'
    const supabase = getSupabase()
    await supabase.from('milestones').update({ status: next, updated_at: new Date().toISOString() }).eq('id', m.id)
    refreshMilestones()
  }

  const handleStartTimer = async (taskId: string) => {
    if (activeTimers[taskId]) return
    const supabase = getSupabase()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data, error } = await supabase.from('time_entries').insert({
      task_id: taskId,
      user_id: userData.user.id,
      started_at: new Date().toISOString(),
    }).select().single()
    if (error) { toast.error(error.message); return }
    setActiveTimers(prev => ({ ...prev, [taskId]: data.id }))
    toast.success('Timer started')
  }

  const handleStopTimer = async (taskId: string) => {
    const entryId = activeTimers[taskId]
    if (!entryId) return
    const supabase = getSupabase()
    const entry = timeEntries[taskId]?.find(e => e.id === entryId)
    const startedAt = entry?.started_at || new Date().toISOString()
    const durationMin = Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)
    await supabase.from('time_entries').update({
      ended_at: new Date().toISOString(),
      duration_minutes: Math.max(1, durationMin),
    }).eq('id', entryId)
    setActiveTimers(prev => { const n = { ...prev }; delete n[taskId]; return n })
    refreshTimeEntries()
    toast.success(`Logged ${Math.max(1, durationMin)}m`)
  }

  const handleShip = async () => {
    const supabase = getSupabase()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user || !orgId) return
    const doneTasks = tasks.filter(t => t.status === 'done')
    const timelineDays = project?.created_at
      ? Math.ceil((Date.now() - new Date(project.created_at).getTime()) / 86400000)
      : null
    await supabase.from('ship_logs').insert({
      project_id: id,
      shipped_by: userData.user.id,
      completed_tasks: doneTasks.length,
      total_tasks: tasks.length,
      timeline_days: timelineDays,
      insights: {
        completion_rate: Math.round(doneTasks.length / tasks.length * 100),
        team_size: members.length,
      },
      retrospective: generateRetrospective(tasks, members),
    })
    await supabase.from('projects').update({ status: 'completed' }).eq('id', id)
    toast.success('Project shipped!')
    setShowShipModal(false)
    setConfettiActive(true)
    refreshTasks()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  )
  if (!project) return null

  const doneTasks = tasks.filter(t => t.status === 'done').length
  const totalTasks = tasks.length
  const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0
  const allDone = totalTasks > 0 && doneTasks === totalTasks

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 animate-fade-in">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text truncate">{project.name}</h1>
            <Badge color={statusColor(project.status)} className="capitalize flex-shrink-0">{project.status}</Badge>
          </div>
          {project.photo_url && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-border max-h-48">
              <img src={project.photo_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {project.description && (
            project.description.startsWith('## Project Guide') ? (
              <details className="mt-3 group">
                <summary className="text-sm text-accent cursor-pointer hover:text-accent-hover transition-colors font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  View AI Supervisor Guide
                </summary>
                <div className="mt-2 p-4 bg-bg-secondary border border-border rounded-xl text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                  {project.description.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-text mb-1 text-base">{line.replace('## ', '')}</h3>
                    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-text mb-1">{line.replace(/\*\*/g, '')}</p>
                    if (line.match(/^\d+\./)) return <p key={i} className="ml-4 mb-0.5">{line}</p>
                    if (line.startsWith('•')) return <p key={i} className="ml-2 mb-0.5">{line}</p>
                    return <p key={i} className="mb-0.5">{line}</p>
                  })}
                </div>
              </details>
            ) : (
              <p className="mt-1 text-sm text-text-secondary line-clamp-2">{project.description}</p>
            )
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
          <Button variant="accent" onClick={() => setShowAiAgent(true)} size="sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Agent
          </Button>
          <Button variant="secondary" onClick={() => setShowAiModal(true)} size="sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Insights
          </Button>
          {allDone && (
            <Button variant="accent" onClick={() => setShowShipModal(true)} size="sm">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Ship
            </Button>
          )}
          <Button variant="secondary" onClick={() => { setTemplateName(project.name); setShowTemplateSave(true) }} size="sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Template
          </Button>
          <Button variant="secondary" onClick={() => { setSelectedPhase(null); setShowTaskForm(true) }} size="sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add
          </Button>
          <Button variant="danger" onClick={handleDeleteProject} size="sm">Delete</Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {phases.map(phase => (
            <Badge key={phase.id} color="purple">{phase.name}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-bg-secondary rounded-xl p-0.5">
          {(['kanban', 'list', 'calendar'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all capitalize flex items-center gap-1',
                viewMode === mode
                  ? 'bg-card shadow-sm text-text'
                  : 'text-text-muted hover:text-text'
              )}
            >
              {mode === 'kanban' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              )}
              {mode === 'list' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              )}
              {mode === 'calendar' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              {mode}
            </button>
          ))}
        </div>
      </div>

      {totalTasks > 0 && (
        <NextStepBar tasks={tasks} onOpenAgent={() => setShowAiAgent(true)} />
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowMilestoneForm(!showMilestoneForm)}
          className="text-xs text-text-muted hover:text-text hover:bg-bg-hover px-2.5 py-1.5 rounded-lg transition-colors font-medium"
        >
          + Milestone
        </button>
      </div>

      {milestones.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {milestones.map(m => (
            <button
              key={m.id}
              onClick={() => handleToggleMilestone(m)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs whitespace-nowrap transition-all font-medium',
                m.status === 'completed'
                  ? 'border-green/30 bg-green-soft text-green'
                  : m.status === 'in_progress'
                  ? 'border-orange/30 bg-orange-soft text-orange'
                  : 'border-border text-text-secondary'
              )}
            >
              <div className={cn(
                'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                m.status === 'completed' ? 'bg-green border-green' : 'border-current'
              )}>
                {m.status === 'completed' && (
                  <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {m.name}
              {m.due_date && <span className="text-text-muted">{formatDateShort(m.due_date)}</span>}
            </button>
          ))}
        </div>
      )}

      {showMilestoneForm && (
        <div className="flex gap-2 items-end">
          <Input placeholder="Milestone name" value={newMilestoneName} onChange={e => setNewMilestoneName(e.target.value)} />
          <Input type="date" value={newMilestoneDate} onChange={e => setNewMilestoneDate(e.target.value)} />
          <Button variant="secondary" size="sm" onClick={handleAddMilestone} disabled={!newMilestoneName.trim()}>Add</Button>
        </div>
      )}

      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {statusColumns.map((col, ci) => {
            const colTasks = tasks.filter(t => t.status === col.key)
            return (
              <div
                key={col.key}
                className="bg-bg-secondary rounded-2xl p-3 min-h-[200px] animate-slide-up"
                style={{ animationDelay: `${ci * 80}ms` }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  const taskId = e.dataTransfer.getData('taskId')
                  if (taskId) handleDrop(taskId, col.key)
                }}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-semibold text-xs text-text-secondary uppercase tracking-wider">{col.label}</h3>
                  <span className="text-xs text-text-muted bg-bg-hover px-2 py-0.5 rounded-full font-medium">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task, ti) => (
                    <div key={task.id} className="animate-slide-up" style={{ animationDelay: `${ti * 40}ms` }}>
                      <TaskCard
                        task={task}
                        members={members}
                        onDelete={handleDeleteTask}
                        onUpdate={() => {}}
                        onClick={() => setSelectedTask(task)}
                        isTimerRunning={!!activeTimers[task.id]}
                        onStartTimer={() => handleStartTimer(task.id)}
                        onStopTimer={() => handleStopTimer(task.id)}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => { setSelectedPhase(null); setShowTaskForm(true) }}
                    className="w-full py-2 text-xs text-text-muted hover:text-text-secondary hover:bg-bg-hover rounded-xl transition-colors"
                  >
                    + Add task
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden animate-fade-in shadow-sm">
          <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-border bg-bg-secondary text-xs font-semibold text-text-muted uppercase tracking-wider">
            <div className="col-span-4">Task</div>
            <div className="col-span-2">Phase</div>
            <div className="col-span-2">Assignee</div>
            <div className="col-span-1">Priority</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Due</div>
            <div className="col-span-1">Time</div>
          </div>
          {[...tasks].sort((a, b) => (a.order || 0) - (b.order || 0)).map((task, i) => {
            const phase = phases.find(p => p.id === task.phase_id)
            const assignee = members.find(m => m.id === task.assignee_id)
            const taskTime = timeEntries[task.id]
            const totalMin = taskTime?.reduce((s, e) => s + (e.duration_minutes || 0), 0) || 0
            return (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-border last:border-0 hover:bg-bg-hover transition-colors text-left w-full animate-slide-up"
                style={{ animationDelay: `${i * 20}ms` }}
              >
                <div className="col-span-4 text-sm text-text truncate font-medium">{task.title}</div>
                <div className="col-span-2 text-xs text-text-secondary truncate">{phase?.name || '-'}</div>
                <div className="col-span-2 text-xs text-text-secondary truncate">{assignee?.name || '-'}</div>
                <div className="col-span-1">
                  <Badge color={task.priority === 'urgent' ? 'red' : task.priority === 'high' ? 'amber' : task.priority === 'medium' ? 'blue' : 'gray'} className="text-[10px] px-1.5">{task.priority}</Badge>
                </div>
                <div className="col-span-1 text-xs capitalize text-text-secondary">{task.status.replace('_', ' ')}</div>
                <div className="col-span-1 text-xs text-text-secondary">{task.due_date ? formatDateShort(task.due_date) : '-'}</div>
                <div className="col-span-1 text-xs text-text-secondary font-medium">{totalMin > 0 ? `${Math.round(totalMin / 60 * 10) / 10}h` : '-'}</div>
              </button>
            )
          })}
        </div>
      )}

      {viewMode === 'calendar' && (
        <CalendarView tasks={tasks} phases={phases} onTaskClick={(t) => setSelectedTask(t)} />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          members={members}
          allTasks={tasks}
          open={true}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => { refreshTasks(); refreshTimeEntries() }}
        />
      )}

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

      <Modal open={showAiAgent} onClose={() => setShowAiAgent(false)} title="AI Agent" subtitle="Ask AI to assign tasks, review progress, and give instructions" className="max-w-xl">
        <AiAgentChat project={project} tasks={tasks} members={members} onAssign={() => refreshTasks()} />
      </Modal>

      <Modal open={showAiModal} onClose={() => setShowAiModal(false)} title="AI Insights" className="max-w-2xl">
        <AiInsights project={project} tasks={tasks} />
      </Modal>

      <Modal open={showShipModal} onClose={() => setShowShipModal(false)} title="Ship project?" className="max-w-md">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-soft flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text">Ready to ship?</h3>
          <p className="text-sm text-text-secondary">
            {doneTasks} of {totalTasks} tasks completed ({pct}%).
            This will mark the project as completed and save a retrospective.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="secondary" onClick={() => setShowShipModal(false)}>Keep working</Button>
            <Button onClick={handleShip} className="bg-green hover:bg-green/90 text-white">Ship it</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showTemplateSave} onClose={() => setShowTemplateSave(false)} title="Save as template">
        <div className="space-y-4">
          <Input label="Template name" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Website Launch" />
          <p className="text-xs text-text-muted">Saves project structure as a reusable template.</p>
          <Button
            onClick={async () => {
              if (!templateName.trim() || !orgId) return
              const supabase = getSupabase()
              const { error } = await supabase.from('project_templates').insert({
                org_id: orgId,
                name: templateName,
                description: project?.description?.substring(0, 200) || null,
                phases: phases.map(p => ({ name: p.name, order: p.order })),
                tasks: tasks.map(t => ({
                  title: t.title,
                  phase: phases.find(p => p.id === t.phase_id)?.name || '',
                  priority: t.priority,
                  estimated_hours: t.estimated_hours,
                  instructions: t.description || '',
                })),
              })
              if (error) { toast.error(error.message); return }
              toast.success('Template saved!')
              setShowTemplateSave(false)
            }}
            className="w-full"
            disabled={!templateName.trim()}
          >
            Save template
          </Button>
        </div>
      </Modal>

      <Confetti active={confettiActive} />
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
      <div className="flex items-center gap-3 px-4 py-3 bg-green-soft border border-green/20 rounded-2xl text-sm">
        <div className="w-8 h-8 rounded-xl bg-green flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <span className="text-green font-semibold">All {total} tasks done!</span>
          <span className="text-green/70 ml-2">Ready for the next project.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gradient-accent-subtle border border-accent/10 rounded-2xl text-sm">
      <div className="flex items-center gap-3">
        <div className="w-28 h-2 bg-accent/15 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-purple transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-accent font-bold">{pct}%</span>
        {inProgress > 0 && <span className="text-accent">{inProgress} in progress</span>}
        {nextTask && (
          <span className="text-text-secondary ml-2 hidden sm:inline">
            Next: <span className="font-semibold text-text">{nextTask.title}</span>
          </span>
        )}
      </div>
      <button
        onClick={onOpenAgent}
        className="text-accent hover:text-accent-hover font-semibold flex items-center gap-1.5 transition-colors"
      >
        Ask AI
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

function CalendarView({ tasks, phases, onTaskClick }: { tasks: ProjectTask[]; phases: ProjectPhase[]; onTaskClick: (t: ProjectTask) => void }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const taskMap: Record<number, ProjectTask[]> = {}
  tasks.filter(t => t.due_date).forEach(t => {
    const d = new Date(t.due_date!)
    if (d.getMonth() === month && d.getFullYear() === year) {
      const day = d.getDate()
      if (!taskMap[day]) taskMap[day] = []
      taskMap[day].push(t)
    }
  })

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden animate-fade-in shadow-sm">
      <div className="px-5 py-3 border-b border-border bg-bg-secondary">
        <h3 className="text-sm font-semibold text-text">{monthName}</h3>
      </div>
      <div className="grid grid-cols-7">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="px-2 py-1.5 text-[11px] font-semibold text-text-muted text-center border-b border-border bg-bg-secondary/50">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[90px] border-b border-r border-border bg-bg-secondary/30" />
        ))}
        {days.map(day => {
          const dayTasks = taskMap[day] || []
          const isToday = day === today.getDate()
          return (
            <div key={day} className={cn('min-h-[90px] p-2 border-b border-r border-border', isToday && 'bg-accent-soft')}>
              <div className={cn(
                'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1',
                isToday ? 'bg-accent text-white' : 'text-text-secondary'
              )}>{day}</div>
              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map(t => {
                  const phase = phases.find(p => p.id === t.phase_id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => onTaskClick(t)}
                      className="w-full text-left text-[10px] px-2 py-1 rounded-lg bg-accent-soft text-accent font-medium truncate hover:bg-accent/20 transition-colors"
                    >
                      {t.title}
                    </button>
                  )
                })}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-text-muted font-medium px-1">+{dayTasks.length - 3} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function generateRetrospective(tasks: ProjectTask[], members: Profile[]): string {
  const done = tasks.filter(t => t.status === 'done')
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const notStarted = tasks.filter(t => t.status === 'todo' || t.status === 'backlog')
  return `## Project Retrospective\n\n**Completed:** ${done.length}/${tasks.length} tasks\n${overdue.length > 0 ? `**Overdue:** ${overdue.length} tasks\n` : ''}${notStarted.length > 0 ? `**Not started:** ${notStarted.length} tasks\n` : ''}**Team:** ${members.length} members\n## What went well\nThe project was completed with AI-powered planning and execution.\n## What could improve\nAreas identified for future sprints.`
}
