import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cn } from './utils';

const EXIT_MS = 200;

interface PopoverProps {
  /** Content of the button that opens the popover. */
  trigger: ReactNode;
  /** Accessible name for the trigger button. */
  triggerLabel: string;
  /** The popover body. Receives a function that closes the popover. */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Which edge of the trigger the panel lines up with. */
  align?: 'start' | 'end';
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
  /** Extra classes for the panel. */
  panelClassName?: string;
  /** Test id for the trigger button. */
  triggerTestId?: string;
  /** Test id for the panel. */
  panelTestId?: string;
  /** Called whenever the popover opens or closes. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Small click-to-open panel. Closes on Escape, on a click outside, and when
 * focus leaves it. No extra dependencies.
 */
export function Popover({
  trigger,
  triggerLabel,
  children,
  align = 'end',
  triggerClassName,
  panelClassName,
  triggerTestId,
  panelTestId,
  onOpenChange,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  // The panel stays mounted briefly after closing so it can slide away.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const close = useCallback(() => setOpenState(false), [setOpenState]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenState(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenState(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, setOpenState]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpenState(!open)}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          triggerClassName,
        )}
        data-testid={triggerTestId}
      >
        {trigger}
      </button>
      {mounted && (
        <div
          id={panelId}
          role="dialog"
          aria-hidden={!open}
          aria-label={triggerLabel}
          className={cn(
            'absolute z-50 mt-2 origin-top transition duration-200 ease-out motion-reduce:transition-none',
            shown ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-2 scale-95 opacity-0 pointer-events-none',
            'w-[min(92vw,380px)] max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-xl',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName,
          )}
          data-testid={panelTestId}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}
