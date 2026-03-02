import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
}

export default function Card({ children, interactive, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white border rounded-lg p-4',
        interactive && 'hover:border-brand-500 transition-colors cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardLarge({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn('bg-white border rounded-xl p-6 space-y-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
