import { safeSet } from './storage/safe-storage';

type UiRole = 'student' | 'instructor' | 'anonymous';

interface UiScope {
  role: UiRole;
  actorId: string;
}

const UI_STATE_PREFIX = 'sql-adapt-ui-state-v1';

function normalizeScope(scope: Partial<UiScope>): UiScope {
  const role = scope.role === 'student' || scope.role === 'instructor' ? scope.role : 'anonymous';
  const actorId = scope.actorId && scope.actorId.trim().length > 0 ? scope.actorId : 'unknown';
  return { role, actorId };
}

/**
 * Check if preview mode is active
 * Used to isolate UI state between instructor and preview modes
 */
function isPreviewModeActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('sql-adapt-preview-mode') === 'true';
  } catch {
    return false;
  }
}

function buildKey(pageKey: string, scope: Partial<UiScope>): string {
  const normalized = normalizeScope(scope);
  const previewSuffix = isPreviewModeActive() ? ':preview' : '';
  return `${UI_STATE_PREFIX}:${normalized.role}:${normalized.actorId}${previewSuffix}:${pageKey}`;
}

export function getUiState<T>(pageKey: string, scope: Partial<UiScope>): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(buildKey(pageKey, scope));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setUiState<T>(pageKey: string, scope: Partial<UiScope>, state: T): void {
  if (typeof window === 'undefined') return;
  safeSet(buildKey(pageKey, scope), state, { priority: 'cache' });
  // No warning on failure - UI state is recoverable
}

export function clearUiStateForActor(actorId: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  if (!actorId || actorId.trim().length === 0) return;
  const needle = `:${actorId}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(`${UI_STATE_PREFIX}:`) && key.includes(needle)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export function clearAllUiState(): void {
  if (typeof window === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(`${UI_STATE_PREFIX}:`)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

