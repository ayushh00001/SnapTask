'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import type { Project } from '@/lib/types'
import { formatDateShort, statusColor } from '@/lib/utils'
import { toast } from 'sonner'
import { extractTasksFromText } from '@/lib/ai/gemini'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
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
    setShowCreate(false)
    setNewName('')
    setNewDesc('')
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

      const { data: project, error } = await supabase.from('projects').insert({
        org_id: orgId,
        name: plan.projectName || newName || 'Untitled',
        description: plan.description || newDesc,
        status: 'planning',
        created_by: userData.user.id,
      }).select().single()
      if (error) { toast.error(error.message); return }

      for (const phase of plan.phases) {
        const { data: phaseData } = await supabase.from('project_phases').insert({
          project_id: project.id,
          name: phase.name,
          order: phase.order,
        }).select().single()
        if (phaseData) {
          const phaseTasks = plan.tasks.filter(t => t.phase === phase.name)
          for (const task of phaseTasks) {
            await supabase.from('tasks').insert({
              project_id: project.id,
              phase_id: phaseData.id,
              title: task.title,
              priority: task.priority || 'medium',
              status: 'todo',
              created_by: userData.user.id,
              estimated_hours: task.estimated_hours,
            })
          }
        }
      }
      toast.success('Project created with AI!')
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      router.push(`/projects/${project.id}`)
    } catch (e) {
      toast.error('AI extraction failed. Try typing manually.')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{projects.length} projects</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New project</Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-6">Create your first project — type a description and AI builds the plan</p>
            <Button onClick={() => setShowCreate(true)}>Create project</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <button key={project.id} onClick={() => router.push(`/projects/${project.id}`)} className="text-left">
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  {project.photo_url && (
                    <img src={project.photo_url} alt="" className="w-full h-32 object-cover rounded-lg mb-4" />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
                    <Badge color={statusColor(project.status)} className="capitalize flex-shrink-0">{project.status}</Badge>
                  </div>
                  {project.description && <p className="mt-1 text-sm text-gray-500 line-clamp-2">{project.description}</p>}
                  <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                    <span>Created {formatDateShort(project.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setAiLoading(false) }} title="Create project">
        <div className="space-y-4">
          <Input id="pname" label="Project name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Q3 Marketing Campaign" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Describe your project</label>
            <textarea
              className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px]"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Describe what needs to be built, or paste meeting notes. AI will extract tasks..."
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleCreate} className="flex-1" disabled={!newName.trim()}>Create manually</Button>
            <Button onClick={handleAiCreate} variant="secondary" loading={aiLoading} className="flex-1" disabled={!newDesc.trim()}>
              {aiLoading ? 'AI is thinking...' : 'Generate with AI'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
