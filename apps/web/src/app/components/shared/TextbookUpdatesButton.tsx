import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { BookOpen } from 'lucide-react';

import { useTextbookUpdates } from '../../hooks/useTextbookUpdates';
import { isUnitUnseen, unitActivityTimestamp } from '../../lib/storage/textbook-updates';
import { buttonVariants } from '../ui/button';
import { Popover } from '../ui/popover';
import { cn } from '../ui/utils';

interface TextbookUpdatesButtonProps {
  learnerId: string | undefined;
  /** True while the learner is on the My Textbook page. */
  isActive?: boolean;
}

function formatAgo(timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * Navigation bar book icon. Shows how many notes were saved or changed since
 * the learner last looked, blinks while there is something new, and opens a
 * short quick view with a link to the full My Textbook page.
 */
export function TextbookUpdatesButton({ learnerId, isActive = false }: TextbookUpdatesButtonProps) {
  const { count, recent, seen, markUnitSeen, markAllSeen } = useTextbookUpdates(learnerId);
  const location = useLocation();
  const markUnitSeenRef = useRef(markUnitSeen);
  markUnitSeenRef.current = markUnitSeen;
  const markAllSeenRef = useRef(markAllSeen);
  markAllSeenRef.current = markAllSeen;

  // Looking at a note counts as seeing it. Opening one note lowers the counter
  // by one; opening the My Textbook page itself clears the rest.
  useEffect(() => {
    if (location.pathname !== '/textbook') return;
    const unitId = new URLSearchParams(location.search).get('unitId');
    if (unitId) markUnitSeenRef.current(unitId);
    else markAllSeenRef.current();
  }, [location.pathname, location.search]);

  // No counter on the My Textbook page itself; opening a single note only lowers it by one.
  const onTextbookPage = location.pathname === '/textbook';
  const openedSingleNote = onTextbookPage && new URLSearchParams(location.search).has('unitId');
  const shownCount = onTextbookPage && !openedSingleNote ? 0 : count;
  const label = shownCount > 0
    ? `My Textbook notes, ${shownCount} new ${shownCount === 1 ? 'update' : 'updates'}`
    : 'My Textbook notes';

  return (
    <Popover
      triggerLabel={label}
      triggerTestId="textbook-updates-button"
      panelTestId="textbook-updates-panel"
      align="start"
      triggerClassName={cn(
        buttonVariants({ variant: isActive ? 'default' : 'ghost', size: 'sm' }),
        'touch-manipulation gap-2 border-transparent',
      )}
      trigger={
        <>
          <span className="relative inline-flex">
            <BookOpen className="size-4" aria-hidden="true" />
            {shownCount > 0 && (
              <span
                data-testid="textbook-updates-badge"
                className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold leading-4 text-center motion-safe:animate-pulse"
              >
                {shownCount > 9 ? '9+' : shownCount}
              </span>
            )}
          </span>
          <span>My Textbook</span>
        </>
      }
    >
      {(close) => (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">My Textbook</h3>
            <Link
              to="/textbook"
              onClick={() => {
                markAllSeen();
                close();
              }}
              className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline"
              data-testid="textbook-updates-open"
            >
              Open My Textbook →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              No notes yet. Notes you save from hints and the chat show up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((unit) => {
                const isNew = isUnitUnseen(unit, seen);
                return (
                  <li key={unit.id}>
                    <Link
                      to={`/textbook?unitId=${encodeURIComponent(unit.id)}`}
                      onClick={() => {
                        markUnitSeen(unit.id);
                        close();
                      }}
                      className="block rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{unit.title}</span>
                        {isNew && (
                          <span className="shrink-0 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-300">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        {formatAgo(unitActivityTimestamp(unit))}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}
