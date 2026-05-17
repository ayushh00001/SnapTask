'use client'

import { useEffect, useState, use } from 'react'
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
import { AiInsights } from '@/components/ai/ai-insights'
import { AiAgentChat } from '@/components/ai/ai-agent-chat'
import { notifyTaskCompleted } from '@/lib/notifications'
import type { Project, ProjectPhase, ProjectTask, Profile } from '@/lib/types'
import { statusColor } from '@/lib/utils'
import { toast } from 'sonner'

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
  const [refreshKey, setRefreshKey] = useState(0)

  const loadTasks = async (supabase: ReturnType<typeof createClient>) => {
    const [phasesRes, tasksRes] = await Promise.all([
      supabase.from('project_phases').select('*').eq('project_id', id).order('order'),
      supabase.from('tasks').select('*, assignee:assignee_id(id, email, name, avatar_url, created_at)').eq('project_id', id),
    ])
    setPhases(phasesRes.data || [])
    setTasks(tasksRes.data || [])
  }

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: projectData } = await supabase.from('projects').select('*').eq('id', id).single()
      if (!projectData) { router.push('/projects'); return }
      setProject(projectData)

      await loadTasks(supabase)

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
        if (payload.eventType === 'INSERT') setTasks(prev => [...prev, payload.new as ProjectTask])
        else if (payload.eventType === 'UPDATE') setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } as ProjectTask : t))
        else if (payload.eventType === 'DELETE') setTasks(prev => prev.filter(t => t.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, router, refreshKey])

  const handleDrop = async (taskId: string, newStatus: string) => {
    const supabase = createClient()
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
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    toast.success('Task deleted')
  }

  const handleDeleteProject = async () => {
    if (!confirm('Delete this project and all tasks?')) return
    const supabase = createClient()
    await supabase.from('projects').delete().eq('id', id)
    toast.success('Project deleted')
    router.push('/projects')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  )
  if (!project) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{project.name}</h1>
            <Badge color={statusColor(project.status)} className="capitalize flex-shrink-0">{project.status}</Badge>
          </div>
          {project.description && <p className="mt-1 text-gray-500 text-sm line-clamp-2">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <Button variant="secondary" onClick={() => setShowAiAgent(true)} className="!bg-brand-500/10 !text-brand-400 !border-brand-500/20 hover:!bg-brand-500/20 text-xs sm:text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">AI Agent</span>
            <span className="sm:hidden">AI</span>
          </Button>
          <Button variant="secondary" onClick={() => setShowAiModal(true)} className="text-xs sm:text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="hidden sm:inline">Insights</span>
          </Button>
          <Button variant="secondary" onClick={() => { setSelectedPhase(null); setShowTaskForm(true) }} className="text-xs sm:text-sm">Add</Button>
          <Button variant="danger" onClick={handleDeleteProject} className="text-xs sm:text-sm">Delete</Button>
        </div>
      </div>

      {phases.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {phases.map(phase => (
            <Badge key={phase.id} color="blue">{phase.name}</Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statusColumns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key)
          return (
            <div
              key={col.key}
              className="bg-gray-50 rounded-xl p-4 min-h-[300px]"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const taskId = e.dataTransfer.getData('taskId')
                if (taskId) handleDrop(taskId, col.key)
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-700 text-sm">{col.label}</h3>
                <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map(task => (
                  <TaskCard key={task.id} task={task} members={members} onDelete={handleDeleteTask} onUpdate={() => {}} />
                ))}
                <button
                  onClick={() => { setSelectedPhase(null); setShowTaskForm(true) }}
                  className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  + Add task
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
          onSuccess={() => setShowTaskForm(false)}
        />
      </Modal>

      <Modal open={showAiAgent} onClose={() => setShowAiAgent(false)} title="AI Agent Chat" subtitle="Ask AI to assign tasks, review progress, and give instructions" className="max-w-xl">
        <AiAgentChat project={project} tasks={tasks} members={members} onAssign={() => setRefreshKey(k => k + 1)} />
      </Modal>

      <Modal open={showAiModal} onClose={() => setShowAiModal(false)} title="AI Insights" className="max-w-2xl">
        <AiInsights project={project} tasks={tasks} />
      </Modal>
    </div>
  )
}
