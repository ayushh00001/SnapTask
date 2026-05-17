import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function Card({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border border-border bg-white shadow-sm transition-all duration-200',
      hover && 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
      className,
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-5 border-b border-border-light', className)}>
      {children}
    </div>
  )
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-5', className)}>
      {children}
    </div>
  )
}
