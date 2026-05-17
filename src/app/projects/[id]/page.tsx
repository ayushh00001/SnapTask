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
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: projectData } = await supabase.from('projects').select('*').eq('id', id).single()
      if (!projectData) { router.push('/projects'); return }
      setProject(projectData)

      const [phasesRes, tasksRes] = await Promise.all([
        supabase.from('project_phases').select('*').eq('project_id', id).order('order'),
        supabase.from('tasks').select('*, assignee:assignee_id(id, email, name, avatar_url, created_at)').eq('project_id', id),
      ])
      setPhases(phasesRes.data || [])
      setTasks(tasksRes.data || [])

      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1)
        if (orgs?.length) {
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
  }, [id, router])

  const handleDrop = async (taskId: string, newStatus: string) => {
    const supabase = createClient()
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as ProjectTask['status'] } : t))
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
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <Badge color={statusColor(project.status)} className="capitalize">{project.status}</Badge>
          </div>
          {project.description && <p className="mt-1 text-gray-500">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowAiModal(true)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Insights
          </Button>
          <Button variant="secondary" onClick={() => { setSelectedPhase(null); setShowTaskForm(true) }}>Add task</Button>
          <Button variant="danger" onClick={handleDeleteProject}>Delete</Button>
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

      <Modal open={showAiModal} onClose={() => setShowAiModal(false)} title="AI Insights" className="max-w-2xl">
        <AiInsights project={project} tasks={tasks} />
      </Modal>
    </div>
  )
}
