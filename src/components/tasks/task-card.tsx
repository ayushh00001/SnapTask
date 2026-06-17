'use client'

import type { ProjectTask, Profile } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { isOverdue, formatDateShort, getInitials, priorityColor, cn } from '@/lib/utils'

export function TaskCard({
  task,
  members,
  onDelete,
  onClick,
  isTimerRunning,
  onStartTimer,
  onStopTimer,
}: {
  task: ProjectTask
  members: Profile[]
  onDelete: (id: string) => void
  onClick: (task: ProjectTask) => void
  isTimerRunning?: boolean
  onStartTimer?: (id: string) => void
  onStopTimer?: (id: string) => void
}) {
  const assignee = task.assignee_id ? members.find(m => m.id === task.assignee_id) : null

  const handleClick = () => onClick(task)

  const hasDependencies = task.depends_on && task.depends_on.length > 0

  return (
    <>
      <div
        draggable
        onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
        onClick={handleClick}
        className="bg-card px-3 py-2.5 rounded-xl border border-card-border cursor-grab active:cursor-grabbing hover:bg-bg-hover hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isTimerRunning && (
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse flex-shrink-0" title="Timer running" />
            )}
            {hasDependencies && (
              <svg className="w-3 h-3 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
            <p className="text-sm text-text font-medium truncate">{task.title}</p>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onStartTimer && onStopTimer && (
              <button
                onClick={e => { e.stopPropagation(); isTimerRunning ? onStopTimer(task.id) : onStartTimer(task.id) }}
                className={`p-1.5 rounded-lg transition-colors ${isTimerRunning ? 'text-danger hover:text-danger/80 bg-danger-soft' : 'text-text-muted hover:text-text opacity-0 group-hover:opacity-100'}`}
                title={isTimerRunning ? 'Stop timer' : 'Start timer'}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {isTimerRunning ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onDelete(task.id) }}
              className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger-soft opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        {task.description && (
          <p className="mt-1 text-xs text-text-secondary line-clamp-2">
            {task.description.startsWith('**How to do this task:**') ? (
              <span className="flex items-center gap-1 text-accent font-medium">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                AI instructions available
              </span>
            ) : task.description}
          </p>
        )}
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider',
              task.priority === 'urgent' ? 'bg-danger-soft text-danger' :
              task.priority === 'high' ? 'bg-orange-soft text-orange' :
              task.priority === 'medium' ? 'bg-blue-soft text-blue' :
              'bg-bg-secondary text-text-muted'
            )}>
              {task.priority}
            </span>
            {task.due_date && (
              <span className={`text-[11px] ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-danger font-medium' : 'text-text-muted'}`}>
                {formatDateShort(task.due_date)}
              </span>
            )}
          </div>
          {assignee && (
            <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-brand-400 to-accent flex items-center justify-center text-[9px] font-semibold text-white" title={assignee.name}>
              {getInitials(assignee.name)}
            </div>
          )}
        </div>
        {task.estimated_hours && (
          <div className="mt-2 pt-2 border-t border-border flex items-center text-[11px] text-text-muted">
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {task.estimated_hours}h estimated
          </div>
        )}
      </div>
    </>
  )
}


