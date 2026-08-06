import { beforeEach, describe, expect, it } from 'vitest';
import {
  getActiveSyncPrincipal,
  getActiveSyncPrincipalSnapshot,
  isActiveSyncPrincipal,
  isActiveSyncPrincipalSnapshot,
  resolveEnvelopeOwnershipForActivePrincipal,
  setActiveSyncPrincipal,
} from './sync-owner';

describe('sync owner principal', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveSyncPrincipal(null);
  });

  it('builds a case-preserving, versioned owner id from non-empty auth identifiers', () => {
    setActiveSyncPrincipal({ accountId: 'Account-A', learnerId: 'Learner-X' });

    expect(getActiveSyncPrincipal()).toEqual({
      accountId: 'Account-A',
      learnerId: 'Learner-X',
      syncOwnerId: 'v1:["Account-A","Learner-X"]',
    });
    expect(isActiveSyncPrincipal(getActiveSyncPrincipal())).toBe(true);
    expect(isActiveSyncPrincipal('v1:["Account-A","Learner-X"]')).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it('treats blank or null principals as unauthenticated', () => {
    setActiveSyncPrincipal({ accountId: ' ', learnerId: 'Learner-X' });
    expect(getActiveSyncPrincipal()).toBeNull();

    setActiveSyncPrincipal({ accountId: 'Account-A', learnerId: '' });
    expect(getActiveSyncPrincipal()).toBeNull();

    setActiveSyncPrincipal({ accountId: 'Account-A', learnerId: 'Learner-X' });
    setActiveSyncPrincipal(null);
    expect(getActiveSyncPrincipal()).toBeNull();
  });

  it('claims only absent-owner legacy envelopes with an exact stored learner id', () => {
    setActiveSyncPrincipal({ accountId: 'Account-A', learnerId: 'Learner-X' });
    const exactLegacy: { syncOwnerId?: unknown } = {};
    const selectedLearnerLegacy: { syncOwnerId?: unknown } = {};

    expect(resolveEnvelopeOwnershipForActivePrincipal(exactLegacy, 'Learner-X')).toEqual({
      eligible: false,
      claimOwnerId: 'v1:["Account-A","Learner-X"]',
    });
    expect(Object.prototype.hasOwnProperty.call(exactLegacy, 'syncOwnerId')).toBe(false);
    expect(resolveEnvelopeOwnershipForActivePrincipal(selectedLearnerLegacy, 'Student-Y')).toEqual({
      eligible: false,
    });
    expect(Object.prototype.hasOwnProperty.call(selectedLearnerLegacy, 'syncOwnerId')).toBe(false);
  });

  it('never claims present malformed, mismatched, or session-derived owners', () => {
    setActiveSyncPrincipal({ accountId: 'Account-A', learnerId: 'Learner-X' });
    const malformed = { syncOwnerId: '' };
    const mismatched = { syncOwnerId: 'v1:["Account-B","Learner-X"]' };
    const sessionOnly: { syncOwnerId?: unknown } = {};

    expect(resolveEnvelopeOwnershipForActivePrincipal(malformed, 'Learner-X')).toEqual({
      eligible: false,
    });
    expect(resolveEnvelopeOwnershipForActivePrincipal(mismatched, 'Learner-X')).toEqual({
      eligible: false,
    });
    expect(resolveEnvelopeOwnershipForActivePrincipal(sessionOnly, undefined)).toEqual({
      eligible: false,
    });
    expect(Object.prototype.hasOwnProperty.call(sessionOnly, 'syncOwnerId')).toBe(false);
    expect(isActiveSyncPrincipal('v1:["Account-B","Learner-X"]')).toBe(false);
  });

  it('invalidates a captured principal snapshot on every principal transition', () => {
    setActiveSyncPrincipal({ accountId: 'Account-A', learnerId: 'Learner-X' });
    const initial = getActiveSyncPrincipalSnapshot();

    expect(initial.principal).toEqual(getActiveSyncPrincipal());
    expect(isActiveSyncPrincipalSnapshot(initial)).toBe(true);

    setActiveSyncPrincipal({ accountId: 'Account-A', learnerId: 'Learner-X' });
    const repeated = getActiveSyncPrincipalSnapshot();
    expect(repeated.revision).toBe(initial.revision + 1);
    expect(isActiveSyncPrincipalSnapshot(initial)).toBe(false);
    expect(isActiveSyncPrincipalSnapshot(repeated)).toBe(true);

    setActiveSyncPrincipal(null);
    expect(isActiveSyncPrincipalSnapshot(repeated)).toBe(false);
    expect(getActiveSyncPrincipalSnapshot()).toEqual({
      revision: repeated.revision + 1,
      principal: null,
    });
  });

  it('does not let callers mutate the active principal around revision guards', () => {
    setActiveSyncPrincipal({ accountId: 'Account-A', learnerId: 'Learner-X' });
    const snapshot = getActiveSyncPrincipalSnapshot();
    const principal = getActiveSyncPrincipal();

    expect(principal && Reflect.set(principal, 'accountId', 'Account-B')).toBe(false);
    expect(snapshot.principal && Reflect.set(snapshot.principal, 'learnerId', 'Learner-Y')).toBe(false);
    expect(getActiveSyncPrincipal()).toEqual({
      accountId: 'Account-A',
      learnerId: 'Learner-X',
      syncOwnerId: 'v1:["Account-A","Learner-X"]',
    });
    expect(isActiveSyncPrincipalSnapshot(snapshot)).toBe(true);
  });

  it('rejects a stale principal object after an A to B to A transition', () => {
    setActiveSyncPrincipal({ accountId: 'Account-A', learnerId: 'Learner-X' });
    const staleA = getActiveSyncPrincipal();
    setActiveSyncPrincipal({ accountId: 'Account-B', learnerId: 'Learner-X' });
    setActiveSyncPrincipal({ accountId: 'Account-A', learnerId: 'Learner-X' });

    expect(isActiveSyncPrincipal(staleA)).toBe(false);
    expect(isActiveSyncPrincipal(getActiveSyncPrincipal())).toBe(true);
    expect(isActiveSyncPrincipal('v1:["Account-A","Learner-X"]')).toBe(true);
  });

});
