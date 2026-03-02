import { cn } from '@/lib/cn';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
  color?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  label,
  showValue,
  className,
  color,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn('space-y-1', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-zinc-400">{label}</span>}
          {showValue && <span className="text-zinc-100 font-medium">{value}/{max}</span>}
        </div>
      )}
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            color ?? 'bg-gradient-to-r from-purple-500 to-violet-500',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
