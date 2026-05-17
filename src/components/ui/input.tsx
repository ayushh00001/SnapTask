import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-notion-text-secondary">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          'block w-full border border-notion-border bg-notion-bg px-3 py-1.5 text-sm text-notion-text',
          'placeholder:text-notion-text-muted',
          'transition-colors duration-100',
          'focus:border-notion-accent focus:outline-none',
          'disabled:bg-notion-bg-secondary disabled:text-notion-text-muted disabled:cursor-not-allowed',
          error && 'border-notion-danger focus:border-notion-danger',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-notion-danger font-medium">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
export { Input }
