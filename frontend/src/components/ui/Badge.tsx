import { cn } from '@/lib/cn';

const colorMap: Record<string, string> = {
  green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  yellow: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  red: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  gray: 'bg-white/5 text-zinc-400 border-white/10',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const recommendationColors: Record<string, string> = {
  STRONG_HIRE: 'green',
  HIRE: 'blue',
  BORDERLINE: 'yellow',
  NO_HIRE: 'red',
};

interface BadgeProps {
  children: string;
  color?: keyof typeof colorMap;
  className?: string;
}

export default function Badge({ children, color = 'gray', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-block text-xs px-2 py-1 rounded-full font-medium border',
      colorMap[color] ?? colorMap.gray,
      className,
    )}>
      {children}
    </span>
  );
}

export function RecommendationBadge({ recommendation, className }: { recommendation: string; className?: string }) {
  const color = recommendationColors[recommendation] ?? 'gray';
  return (
    <Badge color={color as keyof typeof colorMap} className={className}>
      {recommendation.replace(/_/g, ' ')}
    </Badge>
  );
}
