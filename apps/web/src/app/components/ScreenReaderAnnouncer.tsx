import { useEffect, useState } from 'react';

/**
 * ScreenReaderAnnouncer - Accessibility component for announcing dynamic content
 * 
 * Uses aria-live regions to announce changes to screen reader users.
 * Essential for:
 * - Hint system updates
 * - Auto-creation notifications
 * - Query results
 * - Error messages
 * 
 * Research: Screen reader users need timely feedback on dynamic content
 */
interface ScreenReaderAnnouncerProps {
  /** The message to announce */
  message: string;
  /** Announcement priority - polite waits for user to finish, assertive interrupts */
  priority?: 'polite' | 'assertive';
  /** Clear message after announcing (for one-time announcements) */
  clearAfter?: number;
  /** Callback when message is cleared */
  onClear?: () => void;
}

export function ScreenReaderAnnouncer({ 
  message, 
  priority = 'polite',
  clearAfter,
  onClear 
}: ScreenReaderAnnouncerProps) {
  const [announcement, setAnnouncement] = useState(message);

  useEffect(() => {
    setAnnouncement(message);
    
    if (clearAfter && message) {
      const timer = setTimeout(() => {
        setAnnouncement('');
        onClear?.();
      }, clearAfter);
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter, onClear]);

  if (!announcement) return null;

  return (
    <div 
      role="status" 
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

/**
 * Static aria-live region for hint announcements
 * Place this near the hint system component
 */
export function HintAnnouncer({ message }: { message: string }) {
  return (
    <div
      role="region"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Hint announcements"
      className="sr-only"
    >
      {message}
    </div>
  );
}

/**
 * Static aria-live region for notification announcements
 */
export function NotificationAnnouncer({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Notifications"
      className="sr-only"
    >
      {message}
    </div>
  );
}

/**
 * Hook for managing screen reader announcements
 */
export function useScreenReaderAnnouncer() {
  const [announcement, setAnnouncement] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');

  const announce = (message: string, opts?: { priority?: 'polite' | 'assertive' }) => {
    setPriority(opts?.priority || 'polite');
    setAnnouncement(message);
    // Auto-clear after announcement
    setTimeout(() => setAnnouncement(''), 1000);
  };

  return { announcement, priority, announce };
}
