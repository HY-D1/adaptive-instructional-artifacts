import { Database } from 'lucide-react';

import { cn } from '../ui/utils';

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
}

/**
 * Shared Schema Atlas identity.
 *
 * The visible name can evolve independently from the legacy SQL-Adapt
 * accessible names retained by route links and form contracts.
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
      aria-label="Schema Atlas, SQL-Adapt learning system"
    >
      <span className="atlas-brand__mark" aria-hidden="true">
        <Database className="atlas-brand__icon" />
        <span className="atlas-brand__axis" />
      </span>
      <span className="atlas-brand__copy">
        <span className="atlas-brand__name">Schema Atlas</span>
        {!compact && <span className="atlas-brand__descriptor">SQL learning workbench</span>}
      </span>
    </div>
  );
}
