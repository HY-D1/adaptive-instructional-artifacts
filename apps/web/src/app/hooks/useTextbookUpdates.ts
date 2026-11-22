import { useCallback, useEffect, useRef, useState } from 'react';

import { storage, subscribeToSync } from '../lib/storage';
import {
  TEXTBOOK_CHANGED_EVENT,
  countTextbookUpdates,
  getSeenVersions,
  latestTextbookUnits,
  markUnitsSeen,
  type SeenVersions,
} from '../lib/storage/textbook-updates';
import type { InstructionalUnit } from '../types';

const POLL_MS = 2500;

export interface TextbookUpdatesState {
  /** Notes the learner has not looked at yet. */
  count: number;
  /** Newest notes first. */
  recent: InstructionalUnit[];
  /** Which notes the learner has already seen. */
  seen: SeenVersions;
  /** Mark one note as seen (the counter goes down by one). */
  markUnitSeen: (unitId: string) => void;
  /** Mark every note as seen (the counter goes to zero). */
  markAllSeen: () => void;
}

function readUnits(learnerId: string): InstructionalUnit[] {
  try {
    return storage.getTextbook(learnerId) ?? [];
  } catch {
    return [];
  }
}

/**
 * Tracks new or changed My Textbook notes for the navigation bar counter.
 * The first time it runs for a learner, notes that already exist count as seen,
 * so old notes do not show up as new. Each note is tracked on its own, so
 * opening one note lowers the counter by one.
 */
export function useTextbookUpdates(learnerIdInput: string | undefined): TextbookUpdatesState {
  // The id can be briefly undefined while the profile loads. Keep the last real
  // one so the counter does not reset and flicker.
  const lastIdRef = useRef<string | undefined>(learnerIdInput);
  if (learnerIdInput) lastIdRef.current = learnerIdInput;
  const learnerId = learnerIdInput ?? lastIdRef.current;

  const [state, setState] = useState<{ count: number; recent: InstructionalUnit[]; seen: SeenVersions }>({
    count: 0,
    recent: [],
    seen: {},
  });

  const refresh = useCallback(() => {
    if (!learnerId) {
      setState((prev) => (prev.count === 0 && prev.recent.length === 0 ? prev : { count: 0, recent: [], seen: {} }));
      return;
    }
    const units = readUnits(learnerId);
    let seen = getSeenVersions(learnerId);
    if (seen === null) {
      seen = markUnitsSeen(learnerId, units);
    }
    const count = countTextbookUpdates(units, seen);
    const recent = latestTextbookUnits(units, 5);
    setState((prev) =>
      prev.count === count &&
      prev.recent.length === recent.length &&
      prev.recent.every((unit, index) => unit.id === recent[index].id && unit.updatedTimestamp === recent[index].updatedTimestamp) &&
      JSON.stringify(prev.seen) === JSON.stringify(seen)
        ? prev
        : { count, recent, seen: seen as SeenVersions },
    );
  }, [learnerId]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener(TEXTBOOK_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = subscribeToSync((key) => {
      if (key === 'sql-adapt-textbook') refresh();
    });
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(TEXTBOOK_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [refresh]);

  const markUnitSeen = useCallback(
    (unitId: string) => {
      if (!learnerId) return;
      const unit = readUnits(learnerId).find((candidate) => candidate.id === unitId);
      if (unit) markUnitsSeen(learnerId, [unit]);
      refresh();
    },
    [learnerId, refresh],
  );

  const markAllSeen = useCallback(() => {
    if (!learnerId) return;
    markUnitsSeen(learnerId, readUnits(learnerId));
    refresh();
  }, [learnerId, refresh]);

  return { ...state, markUnitSeen, markAllSeen };
}
