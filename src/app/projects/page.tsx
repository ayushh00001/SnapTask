'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
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

interface ProjectTemplate {
  id: string
  name: string
  description: string | null
  category: string
  phases: { name: string; order: number }[]
  tasks: { title: string; phase: string; priority: string; estimated_hours: number; instructions: string }[]
  usage_count: number
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; done: number }>>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [showSlackParse, setShowSlackParse] = useState(false)
  const [slackInput, setSlackInput] = useState('')
  const [slackLoading, setSlackLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    if (showTemplates) {
      const supabase = createClient()
      supabase.from('project_templates').select('*').order('usage_count', { ascending: false }).limit(20).then(({ data }) => setTemplates(data || []))
    }
  }, [showTemplates])

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handlePhotoSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (max 10MB)'); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    const b64 = await fileToBase64(file)
    setPhotoBase64(b64)
  }

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition
    if (!SpeechRecognition) { toast.error('Voice input not supported in this browser'); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false

    setIsRecording(true)
    recognition.start()

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('')
      setNewDesc(prev => prev + ' ' + transcript)
    }

    recognition.onerror = () => {
      setIsRecording(false)
      toast.error('Voice input failed. Try typing instead.')
    }

    recognition.onend = () => {
      setIsRecording(false)
    }
  }

  const handleCreate = async () => {
    if (!newDesc.trim() && !photoFile) { toast.error('Describe what you want to build'); return }
    setAiLoading(true)
    try {
      setProgressMsg('AI is analyzing your project...')
      const plan = await extractTasksFromText(newDesc || (photoFile ? 'Build from uploaded image' : ''), (msg) => setProgressMsg(msg), photoBase64 || undefined)

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

      let photoUrl: string | null = null
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const path = `${orgId}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('project-photos')
          .upload(path, photoFile)
        if (!uploadErr) {
          const { data: urlData } = await supabase.storage
            .from('project-photos')
            .getPublicUrl(path)
          photoUrl = urlData?.publicUrl || null
        }
      }

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
        photo_url: photoUrl,
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
      setShowCreate(false); setNewDesc(''); setPhotoFile(null); setPhotoPreview(null); setPhotoBase64(null)
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
      <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Projects</h1>
          <p className="text-sm text-text-secondary mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New project
        </Button>
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
            <Link key={project.id} href={`/projects/${project.id}`} className="block group animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
              <Card className="h-full hover:shadow-lg hover:-translate-y-0.5">
                <CardContent className="p-0">
                  {project.photo_url && (
                    <div className="rounded-t-2xl overflow-hidden h-32">
                      <img src={project.photo_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-semibold text-sm text-text truncate group-hover:text-accent transition-colors">{project.name}</h3>
                      <Badge color={statusColor(project.status)} className="capitalize flex-shrink-0">{project.status}</Badge>
                    </div>
                    {taskCounts[project.id] && taskCounts[project.id].total > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="text-text-muted">{taskCounts[project.id].done}/{taskCounts[project.id].total} done</span>
                          <span className="font-semibold text-accent">{Math.round(taskCounts[project.id].done / taskCounts[project.id].total * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent to-purple transition-all duration-700"
                            style={{ width: `${taskCounts[project.id].done / taskCounts[project.id].total * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
                      <span>Created {formatDateShort(project.created_at)}</span>
                      {taskCounts[project.id]?.total ? <span>{taskCounts[project.id].total} task{taskCounts[project.id].total !== 1 ? 's' : ''}</span> : <span>0 tasks</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setAiLoading(false); setNewDesc(''); setPhotoFile(null); setPhotoPreview(null); setPhotoBase64(null) }} title="Create project" subtitle="Describe what you want to build — AI does the rest">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Describe your project</label>
            <textarea
              className="block w-full rounded-xl border border-border bg-white dark:bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/10 min-h-[120px] transition-all duration-150"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Example: Build a landing page for my SaaS startup with pricing, features, and a contact form."
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handlePhotoSelect(e.dataTransfer.files[0]) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-text-secondary hover:bg-bg-hover hover:border-border-hover transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Add photo
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handlePhotoSelect(e.target.files[0]) }}
            />
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={isRecording}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                isRecording
                  ? 'border-danger/40 bg-danger-soft text-danger animate-pulse'
                  : 'border-border text-text-secondary hover:bg-bg-hover hover:border-border-hover'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {isRecording ? 'Recording...' : 'Voice input'}
            </button>
          </div>

          {photoPreview && (
            <div className="relative rounded-xl overflow-hidden border border-border">
              <img src={photoPreview} alt="Upload preview" className="max-h-48 w-full object-contain bg-bg-secondary" />
              <button
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoBase64(null) }}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </Link>
            </div>
          )}

          <p className="text-xs text-text-muted">AI will research your project, analyze photos, and create tasks with step-by-step instructions.</p>

          <div className="flex gap-2 mt-1">
            <button
              onClick={() => { setShowTemplates(true); setShowCreate(false) }}
              className="text-xs text-text-muted hover:text-text hover:bg-bg-hover px-2 py-1 rounded-lg transition-colors"
            >
              From template
            </button>
            <button
              onClick={() => { setShowSlackParse(true); setShowCreate(false) }}
              className="text-xs text-text-muted hover:text-text hover:bg-bg-hover px-2 py-1 rounded-lg transition-colors"
            >
              Import email/Slack
            </button>
          </div>
          {aiLoading && progressMsg && (
            <div className="flex items-center gap-2 text-sm text-accent font-medium">
              <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              {progressMsg}
            </div>
          )}
          <Button onClick={handleCreate} loading={aiLoading} className="w-full" disabled={!newDesc.trim() && !photoFile}>
            {aiLoading ? (progressMsg || 'Working...') : 'Create project with AI'}
          </Button>
        </div>
      </Modal>

      <Modal open={showTemplates} onClose={() => setShowTemplates(false)} title="Project Templates" subtitle="Start from a pre-built template">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-text-muted mb-2">No templates yet</p>
              <p className="text-xs text-text-muted">Save a project as a template to get started</p>
            </div>
          ) : templates.map(t => (
            <button
              key={t.id}
              onClick={async () => {
                setShowTemplates(false)
                const supabase = createClient()
                const { data: userData } = await supabase.auth.getUser()
                if (!userData.user) return
                const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1)
                if (!orgs?.length) return
                const orgId = orgs[0].org_id
                const { data: project, error: projErr } = await supabase.from('projects').insert({
                  org_id: orgId, name: t.name, description: t.description || '', status: 'active', created_by: userData.user.id,
                }).select().single()
                if (projErr || !project) { toast.error('Failed to create project from template'); return }
                for (const phase of t.phases) {
                  const { data: phaseData } = await supabase.from('project_phases').insert({
                    project_id: project.id, name: phase.name, order: phase.order,
                  }).select().single()
                  if (phaseData) {
                    const ptasks = t.tasks.filter((tk: { phase: string }) => tk.phase === phase.name)
                    for (const task of ptasks) {
                      await supabase.from('tasks').insert({
                        project_id: project.id, phase_id: phaseData.id, title: task.title,
                        priority: task.priority || 'medium', status: 'todo', created_by: userData.user.id,
                        estimated_hours: task.estimated_hours, description: task.instructions || null,
                      })
                    }
                  }
                }
                await supabase.from('project_templates').update({ usage_count: t.usage_count + 1 }).eq('id', t.id)
                toast.success(`Project created from "${t.name}" template!`)
                router.push(`/projects/${project.id}`)
              }}
              className="w-full text-left p-4 rounded-xl border border-border hover:border-accent/20 hover:bg-accent-soft/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-text group-hover:text-accent transition-colors">{t.name}</span>
                  <span className="ml-2 text-xs text-text-muted capitalize">({t.category})</span>
                </div>
                <span className="text-xs text-text-muted bg-bg-secondary px-2 py-0.5 rounded-full">{t.usage_count} uses</span>
              </div>
              {t.description && <p className="text-xs text-text-secondary mt-1.5 line-clamp-1">{t.description}</p>}
              <p className="text-xs text-text-muted mt-1.5">{t.phases.length} phases &middot; {t.tasks.length} tasks</p>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={showSlackParse} onClose={() => setShowSlackParse(false)} title="Import from Email or Slack" subtitle="Paste email or Slack message content — AI extracts tasks">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Paste email or Slack message</label>
            <textarea
              className="block w-full rounded-xl border border-border bg-white dark:bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/10 min-h-[180px] transition-all duration-150"
              value={slackInput}
              onChange={e => setSlackInput(e.target.value)}
              placeholder="Paste an email thread, Slack message, or meeting notes here...&#10;&#10;Example:&#10;'Hey team, we need to build a landing page this sprint.&#10;Tasks:&#10;- Design homepage mockup&#10;- Set up contact form&#10;- Write copy for about page&#10;- Deploy to Vercel'"
              autoFocus
            />
          </div>
          {slackLoading && (
            <div className="flex items-center gap-2 text-sm text-accent font-medium">
              <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              AI is extracting tasks...
            </div>
          )}
          <Button
            onClick={async () => {
              if (!slackInput.trim()) return
              setSlackLoading(true)
              try {
                const plan = await extractTasksFromText(
                  `Extract tasks from this message:\n\n${slackInput}`,
                  (msg) => setProgressMsg(msg)
                )
                if (plan.tasks.length > 0) {
                  setNewDesc(slackInput)
                  setSlackInput('')
                  setShowSlackParse(false)
                  setShowCreate(true)
                  toast.success(`Extracted ${plan.tasks.length} tasks from message!`)
                } else {
                  toast.error('Could not extract tasks. Try a more detailed message.')
                }
              } catch (e) {
                toast.error('Failed to parse message')
              }
              setSlackLoading(false)
            }}
            loading={slackLoading}
            className="w-full"
            disabled={!slackInput.trim()}
          >
            Extract tasks
          </Button>
        </div>
      </Modal>
    </div>
  )
}

interface ISpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult
  length: number
  [Symbol.iterator]: () => Iterator<SpeechRecognitionResult>
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
  length: number
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
