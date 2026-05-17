import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

const colorMap: Record<string, string> = {
  gray: 'text-notion-gray',
  blue: 'text-notion-blue',
  amber: 'text-notion-orange',
  green: 'text-notion-green',
  red: 'text-notion-red',
  purple: 'text-notion-purple',
}

export function Badge({ children, color = 'gray', className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center text-xs font-medium',
      colorMap[color] || colorMap.gray,
      className,
    )}>
      {children}
    </span>
  )
}
