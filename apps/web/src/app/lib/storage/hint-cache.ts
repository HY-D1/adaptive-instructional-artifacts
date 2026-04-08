type HintCacheSources = {
  sqlEngage: boolean;
  textbook: boolean;
  llm: boolean;
  pdfPassages: boolean;
};

export type HintCacheEnhancedInfo = {
  isEnhanced: boolean;
  sources: HintCacheSources;
  llmFailed?: boolean;
  llmErrorMessage?: string;
};

export type HintCacheSnapshot = {
  updatedAt: number;
  learnerId: string;
  problemId: string;
  currentRung: 1 | 2 | 3;
  visibleHintCount: number;
  lastHintId?: string;
  lastHelpRequestIndex: number;
  lastHintPreview?: string;
  enhancedHintInfo: HintCacheEnhancedInfo[];
};

type HintCacheScope = {
  learnerId: string;
  problemId: string;
};

type HintCacheWriteInput = Omit<HintCacheSnapshot, 'updatedAt'> & {
  updatedAt?: number;
};

type HintCacheResult = {
  success: boolean;
  quotaExceeded?: boolean;
  skipped?: boolean;
  bytes?: number;
  budgetBytes?: number;
  removedCount?: number;
  diagnostic?: string;
};

type HintCacheLoadResult = {
  snapshot: HintCacheSnapshot | null;
  removedCount: number;
};

const HINT_CACHE_PREFIX = 'hint-cache:';
const LEGACY_HINTS_PREFIX = 'hints-';
const LEGACY_HINT_INFO_PREFIX = 'hint-info-';
const HINT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_HINT_CACHE_ENTRIES = 40;
const MAX_HINT_PREVIEW_CHARS = 240;
const MAX_HINT_ERROR_CHARS = 160;
const MAX_ENHANCED_INFO_ENTRIES = 6;
const HINT_CACHE_BUDGET_BYTES = 2048;

function logDiagnostic(diagnostic: string, detail?: unknown): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    console.warn(`[${diagnostic}]`, detail);
  }
}

function buildHintCacheKey({ learnerId, problemId }: HintCacheScope): string {
  return `${HINT_CACHE_PREFIX}${learnerId}:${problemId}`;
}

function buildLegacyHintsKey({ learnerId, problemId }: HintCacheScope): string {
  return `${LEGACY_HINTS_PREFIX}${learnerId}-${problemId}`;
}

function buildLegacyHintInfoKey({ learnerId, problemId }: HintCacheScope): string {
  return `${LEGACY_HINT_INFO_PREFIX}${learnerId}-${problemId}`;
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    )
  );
}

function safeSetItem(key: string, value: string): HintCacheResult {
  try {
    localStorage.setItem(key, value);
    return {
      success: true,
      bytes: value.length,
      budgetBytes: HINT_CACHE_BUDGET_BYTES,
    };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      logDiagnostic('hint_cache_write_skipped_quota', { key, bytes: value.length });
      return {
        success: false,
        quotaExceeded: true,
        bytes: value.length,
        budgetBytes: HINT_CACHE_BUDGET_BYTES,
        diagnostic: 'hint_cache_write_skipped_quota',
      };
    }

    throw error;
  }
}

