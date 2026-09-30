import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils.js';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-ink-200/70', className)}
      aria-hidden="true"
      {...props}
    />
  );
}