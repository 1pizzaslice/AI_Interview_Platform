import { cn } from '@/lib/cn';

const colorMap: Record<string, string> = {
  green: 'bg-green-100 text-green-800 border-green-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
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