function readSnapshot(key: string): HintCacheSnapshot | null {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<HintCacheSnapshot>;
    if (
      typeof parsed.learnerId !== 'string' ||
      typeof parsed.problemId !== 'string' ||
      typeof parsed.updatedAt !== 'number' ||
      typeof parsed.visibleHintCount !== 'number' ||
      typeof parsed.lastHelpRequestIndex !== 'number' ||
      !Array.isArray(parsed.enhancedHintInfo) ||
      (parsed.currentRung !== 1 && parsed.currentRung !== 2 && parsed.currentRung !== 3)
    ) {
      localStorage.removeItem(key);
      return null;
    }

    return sanitizeSnapshot(parsed as HintCacheSnapshot);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function sanitizeSnapshot(snapshot: HintCacheSnapshot): HintCacheSnapshot {
  return {
    updatedAt: snapshot.updatedAt,
    learnerId: snapshot.learnerId,
    problemId: snapshot.problemId,
    currentRung: snapshot.currentRung,
    visibleHintCount: Math.max(0, Math.min(snapshot.visibleHintCount, MAX_ENHANCED_INFO_ENTRIES)),
    lastHintId: snapshot.lastHintId,
    lastHelpRequestIndex: Math.max(0, snapshot.lastHelpRequestIndex),
    lastHintPreview: snapshot.lastHintPreview?.slice(0, MAX_HINT_PREVIEW_CHARS),
    enhancedHintInfo: snapshot.enhancedHintInfo
      .slice(-MAX_ENHANCED_INFO_ENTRIES)
      .map((info) => ({
        isEnhanced: Boolean(info.isEnhanced),
        sources: {
          sqlEngage: Boolean(info.sources?.sqlEngage),
          textbook: Boolean(info.sources?.textbook),
          llm: Boolean(info.sources?.llm),
          pdfPassages: Boolean(info.sources?.pdfPassages),
        },
        llmFailed: info.llmFailed ? true : undefined,
        llmErrorMessage: info.llmErrorMessage?.slice(0, MAX_HINT_ERROR_CHARS),
      })),
  };
}

function serializeSnapshot(input: HintCacheWriteInput): { snapshot: HintCacheSnapshot; raw: string } {
  let snapshot = sanitizeSnapshot({
    ...input,
    updatedAt: input.updatedAt ?? Date.now(),
  });

  let raw = JSON.stringify(snapshot);
  if (raw.length <= HINT_CACHE_BUDGET_BYTES) {
    return { snapshot, raw };
  }

  snapshot = {
    ...snapshot,
    lastHintPreview: snapshot.lastHintPreview?.slice(0, Math.min(80, MAX_HINT_PREVIEW_CHARS)),
    enhancedHintInfo: snapshot.enhancedHintInfo.slice(-Math.min(3, MAX_ENHANCED_INFO_ENTRIES)).map((info) => ({
      ...info,
      llmErrorMessage: info.llmErrorMessage?.slice(0, 40),
    })),
  };

  raw = JSON.stringify(snapshot);
  return { snapshot, raw };
}

function listHintCacheEntries(now = Date.now()): Array<{ key: string; snapshot: HintCacheSnapshot; stale: boolean }> {
  const entries: Array<{ key: string; snapshot: HintCacheSnapshot; stale: boolean }> = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(HINT_CACHE_PREFIX)) {
      continue;
    }

    const snapshot = readSnapshot(key);
    if (!snapshot) {
      continue;
    }

    entries.push({
      key,
      snapshot,
      stale: now - snapshot.updatedAt > HINT_CACHE_TTL_MS,
    });
  }

  return entries.sort((left, right) => left.snapshot.updatedAt - right.snapshot.updatedAt);
}

