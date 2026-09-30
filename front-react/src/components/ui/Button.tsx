import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-ink-950 text-white hover:bg-ink-950/80 active:bg-ink-950/70 shadow-sm',
  secondary: 'bg-ink-100 text-ink-800 hover:bg-ink-200 active:bg-ink-300',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 shadow-sm',
  accent: 'bg-accent-500 text-ink-950 hover:bg-accent-600 active:bg-accent-700 shadow-sm',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-base gap-2.5',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', loading = false, fullWidth = false, disabled, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
          'active:scale-[0.98]',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" size={18} aria-hidden /> : null}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };