'use client'

import { type ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEsc)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
      <div className="fixed inset-0 bg-[#37352f]/60 animate-fade-in" onClick={onClose} />
      <div className={cn(
        'relative bg-notion-bg max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-xl animate-scale-in',
        className,
      )}>
        {title && (
          <div className="flex items-start justify-between px-5 py-4 border-b border-notion-border">
            <div>
              <h2 className="text-sm font-semibold text-notion-text">{title}</h2>
              {subtitle && <p className="text-xs text-notion-text-secondary mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-1 rounded text-notion-text-muted hover:bg-notion-bg-hover hover:text-notion-text transition-colors -mr-1 -mt-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
