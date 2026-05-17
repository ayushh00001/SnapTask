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
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          'block w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text-primary',
          'placeholder:text-text-muted',
          'transition-all duration-150',
          'focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
          'disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed',
          error && 'border-red-400 focus:border-red-400 focus:ring-red-500/20',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
export { Input }
