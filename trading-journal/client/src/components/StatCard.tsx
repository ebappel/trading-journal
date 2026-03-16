import { cn } from '../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  colorValue?: boolean; // if true, green/red color based on numeric sign
  rawValue?: number;    // used when value is formatted string but we need sign
  className?: string;
  'data-testid'?: string;
}

export function StatCard({
  label,
  value,
  subtext,
  trend,
  colorValue,
  rawValue,
  className,
  'data-testid': testId,
}: StatCardProps) {
  const numericRaw = rawValue ?? (typeof value === 'number' ? value : null);
  const isPositive  = numericRaw !== null ? numericRaw > 0 : false;
  const isNegative  = numericRaw !== null ? numericRaw < 0 : false;

  const valueColor = colorValue
    ? isPositive
      ? 'text-green-600 dark:text-green-400'
      : isNegative
      ? 'text-red-500 dark:text-red-400'
      : 'text-foreground'
    : 'text-foreground';

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 flex flex-col gap-1',
        className
      )}
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {trend && (
          <TrendIcon className={cn('w-3.5 h-3.5', trendColor)} />
        )}
      </div>
      <div className={cn('text-xl font-bold tabular-nums tracking-tight', valueColor)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {subtext && (
        <div className="text-xs text-muted-foreground">{subtext}</div>
      )}
    </div>
  );
}
