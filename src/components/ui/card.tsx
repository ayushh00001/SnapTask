import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function Card({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={cn(
      'border border-notion-border bg-notion-card transition-colors duration-100',
      hover && 'hover:bg-notion-bg-hover cursor-pointer',
      className,
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-3.5 border-b border-notion-border', className)}>
      {children}
    </div>
  )
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-3.5', className)}>
      {children}
    </div>
  )
}
