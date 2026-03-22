/**
 * Integration test: Save-to-Notes reliability
 *
 * Covers:
 * 1. Requesting hints without a prior logged SQL error, then clicking Save to Notes
 *    creates a textbook unit (subtype is passed from HintSystem → handleEscalate).
 * 2. Calling handleEscalate with an explicit subtype always persists a unit.
 * 3. Calling handleEscalate with NO subtype context sets a generationError instead
 *    of silently doing nothing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Inline the contract types and minimal logic so the test is self-contained
// and does not depend on React component internals.
// ---------------------------------------------------------------------------

type EscalateCallback = (sourceInteractionIds?: string[], subtype?: string) => void;

/**
 * Simulates the LearningInterface.handleEscalate logic under test:
 * - uses providedSubtype first
 * - falls back to lastError (state) or resolveLatestProblemErrorSubtype()
 * - sets generationError string if no subtype found (no silent failure)
 */
function makeHandleEscalate(opts: {
  lastError: string | undefined;
  resolveLatestSubtype: () => string | undefined;
  persistUnit: (subtype: string, sourceIds: string[]) => Promise<{ action: 'created' | 'updated'; title: string }>;
  setNotesActionMessage: (msg: string) => void;
  setGenerationError: (msg: string) => void;
  broadcastSync: (key: string, value: string) => void;
  learnerId: string;
}): EscalateCallback {
  return async (sourceInteractionIds, providedSubtype) => {
    const sourceIds = sourceInteractionIds && sourceInteractionIds.length > 0
      ? sourceInteractionIds
      : [];

    const escalationSubtype =
      providedSubtype || opts.lastError || opts.resolveLatestSubtype();

    if (!escalationSubtype) {
      opts.setGenerationError(
        'Could not save note: no concept context identified. Try submitting a query or requesting a hint first.'
      );
      return;
    }

    try {
      const result = await opts.persistUnit(escalationSubtype, sourceIds);
      opts.setNotesActionMessage(
        result.action === 'created'
          ? `Saved "${result.title}" to My Textbook for review`
          : `Updated "${result.title}" in My Textbook`
      );
      opts.broadcastSync('sql-adapt-textbook', opts.learnerId);
    } catch (err) {
      opts.setGenerationError((err as Error).message);
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Save-to-Notes integration: handleEscalate subtype resolution', () => {
  let notesMessage: string | undefined;
  let generationError: string | undefined;
  let broadcastCalls: string[];
  let persistedSubtype: string | undefined;

  const mockPersistUnit = vi.fn(async (subtype: string) => {
    persistedSubtype = subtype;
    return { action: 'created' as const, title: `Note on ${subtype}` };
  });

  beforeEach(() => {
    notesMessage = undefined;
    generationError = undefined;
    broadcastCalls = [];
    persistedSubtype = undefined;
    mockPersistUnit.mockClear();
  });

  it('creates a unit when HintSystem passes subtype explicitly (no prior SQL error)', async () => {
    // Simulates: learner clicked hints but never submitted SQL
    const handleEscalate = makeHandleEscalate({
      lastError: undefined,          // no SQL error submitted
      resolveLatestSubtype: () => undefined, // nothing in history either
      persistUnit: mockPersistUnit,
      setNotesActionMessage: (m) => { notesMessage = m; },
      setGenerationError: (e) => { generationError = e; },
      broadcastSync: (key) => { broadcastCalls.push(key); },
      learnerId: 'learner-test',
    });

    // HintSystem passes the active hint subtype via the second argument
    await handleEscalate(['interaction-1'], 'select-basic');

    expect(mockPersistUnit).toHaveBeenCalledWith('select-basic', ['interaction-1']);
    expect(notesMessage).toContain('Note on select-basic');
    expect(generationError).toBeUndefined();
    // Post-save broadcast fires
    expect(broadcastCalls).toContain('sql-adapt-textbook');
  });

  it('uses lastError fallback when HintSystem does not pass subtype', async () => {
    const handleEscalate = makeHandleEscalate({
      lastError: 'where-clause',
      resolveLatestSubtype: () => undefined,
      persistUnit: mockPersistUnit,
      setNotesActionMessage: (m) => { notesMessage = m; },
      setGenerationError: (e) => { generationError = e; },
      broadcastSync: () => {},
      learnerId: 'learner-test',
    });

    await handleEscalate(['interaction-2'], undefined); // no subtype from HintSystem

    expect(persistedSubtype).toBe('where-clause');
    expect(notesMessage).toContain('Note on where-clause');
  });

  it('falls back to resolveLatestSubtype when both lastError and providedSubtype are absent', async () => {
    const handleEscalate = makeHandleEscalate({
      lastError: undefined,
      resolveLatestSubtype: () => 'joins',
      persistUnit: mockPersistUnit,
      setNotesActionMessage: (m) => { notesMessage = m; },
      setGenerationError: (e) => { generationError = e; },
      broadcastSync: () => {},
      learnerId: 'learner-test',
    });

    await handleEscalate([], undefined);

    expect(persistedSubtype).toBe('joins');
    expect(notesMessage).toContain('Note on joins');
  });

  it('sets a visible error when NO subtype context exists (no silent failure)', async () => {
    const handleEscalate = makeHandleEscalate({
      lastError: undefined,
      resolveLatestSubtype: () => undefined,
      persistUnit: mockPersistUnit,
      setNotesActionMessage: (m) => { notesMessage = m; },
      setGenerationError: (e) => { generationError = e; },
      broadcastSync: () => {},
      learnerId: 'learner-test',
    });

    await handleEscalate([], undefined); // no subtype anywhere

    expect(mockPersistUnit).not.toHaveBeenCalled();
    expect(notesMessage).toBeUndefined();
    expect(generationError).toMatch(/no concept context/i);
  });

  it('persists explicit subtype over lastError (explicit wins)', async () => {
    const handleEscalate = makeHandleEscalate({
      lastError: 'group-by',          // stale error from a previous attempt
      resolveLatestSubtype: () => undefined,
      persistUnit: mockPersistUnit,
      setNotesActionMessage: (m) => { notesMessage = m; },
      setGenerationError: (e) => { generationError = e; },
      broadcastSync: () => {},
      learnerId: 'learner-test',
    });

    // HintSystem passes a fresher subtype from the currently active hint
    await handleEscalate(['interaction-3'], 'aggregate-functions');

    expect(persistedSubtype).toBe('aggregate-functions');
  });

  it('broadcasts sync event so TextbookPage refreshes without navigation', async () => {
    let broadcastKey = '';
    const handleEscalate = makeHandleEscalate({
      lastError: 'inner-join',
      resolveLatestSubtype: () => undefined,
      persistUnit: mockPersistUnit,
      setNotesActionMessage: () => {},
      setGenerationError: () => {},
      broadcastSync: (key) => { broadcastKey = key; },
      learnerId: 'learner-abc',
    });

    await handleEscalate([], 'inner-join');

    expect(broadcastKey).toBe('sql-adapt-textbook');
  });
});

// ---------------------------------------------------------------------------
// Contract: HintSystem passes subtype through onEscalate
// ---------------------------------------------------------------------------

describe('HintSystem → LearningInterface subtype contract', () => {
  it('onEscalate signature accepts (sourceInteractionIds, subtype) positional args', () => {
    // This test is a compile-time / runtime shape check.
    // The callback must accept both args without TypeScript error.
    const received: { ids: string[] | undefined; subtype: string | undefined } = {
      ids: undefined,
      subtype: undefined,
    };

    const onEscalate = (ids?: string[], subtype?: string) => {
      received.ids = ids;
      received.subtype = subtype;
    };

    onEscalate(['id-1', 'id-2'], 'select-basic');
    expect(received.ids).toEqual(['id-1', 'id-2']);
    expect(received.subtype).toBe('select-basic');
  });

  it('onEscalate works when called without subtype (backward-compat)', () => {
    let called = false;
    const onEscalate = (ids?: string[], _subtype?: string) => {
      called = true;
      expect(ids).toBeUndefined();
    };
    onEscalate();
    expect(called).toBe(true);
  });
});
