import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils.js';

export type BadgeVariant = 'brand' | 'success' | 'danger' | 'warning' | 'neutral' | 'accent';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
  warning: 'bg-warning-50 text-amber-700 border-amber-200',
  neutral: 'bg-ink-50 text-ink-600 border-ink-200',
  accent: 'bg-accent-50 text-accent-800 border-accent-200',
};

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}