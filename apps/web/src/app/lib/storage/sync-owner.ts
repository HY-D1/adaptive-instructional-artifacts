export interface SyncPrincipalInput {
  readonly accountId: string;
  readonly learnerId: string;
}

export interface ActiveSyncPrincipal extends SyncPrincipalInput {
  readonly syncOwnerId: string;
}

let activeSyncPrincipal: ActiveSyncPrincipal | null = null;
let activeSyncPrincipalRevision = 0;

export interface ActiveSyncPrincipalSnapshot {
  readonly revision: number;
  readonly principal: Readonly<ActiveSyncPrincipal> | null;
}

export function setActiveSyncPrincipal(principal: SyncPrincipalInput | null): void {
  activeSyncPrincipalRevision += 1;
  if (
    !principal ||
    typeof principal.accountId !== 'string' ||
    principal.accountId.trim().length === 0 ||
    typeof principal.learnerId !== 'string' ||
    principal.learnerId.trim().length === 0
  ) {
    activeSyncPrincipal = null;
    return;
  }

  activeSyncPrincipal = Object.freeze({
    accountId: principal.accountId,
    learnerId: principal.learnerId,
    syncOwnerId: `v1:${JSON.stringify([principal.accountId, principal.learnerId])}`,
  });
}

export function getActiveSyncPrincipal(): ActiveSyncPrincipal | null {
  return activeSyncPrincipal;
}

export function getActiveSyncPrincipalSnapshot(): ActiveSyncPrincipalSnapshot {
  return {
    revision: activeSyncPrincipalRevision,
    principal: activeSyncPrincipal ? Object.freeze({ ...activeSyncPrincipal }) : null,
  };
}

export function isActiveSyncPrincipalSnapshot(snapshot: ActiveSyncPrincipalSnapshot): boolean {
  return snapshot.revision === activeSyncPrincipalRevision;
}

export function isActiveSyncPrincipal(
  principalOrOwnerId: Pick<ActiveSyncPrincipal, 'syncOwnerId'> | string | null | undefined,
): boolean {
  if (typeof principalOrOwnerId === 'string') {
    return activeSyncPrincipal?.syncOwnerId === principalOrOwnerId;
  }
  return principalOrOwnerId !== null &&
    principalOrOwnerId !== undefined &&
    activeSyncPrincipal === principalOrOwnerId;
}

export interface EnvelopeOwnershipResolution {
  eligible: boolean;
  claimOwnerId?: string;
}

export function resolveEnvelopeOwnershipForActivePrincipal(
  envelope: { syncOwnerId?: unknown },
  storedLearnerId: string | undefined,
): EnvelopeOwnershipResolution {
  const principal = getActiveSyncPrincipal();
  if (!principal) {
    return { eligible: false };
  }

  if (Object.prototype.hasOwnProperty.call(envelope, 'syncOwnerId')) {
    return {
      eligible: envelope.syncOwnerId === principal.syncOwnerId,
    };
  }

  if (storedLearnerId !== principal.learnerId) {
    return { eligible: false };
  }

  return { eligible: false, claimOwnerId: principal.syncOwnerId };
}
