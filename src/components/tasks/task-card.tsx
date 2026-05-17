'use client'

import type { ProjectTask, Profile } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { isOverdue, formatDateShort, getInitials, priorityColor } from '@/lib/utils'

export function TaskCard({
  task,
  members,
  onDelete,
  onUpdate,
}: {
  task: ProjectTask
  members: Profile[]
  onDelete: (id: string) => void
  onUpdate: () => void
}) {
  const assignee = task.assignee_id ? members.find(m => m.id === task.assignee_id) : null

  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
      className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{task.title}</p>
        <button onClick={() => onDelete(task.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      {task.description && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{task.description}</p>}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge color={task.priority === 'urgent' ? 'red' : task.priority === 'high' ? 'amber' : task.priority === 'medium' ? 'blue' : 'gray'}>
            {task.priority}
          </Badge>
          {task.due_date && (
            <span className={`text-xs ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {formatDateShort(task.due_date)}
            </span>
          )}
        </div>
        {assignee && (
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700" title={assignee.name}>
            {getInitials(assignee.name)}
          </div>
        )}
      </div>
      {task.estimated_hours && (
        <p className="mt-1 text-xs text-gray-400">{task.estimated_hours}h estimated</p>
      )}
    </div>
  )
}
