/**
 * Helpers for the "My Textbook" update counter in the navigation bar.
 *
 * An update is a saved or changed note. We compare each note's last activity
 * time with the time the learner last looked at their textbook.
 */
import type { InstructionalUnit } from '../../types';

const LAST_SEEN_PREFIX = 'sql-adapt-textbook-last-seen:';

/** Window event other code can fire right after a note is saved. */
export const TEXTBOOK_CHANGED_EVENT = 'sql-adapt-textbook-changed';

export function unitActivityTimestamp(unit: Pick<InstructionalUnit, 'addedTimestamp' | 'updatedTimestamp'>): number {
  return Math.max(unit.addedTimestamp ?? 0, unit.updatedTimestamp ?? 0);
}

function isCountable(unit: InstructionalUnit): boolean {
  return unit.status !== 'archived';
}

/**
 * What the learner has already looked at: note id -> a short fingerprint of the
 * note's title and content. Comparing fingerprints (not clock times) means a
 * clock that runs behind the server, or a note being saved again with the same
 * text, cannot bring the counter back after the learner has looked.
 */
export type SeenVersions = Record<string, string>;

/** Short fingerprint of what the learner would read in a note. */
export function unitSignature(unit: Pick<InstructionalUnit, 'title' | 'content'>): string {
  const text = `${unit.title ?? ''}\u0000${unit.content ?? ''}`;
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

/** True when the note is new, or its text changed since the learner last saw it. */
export function isUnitUnseen(unit: InstructionalUnit, seen: SeenVersions): boolean {
  if (!isCountable(unit)) return false;
  return seen[unit.id] !== unitSignature(unit);
}

/** Number of notes the learner has not looked at yet. */
export function countTextbookUpdates(units: InstructionalUnit[], seen: SeenVersions): number {
  return units.filter((unit) => isUnitUnseen(unit, seen)).length;
}

/** The most recently saved or changed notes, newest first. */
export function latestTextbookUnits(units: InstructionalUnit[], limit = 5): InstructionalUnit[] {
  return units
    .filter(isCountable)
    .sort((a, b) => unitActivityTimestamp(b) - unitActivityTimestamp(a))
    .slice(0, limit);
}

// Note ids are unique, so the "seen" record is shared by every id the app might
// use for the same learner (auth id, learner id, profile id).
const SEEN_KEY = 'sql-adapt-textbook-seen';
const BASELINE_PREFIX = 'sql-adapt-textbook-baseline:';

function readSeenRecord(): SeenVersions {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: SeenVersions = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') result[id] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function hasBaseline(learnerId: string): boolean {
  try {
    return localStorage.getItem(`${BASELINE_PREFIX}${learnerId}`) === '1';
  } catch {
    return false;
  }
}

/** The saved "seen" record, or null if this learner has never been baselined. */
export function getSeenVersions(learnerId: string): SeenVersions | null {
  return hasBaseline(learnerId) ? readSeenRecord() : null;
}

/** Mark the given notes as seen, keeping what was already seen. Returns the new record. */
export function markUnitsSeen(learnerId: string, units: InstructionalUnit[]): SeenVersions {
  const seen = readSeenRecord();
  for (const unit of units) {
    seen[unit.id] = unitSignature(unit);
  }
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    localStorage.setItem(`${BASELINE_PREFIX}${learnerId}`, '1');
  } catch {
    // Private mode or full storage: the counter simply keeps showing.
  }
  return seen;
}
