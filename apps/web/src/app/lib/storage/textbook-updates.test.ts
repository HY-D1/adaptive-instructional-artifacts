import { beforeEach, describe, expect, it } from 'vitest';
import type { InstructionalUnit } from '../../types';
import {
  countTextbookUpdates,
  getSeenVersions,
  isUnitUnseen,
  latestTextbookUnits,
  markUnitsSeen,
  unitSignature,
  unitActivityTimestamp,
} from './textbook-updates';

function unit(id: string, added: number, updated?: number, status?: InstructionalUnit['status']): InstructionalUnit {
  return {
    id,
    type: 'explanation',
    conceptId: 'select-basic',
    title: `Note ${id}`,
    content: 'x',
    prerequisites: [],
    addedTimestamp: added,
    updatedTimestamp: updated,
    sourceInteractionIds: [],
    status,
  };
}

describe('textbook update counter helpers', () => {
  beforeEach(() => localStorage.clear());

  it('uses the later of added and updated time', () => {
    expect(unitActivityTimestamp(unit('a', 10, 50))).toBe(50);
    expect(unitActivityTimestamp(unit('b', 70))).toBe(70);
  });

  it('counts notes that were never seen or changed after they were seen', () => {
    const units = [unit('seen', 10), unit('fresh', 200), { ...unit('changed', 10, 300), content: 'edited text' }];
    const base = unit('changed', 10);
    const seen = { seen: unitSignature(units[0]), changed: unitSignature(base) };
    expect(countTextbookUpdates(units, seen)).toBe(2);
    expect(isUnitUnseen(units[0], seen)).toBe(false);
    expect(isUnitUnseen(units[1], seen)).toBe(true);
  });

  it('does not count archived notes', () => {
    expect(countTextbookUpdates([unit('gone', 500, undefined, 'archived')], {})).toBe(0);
  });

  it('is not fooled by timestamps ahead of the local clock', () => {
    const farFuture = Date.now() + 10 * 60 * 1000;
    const units = [unit('a', farFuture)];
    expect(countTextbookUpdates(units, {})).toBe(1);
    const seen = markUnitsSeen('learner-1', units);
    expect(countTextbookUpdates(units, seen)).toBe(0);
  });

  it('does not bring the counter back when a seen note is saved again with the same text', () => {
    const original = unit('a', 100);
    const seen = markUnitsSeen('learner-1', [original]);
    const resaved = { ...original, updatedTimestamp: 999999 };
    expect(countTextbookUpdates([resaved], seen)).toBe(0);
  });

  it('keeps the seen record when the learner id string changes', () => {
    const units = [unit('a', 1)];
    markUnitsSeen('auth-id', units);
    markUnitsSeen('profile-id', []);
    expect(countTextbookUpdates(units, getSeenVersions('profile-id') ?? {})).toBe(0);
  });

  it('lowers the count by one for each note marked as seen', () => {
    const units = [unit('a', 1), unit('b', 2)];
    expect(countTextbookUpdates(units, markUnitsSeen('learner-1', [units[0]]))).toBe(1);
    expect(countTextbookUpdates(units, markUnitsSeen('learner-1', [units[1]]))).toBe(0);
  });

  it('returns the newest notes first', () => {
    const latest = latestTextbookUnits([unit('a', 1), unit('b', 3), unit('c', 2)], 2);
    expect(latest.map((u) => u.id)).toEqual(['b', 'c']);
  });

  it('remembers what was seen per learner', () => {
    expect(getSeenVersions('learner-1')).toBeNull();
    markUnitsSeen('learner-1', [unit('a', 5)]);
    expect(getSeenVersions('learner-1')).toEqual({ a: unitSignature(unit('a', 5)) });
    expect(getSeenVersions('learner-2')).toBeNull();
  });
});
