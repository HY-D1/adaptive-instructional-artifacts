import { Database } from 'lucide-react';

import { cn } from '../ui/utils';

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
}

/**
 * Shared product identity: the visible brand is the project name only,
 * with no descriptor line.
 */
export function BrandMark({ className, compact = false, inverse = false }: BrandMarkProps) {
  return (
    <div
      className={cn(
        'atlas-brand',
        compact && 'atlas-brand--compact',
        inverse && 'atlas-brand--inverse',
        className,
      )}
      data-testid="atlas-brand"
      aria-label="SQL-Adapt learning system"
    >
      <span className="atlas-brand__mark" aria-hidden="true">
        <Database className="atlas-brand__icon" />
        <span className="atlas-brand__axis" />
      </span>
      <span className="atlas-brand__copy">
        <span className="atlas-brand__name">SQL-Adapt</span>
      </span>
    </div>
  );
}
