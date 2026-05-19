import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

const colorMap: Record<string, string> = {
  gray: 'text-gray bg-gray-100/70 dark:bg-gray-900/30',
  blue: 'text-blue bg-blue-100/70 dark:bg-blue-900/30',
  amber: 'text-orange bg-orange-100/70 dark:bg-orange-900/30',
  green: 'text-green bg-green-100/70 dark:bg-green-900/30',
  red: 'text-danger bg-danger-soft dark:bg-rose-900/30',
  purple: 'text-purple bg-purple-100/70 dark:bg-purple-900/30',
}

export function Badge({ children, color = 'gray', className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full transition-all',
      colorMap[color] || colorMap.gray,
      className,
    )}>
      {children}
    </span>
  )
}
