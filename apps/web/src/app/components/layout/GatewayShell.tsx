import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { BrandMark } from './BrandMark';

interface GatewayShellProps {
  children: ReactNode;
  footer?: ReactNode;
}

const schemaTables = [
  { name: 'learners', fields: ['learner_id', 'cohort'], className: 'atlas-map__table--learners' },
  { name: 'attempts', fields: ['attempt_id', 'learner_id'], className: 'atlas-map__table--attempts' },
  { name: 'concepts', fields: ['concept_id', 'mastery'], className: 'atlas-map__table--concepts' },
  { name: 'hints', fields: ['hint_id', 'level'], className: 'atlas-map__table--hints' },
] as const;

/** Centered public gateway framed by a quiet, decorative schema map. */
export function GatewayShell({ children, footer }: GatewayShellProps) {
  return (
    <div className="atlas-gateway" data-atlas-shell="gateway" data-testid="atlas-gateway">
      <div className="atlas-map" aria-hidden="true">
        <svg className="atlas-map__relations" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M 130 165 C 310 165, 335 330, 505 330" />
          <path d="M 505 330 C 685 330, 690 145, 880 145" />
          <path d="M 505 330 C 695 330, 705 620, 920 620" />
          <path d="M 245 665 C 355 665, 385 470, 505 470" />
        </svg>
        {schemaTables.map((table) => (
          <div key={table.name} className={`atlas-map__table ${table.className}`}>
            <strong>{table.name}</strong>
            {table.fields.map((field) => <span key={field}>{field}</span>)}
          </div>
        ))}
      </div>

      <header className="atlas-gateway__header">
        <Link to="/" aria-label="SQL-Adapt home">
          <BrandMark />
        </Link>
      </header>

      <main className="atlas-gateway__main">{children}</main>

      <footer className="atlas-gateway__footer">
        {footer ?? 'Practice, inspect, and connect the structure behind every query.'}
      </footer>
    </div>
  );
}
