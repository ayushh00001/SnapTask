import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  primary: 'bg-notion-text text-white hover:bg-[#2a2722] active:bg-[#1e1c18]',
  secondary: 'bg-notion-bg text-notion-text border border-notion-border hover:bg-notion-bg-hover active:bg-notion-bg-selected',
  ghost: 'text-notion-text-secondary hover:bg-notion-bg-hover hover:text-notion-text active:bg-notion-bg-selected',
  danger: 'bg-notion-danger text-white hover:bg-notion-danger-hover active:bg-[#c02a29]',
  accent: 'text-notion-accent hover:bg-[#edf6ff] active:bg-[#d9e7f7]',
} as const

const sizes = {
  sm: 'px-2.5 py-1 text-xs rounded',
  md: 'px-3 py-1.5 text-sm rounded',
  lg: 'px-4 py-2 text-sm rounded',
  icon: 'p-1.5 rounded',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notion-accent focus-visible:ring-offset-1',
        'disabled:opacity-40 disabled:pointer-events-none',
        'select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
export { Button }
