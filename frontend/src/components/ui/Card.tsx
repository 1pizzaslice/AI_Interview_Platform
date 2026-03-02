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
        'bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4',
        interactive && 'hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)] active:scale-[0.99] transition-all duration-200 cursor-pointer',
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
      className={cn('bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 space-y-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
