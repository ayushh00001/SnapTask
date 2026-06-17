'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          'block w-full rounded-xl border border-border bg-white dark:bg-surface px-3.5 py-2 text-sm text-text',
          'placeholder:text-text-muted',
          'transition-all duration-150',
          'focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/10',
          'disabled:bg-bg-secondary disabled:text-text-muted disabled:cursor-not-allowed',
          error && 'border-danger focus:border-danger/40 focus:ring-danger/10',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger font-medium">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
export { Input }
