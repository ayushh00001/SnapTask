'use client'

import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, placeholder, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          className={cn(
            'block w-full rounded-xl border border-border bg-white dark:bg-surface px-3.5 py-2 pr-9 text-sm text-text',
            'transition-all duration-150 appearance-none',
            'focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/10',
            error && 'border-danger focus:border-danger/40 focus:ring-danger/10',
            className,
          )}
          {...props}
        >
          {placeholder && <option value="" className="text-text-muted">{placeholder}</option>}
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {error && <p className="text-xs text-danger font-medium">{error}</p>}
    </div>
  ),
)
Select.displayName = 'Select'
export { Select }
