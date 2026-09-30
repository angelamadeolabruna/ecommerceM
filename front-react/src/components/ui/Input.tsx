import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils.js';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  leftAddon?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, leftAddon, disabled, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex w-full flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
            {label}
          </label>
        ) : null}

        <div className="relative">
          {leftAddon ? (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center rounded-l-xl border border-r-0 border-ink-200 bg-ink-50 px-3 text-sm font-medium text-ink-500">
              {leftAddon}
            </span>
          ) : null}
          {icon ? (
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-400">
              {icon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              'h-11 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm text-ink-900 shadow-sm outline-none transition-all',
              'placeholder:text-ink-400',
              'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15',
              'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
              error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/10',
              icon && 'pl-10',
              leftAddon && 'pl-14',
              className,
            )}
            aria-invalid={error ? true : undefined}
            {...props}
          />
        </div>

        {error ? <p className="text-sm text-danger-600">{error}</p> : null}
        {!error && hint ? <p className="text-xs text-ink-400">{hint}</p> : null}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };