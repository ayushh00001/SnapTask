'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ProjectPhase, Profile } from '@/lib/types'
import { toast } from 'sonner'

export interface CreateTaskResult {
  id: string
  project_id: string
  phase_id: string | null
  title: string
  description: string | null
  priority: string
  status: string
  assignee_id: string | null
  due_date: string | null
  estimated_hours: number | null
  created_by: string | null
}

export function NewTaskForm({
  projectId,
  phases,
  members,
  selectedPhase,
  onSuccess,
}: {
  projectId: string
  phases: ProjectPhase[]
  members: Profile[]
  selectedPhase: string | null
  onSuccess: (task: CreateTaskResult) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [status, setStatus] = useState('todo')
  const [phaseId, setPhaseId] = useState(selectedPhase || '')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [hours, setHours] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const { data: inserted, error } = await supabase.from('tasks').insert({
      project_id: projectId,
      phase_id: phaseId || null,
      title: title.trim(),
      description: description || null,
      priority,
      status,
      assignee_id: assigneeId || null,
      created_by: userData.user?.id,
      due_date: dueDate || null,
      estimated_hours: hours ? parseFloat(hours) : null,
    }).select()
    if (error) { toast.error(error.message); setLoading(false); return }
    if (!inserted || inserted.length === 0) { toast.error('Task was not created'); setLoading(false); return }
    toast.success('Task added')
    onSuccess(inserted[0])
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input id="taskTitle" label="Title" value={title} onChange={e => setTitle(e.target.value)} required placeholder="What needs to be done?" />
      <div className="space-y-1">
        <label className="block text-xs font-medium text-notion-text-secondary">Description</label>
        <textarea
          className="block w-full border border-notion-border bg-notion-bg px-3 py-1.5 text-sm text-notion-text placeholder:text-notion-text-muted focus:border-notion-accent focus:outline-none min-h-[80px]"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select id="priority" label="Priority" value={priority} onChange={e => setPriority(e.target.value)} options={[
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' },
        ]} />
        <Select id="status" label="Status" value={status} onChange={e => setStatus(e.target.value)} options={[
          { value: 'backlog', label: 'Backlog' },
          { value: 'todo', label: 'To Do' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'review', label: 'Review' },
          { value: 'done', label: 'Done' },
        ]} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {phases.length > 0 && (
          <Select id="phase" label="Phase" value={phaseId} onChange={e => setPhaseId(e.target.value)} options={[
            { value: '', label: 'No phase' },
            ...phases.map(p => ({ value: p.id, label: p.name })),
          ]} />
        )}
        {members.length > 0 && (
          <Select id="assignee" label="Assignee" value={assigneeId} onChange={e => setAssigneeId(e.target.value)} options={[
            { value: '', label: 'Unassigned' },
            ...members.map(m => ({ value: m.id, label: m.name })),
          ]} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input id="dueDate" label="Due date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        <Input id="hours" label="Est. hours" type="number" value={hours} onChange={e => setHours(e.target.value)} min="0" step="0.5" />
      </div>
      <Button type="submit" loading={loading} className="w-full">Add task</Button>
    </form>
  )
}
