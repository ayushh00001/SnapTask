import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

const colorMap: Record<string, string> = {
  gray: 'text-notion-gray bg-gray-50/50',
  blue: 'text-notion-blue bg-blue-50/50',
  amber: 'text-notion-orange bg-amber-50/50',
  green: 'text-notion-green bg-green-50/50',
  red: 'text-notion-red bg-red-50/50',
  purple: 'text-notion-purple bg-purple-50/50',
}

export function Badge({ children, color = 'gray', className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-md transition-all duration-150',
      colorMap[color] || colorMap.gray,
      className,
    )}>
      {children}
    </span>
  )
}
