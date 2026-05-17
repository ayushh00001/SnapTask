import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

const colorMap: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}

export function Badge({ children, color = 'gray', className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium',
      'transition-colors duration-150',
      colorMap[color] || colorMap.gray,
      className,
    )}>
      {children}
    </span>
  )
}
