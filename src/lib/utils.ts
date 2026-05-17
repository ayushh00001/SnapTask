import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2, 15)
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural || `${singular}s`
}

export function formatDate(date: string | Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(date: string | Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function isOverdue(date: string | Date | null): boolean {
  if (!date) return false
  return new Date(date) < new Date()
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len) + '...'
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    backlog: 'bg-gray-400',
    todo: 'bg-blue-400',
    in_progress: 'bg-amber-400',
    review: 'bg-purple-400',
    done: 'bg-emerald-400',
    planning: 'bg-gray-400',
    active: 'bg-blue-400',
    paused: 'bg-amber-400',
    completed: 'bg-emerald-400',
  }
  return map[status] || 'bg-gray-400'
}

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    low: 'text-gray-400',
    medium: 'text-blue-500',
    high: 'text-amber-500',
    urgent: 'text-red-500',
  }
  return map[priority] || 'text-gray-400'
}
