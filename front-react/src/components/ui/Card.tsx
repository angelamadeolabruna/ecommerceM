import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils.js';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(({ className, hoverable = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-2xl border border-ink-100 bg-white shadow-card',
      hoverable &&
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover hover:border-ink-200',
      className,
    )}
    {...props}
  />
));

Card.displayName = 'Card';

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-0', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-bold text-ink-900', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-ink-500', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 p-5 pt-0', className)} {...props} />;
}

export { Card };