import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export default function LoadingSkeleton({ className, lines = 1 }: SkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 bg-white/5 rounded animate-shimmer bg-[length:200%_100%] bg-shimmer-gradient',
            i === lines - 1 && lines > 1 && 'w-3/4',
          )}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white/5 border border-white/10 rounded-xl p-4 space-y-3', className)}>
      <div className="h-5 bg-white/5 rounded animate-shimmer bg-[length:200%_100%] bg-shimmer-gradient w-1/3" />
      <div className="space-y-2">
        <div className="h-4 bg-white/5 rounded animate-shimmer bg-[length:200%_100%] bg-shimmer-gradient" />
        <div className="h-4 bg-white/5 rounded animate-shimmer bg-[length:200%_100%] bg-shimmer-gradient w-5/6" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto space-y-6">
      <div className="h-8 bg-white/5 rounded animate-shimmer bg-[length:200%_100%] bg-shimmer-gradient w-1/3" />
      <div className="h-4 bg-white/5 rounded animate-shimmer bg-[length:200%_100%] bg-shimmer-gradient w-2/3" />
      <div className="grid grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="space-y-3">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
