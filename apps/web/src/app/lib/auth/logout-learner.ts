interface LogoutLearnerIdCandidates {
  syncedProfileId?: string | null;
  authLearnerId?: string | null;
  cachedProfileId?: string | null;
}

function cleanId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveLogoutLearnerId({
  syncedProfileId,
  authLearnerId,
  cachedProfileId,
}: LogoutLearnerIdCandidates): string | null {
  return cleanId(syncedProfileId) ?? cleanId(authLearnerId) ?? cleanId(cachedProfileId);
}
