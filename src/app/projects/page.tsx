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
          project_id: project.id, name: phase.name, order: phase.order,
        }).select().single()
        if (phaseData) {
          const phaseTasks = plan.tasks.filter(t => t.phase === phase.name)
          for (const task of phaseTasks) {
            await supabase.from('tasks').insert({
              project_id: project.id, phase_id: phaseData.id, title: task.title,
              priority: task.priority || 'medium', status: 'todo', created_by: userData.user.id,
              estimated_hours: task.estimated_hours,
            })
          }
        }
      }
      toast.success('Project created with AI!')
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
          <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
          <p className="text-text-secondary text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New project</Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-surface-muted flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">No projects yet</h3>
            <p className="text-text-secondary text-sm mb-6">Create your first project — type a description and AI builds the plan</p>
            <Button onClick={() => setShowCreate(true)}>Create project</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <button key={project.id} onClick={() => router.push(`/projects/${project.id}`)} className="text-left group">
              <Card className="h-full hover:shadow-md transition-all duration-200 border-border-light hover:border-border">
                <CardContent className="p-6">
                  {project.photo_url && (
                    <img src={project.photo_url} alt="" className="w-full h-32 object-cover rounded-xl mb-4" />
                  )}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-text-primary truncate group-hover:text-brand-600 transition-colors">{project.name}</h3>
                    <Badge color={statusColor(project.status)} className="capitalize flex-shrink-0">{project.status}</Badge>
                  </div>
                  {project.description && (
                    <p className="text-sm text-text-secondary line-clamp-2">{project.description}</p>
                  )}
                  <div className="mt-4 pt-4 border-t border-border-light flex items-center justify-between text-xs text-text-muted">
                    <span>Created {formatDateShort(project.created_at)}</span>
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