export function migrateLegacyHintKeys(): { removedCount: number; diagnostic: string } {
  const keysToRemove: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(LEGACY_HINTS_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  if (keysToRemove.length > 0) {
    logDiagnostic('hint_cache_legacy_keys_removed_count', { removedCount: keysToRemove.length });
  }

  return {
    removedCount: keysToRemove.length,
    diagnostic: 'hint_cache_legacy_keys_removed_count',
  };
}

export function cleanupHintCache(options: { now?: number } = {}): HintCacheResult {
  const now = options.now ?? Date.now();
  const entries = listHintCacheEntries(now);
  const keysToRemove = new Set<string>();

  for (const entry of entries) {
    if (entry.stale) {
      keysToRemove.add(entry.key);
    }
  }

  const freshEntries = entries.filter((entry) => !keysToRemove.has(entry.key));
  if (freshEntries.length > MAX_HINT_CACHE_ENTRIES) {
    for (const entry of freshEntries.slice(0, freshEntries.length - MAX_HINT_CACHE_ENTRIES)) {
      keysToRemove.add(entry.key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  if (keysToRemove.size > 0) {
    logDiagnostic('hint_cache_cleanup_removed_count', { removedCount: keysToRemove.size });
  }

  return {
    success: true,
    removedCount: keysToRemove.size,
    diagnostic: 'hint_cache_cleanup_removed_count',
  };
}

export function loadHintInfo(scope: HintCacheScope): HintCacheLoadResult {
  const migration = migrateLegacyHintKeys();
  const cleanup = cleanupHintCache();
  const cacheKey = buildHintCacheKey(scope);
  const snapshot = readSnapshot(cacheKey);

  if (snapshot) {
    return {
      snapshot,
      removedCount: migration.removedCount + (cleanup.removedCount ?? 0),
    };
  }

  const legacyHintInfoKey = buildLegacyHintInfoKey(scope);
  const legacyRaw = localStorage.getItem(legacyHintInfoKey);
  if (!legacyRaw) {
    return {
      snapshot: null,
      removedCount: migration.removedCount + (cleanup.removedCount ?? 0),
    };
  }

  try {
    const parsed = JSON.parse(legacyRaw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(legacyHintInfoKey);
      return {
        snapshot: null,
        removedCount: migration.removedCount + (cleanup.removedCount ?? 0),
      };
    }

    const migratedSnapshot = sanitizeSnapshot({
      updatedAt: Date.now(),
      learnerId: scope.learnerId,
      problemId: scope.problemId,
      currentRung: 1,
      visibleHintCount: parsed.length,
      lastHelpRequestIndex: parsed.length,
      enhancedHintInfo: parsed.map((info) => ({
        isEnhanced: Boolean(info?.isEnhanced),
        sources: {
          sqlEngage: Boolean(info?.sources?.sqlEngage),
          textbook: Boolean(info?.sources?.textbook),
          llm: Boolean(info?.sources?.llm),
          pdfPassages: Boolean(info?.sources?.pdfPassages),
        },
        llmFailed: Boolean(info?.llmFailed) || undefined,
        llmErrorMessage: typeof info?.llmErrorMessage === 'string' ? info.llmErrorMessage : undefined,
      })),
    });

    localStorage.removeItem(legacyHintInfoKey);

    return {
      snapshot: migratedSnapshot,
      removedCount: migration.removedCount + (cleanup.removedCount ?? 0),
    };
  } catch {
    localStorage.removeItem(legacyHintInfoKey);
    return {
      snapshot: null,
      removedCount: migration.removedCount + (cleanup.removedCount ?? 0),
    };
  }
}

export function saveHintSnapshot(input: HintCacheWriteInput): HintCacheResult {
  const cleanup = cleanupHintCache();
  const { snapshot, raw } = serializeSnapshot(input);

  if (raw.length > HINT_CACHE_BUDGET_BYTES) {
    logDiagnostic('hint_cache_budget_bytes', {
      problemId: input.problemId,
      learnerId: input.learnerId,
      bytes: raw.length,
      budgetBytes: HINT_CACHE_BUDGET_BYTES,
    });
    return {
      success: false,
      skipped: true,
      bytes: raw.length,
      budgetBytes: HINT_CACHE_BUDGET_BYTES,
      removedCount: cleanup.removedCount,
      diagnostic: 'hint_cache_budget_bytes',
    };
  }

  const result = safeSetItem(buildHintCacheKey(input), raw);
  return {
    ...result,
    removedCount: cleanup.removedCount,
  };
}

export function clearProblemHints(scope: HintCacheScope): HintCacheResult {
  localStorage.removeItem(buildHintCacheKey(scope));
  localStorage.removeItem(buildLegacyHintsKey(scope));
  localStorage.removeItem(buildLegacyHintInfoKey(scope));
  return { success: true };
}

