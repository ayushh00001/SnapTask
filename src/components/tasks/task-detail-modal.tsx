'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ProjectTask, SubTask, TaskComment, Profile } from '@/lib/types'
import { formatDateShort, isOverdue, getInitials } from '@/lib/utils'
import { toast } from 'sonner'

export function TaskDetailModal({
  task,
  members,
  open,
  onClose,
  onUpdate,
  allTasks,
}: {
  task: ProjectTask
  members: Profile[]
  open: boolean
  onClose: () => void
  onUpdate: () => void
  allTasks?: ProjectTask[]
}) {
  const [subtasks, setSubtasks] = useState<SubTask[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [status, setStatus] = useState<string>(task.status)
  const [priority, setPriority] = useState<string>(task.priority)
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '')
  const [dependsOn, setDependsOn] = useState<string[]>(task.depends_on || [])
  const [saving, setSaving] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const commentRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!open) return
    supabase.from('subtasks').select('*').eq('task_id', task.id).order('created_at').then(({ data }) => setSubtasks(data || []))
    supabase.from('task_comments').select('*, profile:user_id(id, email, name, avatar_url, created_at)').eq('task_id', task.id).order('created_at').then(({ data }) => setComments(data || []))
  }, [task.id, open])

  const handleUpdate = async (field: string, value: string) => {
    setSaving(true)
    const { error } = await supabase.from('tasks').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', task.id)
    if (error) toast.error(error.message)
    else onUpdate()
    setSaving(false)
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return

    const processedContent = newComment.replace(/@(\w+)/g, (match, name) => {
      const member = members.find(m => m.name.toLowerCase().includes(name.toLowerCase()))
      return member ? `[@${member.name}](user:${member.id})` : match
    })

    await supabase.from('task_comments').insert({
      task_id: task.id, user_id: user.user.id, content: processedContent,
    })
    const { data } = await supabase.from('task_comments').select('*, profile:user_id(id, email, name, avatar_url, created_at)').eq('task_id', task.id).order('created_at')
    setComments(data || [])
    setNewComment('')
  }

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return
    await supabase.from('subtasks').insert({ task_id: task.id, title: newSubtask })
    const { data } = await supabase.from('subtasks').select('*').eq('task_id', task.id).order('created_at')
    setSubtasks(data || [])
    setNewSubtask('')
  }

  const toggleSubtask = async (st: SubTask) => {
    await supabase.from('subtasks').update({ completed: !st.completed }).eq('id', st.id)
    setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, completed: !s.completed } : s))
  }

  const deleteSubtask = async (id: string) => {
    await supabase.from('subtasks').delete().eq('id', id)
    setSubtasks(prev => prev.filter(s => s.id !== id))
  }

  const handleCommentChange = (value: string) => {
    setNewComment(value)
    const atIndex = value.lastIndexOf('@')
    if (atIndex >= 0) {
      const search = value.slice(atIndex + 1)
      if (!search.includes(' ')) {
        setMentionSearch(search)
        setShowMentions(true)
        return
      }
    }
    setShowMentions(false)
  }

  const insertMention = (name: string) => {
    const atIndex = newComment.lastIndexOf('@')
    const before = newComment.slice(0, atIndex)
    setNewComment(before + `@${name} `)
    setShowMentions(false)
    commentRef.current?.focus()
  }

  const handleDependencyChange = async (taskId: string, add: boolean) => {
    let newDeps: string[]
    if (add) newDeps = [...dependsOn, taskId]
    else newDeps = dependsOn.filter(id => id !== taskId)

    setDependsOn(newDeps)
    const { error } = await supabase.from('tasks').update({ depends_on: newDeps, updated_at: new Date().toISOString() }).eq('id', task.id)
    if (error) toast.error(error.message)
    else onUpdate()
  }

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(mentionSearch.toLowerCase())
  )

  const completedSubtasks = subtasks.filter(s => s.completed).length
  const dependentTasks = allTasks?.filter(t => dependsOn.includes(t.id)) || []
  const blockingTasks = allTasks?.filter(t => t.depends_on?.includes(task.id)) || []
  const availableDeps = allTasks?.filter(t => t.id !== task.id && !dependsOn.includes(t.id)) || []

  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge color={task.priority === 'urgent' ? 'red' : task.priority === 'high' ? 'amber' : task.priority === 'medium' ? 'blue' : 'gray'}>{task.priority}</Badge>
              {task.due_date && (
                <span className={`text-xs font-medium ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-red-600' : 'text-text-muted'}`}>
                  Due {formatDateShort(task.due_date)}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-text-primary">{task.title}</h3>
          </div>
        </div>

        {task.description && (
          <div className={`rounded-xl p-4 ${task.description.startsWith('**How to do this task:**') ? 'bg-notion-bg-hover border border-notion-border' : 'bg-surface-muted'}`}>
            {task.description.startsWith('**How to do this task:**') ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-sm font-semibold text-notion-text">AI Supervisor Guidance</span>
                </div>
                <div className="text-sm text-notion-text-secondary leading-relaxed whitespace-pre-line">
                  {task.description.split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={i} className="font-semibold text-notion-text mb-1">{line.replace(/\*\*/g, '')}</p>
                    }
                    if (line.match(/^\d+\./)) {
                      return <p key={i} className="text-sm text-notion-text-secondary ml-4 mb-0.5">{line}</p>
                    }
                    return <p key={i} className="text-sm text-notion-text-secondary mb-0.5">{line}</p>
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary leading-relaxed">{task.description}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Select id="task-status" label="Status" value={status} onChange={e => { setStatus(e.target.value); handleUpdate('status', e.target.value) }} options={[
            { value: 'backlog', label: 'Backlog' }, { value: 'todo', label: 'To Do' },
            { value: 'in_progress', label: 'In Progress' }, { value: 'review', label: 'Review' },
            { value: 'done', label: 'Done' },
          ]} />
          <Select id="task-priority" label="Priority" value={priority} onChange={e => { setPriority(e.target.value); handleUpdate('priority', e.target.value) }} options={[
            { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
          ]} />
          {members.length > 0 && (
            <Select id="task-assignee" label="Assignee" value={assigneeId} onChange={e => { setAssigneeId(e.target.value); handleUpdate('assignee_id', e.target.value) }} options={[
              { value: '', label: 'Unassigned' },
              ...members.map(m => ({ value: m.id, label: m.name })),
            ]} />
          )}
          {task.estimated_hours && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Estimated time</label>
              <div className="rounded-xl border border-border bg-white dark:bg-notion-bg-secondary px-4 py-2.5 text-sm text-text-primary">{task.estimated_hours}h</div>
            </div>
          )}
        </div>

        {allTasks && allTasks.length > 0 && (
          <div className="border-t border-border-light pt-5">
            <h4 className="text-sm font-semibold text-text-primary mb-3">Dependencies</h4>
            {dependentTasks.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-text-muted mb-1">Depends on:</p>
                {dependentTasks.map(dt => (
                  <div key={dt.id} className="flex items-center gap-2 py-1">
                    <div className={`w-2 h-2 rounded-full ${dt.status === 'done' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    <span className="text-sm text-text-primary flex-1">{dt.title}</span>
                    <button onClick={() => handleDependencyChange(dt.id, false)} className="text-xs text-notion-text-muted hover:text-red-500">Remove</button>
                  </div>
                ))}
              </div>
            )}
            {availableDeps.length > 0 && (
              <div>
                <p className="text-xs text-text-muted mb-1">Add dependency:</p>
                <select
                  onChange={e => { if (e.target.value) handleDependencyChange(e.target.value, true) }}
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm"
                  value=""
                >
                  <option value="">Select task...</option>
                  {availableDeps.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            )}
            {blockingTasks.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-text-muted mb-1">Blocks:</p>
                {blockingTasks.map(bt => (
                  <div key={bt.id} className="text-sm text-text-secondary">- {bt.title}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-border-light pt-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-text-primary">Subtasks ({completedSubtasks}/{subtasks.length})</h4>
          </div>
          {subtasks.length > 0 && (
            <div className="space-y-1 mb-3">
              {subtasks.map(st => (
                <div key={st.id} className="flex items-center gap-3 py-1.5 group">
                  <button
                    onClick={() => toggleSubtask(st)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      st.completed ? 'bg-brand-500 border-brand-500' : 'border-border hover:border-brand-400'
                    }`}
                  >
                    {st.completed && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <span className={`text-sm flex-1 ${st.completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>{st.title}</span>
                  <button onClick={() => deleteSubtask(st.id)} className="text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={e => { e.preventDefault(); handleAddSubtask() }} className="flex gap-2">
            <Input placeholder="Add subtask..." value={newSubtask} onChange={e => setNewSubtask(e.target.value)} />
            <Button type="submit" variant="secondary" size="sm" disabled={!newSubtask.trim()}>Add</Button>
          </form>
        </div>

        <div className="border-t border-border-light pt-5">
          <h4 className="text-sm font-semibold text-text-primary mb-4">Comments ({comments.length})</h4>
          <div className="space-y-4 mb-4 max-h-48 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-4">No comments yet. Use @name to mention someone.</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 flex-shrink-0">
                    {getInitials((c as unknown as { profile: Profile }).profile?.name || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{(c as unknown as { profile: Profile }).profile?.name || 'Unknown'}</span>
                      <span className="text-xs text-text-muted">{formatDateShort(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5">
                      {(c.content || '').split(/(\[@\w+\]\(user:[^)]+\))/).map((part, i) => {
                        const mentionMatch = part.match(/\[@(\w+)\]\(user:([^)]+)\)/)
                        if (mentionMatch) {
                          return <span key={i} className="text-brand-600 font-medium bg-brand-50 dark:bg-brand-900/20 px-1 rounded">@{mentionMatch[1]}</span>
                        }
                        return <span key={i}>{part}</span>
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="relative">
            <form onSubmit={e => { e.preventDefault(); handleAddComment() }} className="flex gap-2">
              <Input
                ref={commentRef}
                placeholder="Write a comment... Use @name to mention"
                value={newComment}
                onChange={e => handleCommentChange(e.target.value)}
              />
              <Button type="submit" variant="secondary" size="sm" disabled={!newComment.trim()}>Send</Button>
            </form>
            {showMentions && filteredMembers.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-notion-bg-secondary border border-notion-border rounded-lg shadow-xl p-1 z-50 max-h-32 overflow-y-auto">
                {filteredMembers.slice(0, 5).map(m => (
                  <button
                    key={m.id}
                    onClick={() => insertMention(m.name)}
                    className="block w-full text-left px-2.5 py-1 text-sm text-notion-text hover:bg-notion-bg-hover rounded transition-colors"
                  >
                    @{m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
