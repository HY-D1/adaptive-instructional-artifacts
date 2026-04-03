/**
 * Storage Backup and Restore
 *
 * Provides functionality to export and import all localStorage data
 * for backup, migration, and data portability.
 */

import { storage } from './storage';
import { isValidUserProfile } from './storage-validation';

/**
 * Backup data structure version
 */
export const BACKUP_VERSION = '1.0.0';

/**
 * Complete backup of all application data
 */
export interface AppBackup {
  /** Backup format version */
  version: string;
  /** Timestamp of backup creation */
  createdAt: string;
  /** Application identifier */
  app: 'sql-adapt';
  /** User profile data */
  userProfile?: Record<string, unknown>;
  /** All interaction events */
  interactions: unknown[];
  /** Textbook units */
  textbook: unknown[];
  /** Session data */
  sessions: unknown[];
  /** Learner profiles */
  learnerProfiles?: Record<string, unknown>;
  /** Reinforcement schedules */
  reinforcementSchedules?: unknown[];
  /** PDF index data */
  pdfIndex?: unknown;
  /** Settings and preferences */
  settings?: Record<string, unknown>;
}

/**
 * Export all data to a backup object
 *
 * @returns Complete backup of all application data
 * @example
 * ```typescript
 * const backup = exportAllData();
 * const json = JSON.stringify(backup, null, 2);
 * // Save to file or cloud storage
 * ```
 */
export function exportAllData(): AppBackup {
  const backup: AppBackup = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    app: 'sql-adapt',
    userProfile: safeGetStorageItem('sql-adapt-user-profile'),
    interactions: safeGetStorageArray('sql-learning-interactions'),
    textbook: safeGetStorageArray('sql-learning-textbook'),
    sessions: safeGetStorageArray('sql-learning-active-session'),
    learnerProfiles: safeGetStorageObject('sql-learning-profiles'),
    reinforcementSchedules: safeGetStorageArray('sql-learning-reinforcement-schedules'),
    pdfIndex: safeGetStorageItem('sql-learning-pdf-index'),
    settings: {
      lastActive: localStorage.getItem('sql-adapt-last-active'),
      sessionConfig: safeGetStorageItem('sql-adapt-session-config'),
    },
  };

  return backup;
}

/**
 * Import data from a backup object
 *
 * @param backup - Backup data to import
 * @param options - Import options
 * @returns Result of import operation
 * @example
 * ```typescript
 * const backup = JSON.parse(jsonString);
 * const result = importAllData(backup, { merge: false });
 * if (!result.success) {
 *   console.error('Import failed:', result.errors);
 * }
 * ```
 */
export function importAllData(
  backup: AppBackup,
  options: { merge?: boolean; validate?: boolean } = {}
): { success: boolean; imported: string[]; errors: string[] } {
  const { merge = false, validate = true } = options;
  const imported: string[] = [];
  const errors: string[] = [];

  // Validate backup structure
  if (validate && !isValidBackup(backup)) {
    errors.push('Invalid backup structure');
    return { success: false, imported, errors };
  }

  // Clear existing data if not merging
  if (!merge) {
    clearAllData();
  }

  // Import user profile
  if (backup.userProfile) {
    try {
      if (!validate || isValidUserProfile(backup.userProfile)) {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify(backup.userProfile));
        imported.push('userProfile');
      } else {
        errors.push('Invalid user profile');
      }
    } catch (err) {
      errors.push(`Failed to import user profile: ${err}`);
    }
  }

  // Import interactions
  if (backup.interactions?.length > 0) {
    try {
      const existing = merge ? safeGetStorageArray('sql-learning-interactions') : [];
      const merged = [...existing, ...backup.interactions];
      localStorage.setItem('sql-learning-interactions', JSON.stringify(merged));
      imported.push(`interactions (${backup.interactions.length})`);
    } catch (err) {
      errors.push(`Failed to import interactions: ${err}`);
    }
  }

  // Import textbook
  if (backup.textbook?.length > 0) {
    try {
      const existing = merge ? safeGetStorageArray('sql-learning-textbook') : [];
      const merged = [...existing, ...backup.textbook];
      localStorage.setItem('sql-learning-textbook', JSON.stringify(merged));
      imported.push(`textbook (${backup.textbook.length} units)`);
    } catch (err) {
      errors.push(`Failed to import textbook: ${err}`);
    }
  }

  // Import sessions
  if (backup.sessions?.length > 0) {
    try {
      localStorage.setItem('sql-learning-active-session', JSON.stringify(backup.sessions[0]));
      imported.push('sessions');
    } catch (err) {
      errors.push(`Failed to import sessions: ${err}`);
    }
  }

  // Import learner profiles
  if (backup.learnerProfiles && Object.keys(backup.learnerProfiles).length > 0) {
    try {
      localStorage.setItem('sql-learning-profiles', JSON.stringify(backup.learnerProfiles));
      imported.push('learnerProfiles');
    } catch (err) {
      errors.push(`Failed to import learner profiles: ${err}`);
    }
  }

  // Import reinforcement schedules
  if (backup.reinforcementSchedules?.length > 0) {
    try {
      localStorage.setItem(
        'sql-learning-reinforcement-schedules',
        JSON.stringify(backup.reinforcementSchedules)
      );
      imported.push('reinforcementSchedules');
    } catch (err) {
      errors.push(`Failed to import reinforcement schedules: ${err}`);
    }
  }

  // Import PDF index
  if (backup.pdfIndex) {
    try {
      localStorage.setItem('sql-learning-pdf-index', JSON.stringify(backup.pdfIndex));
      imported.push('pdfIndex');
    } catch (err) {
      errors.push(`Failed to import PDF index: ${err}`);
    }
  }

  // Import settings
  if (backup.settings?.lastActive) {
    localStorage.setItem('sql-adapt-last-active', backup.settings.lastActive);
  }
  if (backup.settings?.sessionConfig) {
    localStorage.setItem('sql-adapt-session-config', JSON.stringify(backup.settings.sessionConfig));
  }

  return {
    success: errors.length === 0,
    imported,
    errors,
  };
}

/**
 * Clear all application data from localStorage
 *
 * @param options - Options for clearing data
 * @example
 * ```typescript
 * // Clear everything
 * clearAllData();
 *
 * // Clear only user data, keep settings
 * clearAllData({ keepSettings: true });
 * ```
 */
export function clearAllData(options: { keepSettings?: boolean } = {}): void {
  const { keepSettings = false } = options;

  const keysToRemove = [
    'sql-adapt-user-profile',
    'sql-learning-interactions',
    'sql-learning-textbook',
    'sql-learning-active-session',
    'sql-learning-profiles',
    'sql-learning-reinforcement-schedules',
    'sql-learning-llm-cache',
    'sql-learning-practice-drafts',
    'sql-adapt-last-active',
  ];

  if (!keepSettings) {
    keysToRemove.push('sql-adapt-session-config');
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

/**
 * Export data as a JSON file download
 *
 * @param filename - Optional custom filename
 * @example
 * ```typescript
 * // Download with default filename
 * downloadBackup();
 *
 * // Download with custom filename
 * downloadBackup('my-backup-2024.json');
 * ```
 */
export function downloadBackup(filename?: string): void {
  const backup = exportAllData();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `sql-adapt-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Read a backup file from an input element
 *
 * @param file - File from file input
 * @returns Promise resolving to backup data
 * @example
 * ```typescript
 * const input = document.getElementById('file-input') as HTMLInputElement;
 * const file = input.files?.[0];
 * if (file) {
 *   const backup = await readBackupFile(file);
 *   const result = importAllData(backup);
 * }
 * ```
 */
export function readBackupFile(file: File): Promise<AppBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const backup = JSON.parse(json) as AppBackup;
        resolve(backup);
      } catch (err) {
        reject(new Error(`Failed to parse backup file: ${err}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Get summary of stored data
 *
 * @returns Summary statistics of localStorage usage
 * @example
 * ```typescript
 * const summary = getStorageSummary();
 * console.log(`Interactions: ${summary.interactionCount}`);
 * console.log(`Storage used: ${summary.totalSizeKB} KB`);
 * ```
 */
export function getStorageSummary(): {
  interactionCount: number;
  textbookUnitCount: number;
  hasUserProfile: boolean;
  hasActiveSession: boolean;
  totalSizeKB: number;
  lastActive: string | null;
} {
  const interactions = safeGetStorageArray('sql-learning-interactions');
  const textbook = safeGetStorageArray('sql-learning-textbook');
  const userProfile = safeGetStorageItem('sql-adapt-user-profile');
  const session = localStorage.getItem('sql-learning-active-session');
  const lastActive = localStorage.getItem('sql-adapt-last-active');

  // Calculate total size
  let totalSize = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('sql-')) {
      const value = localStorage.getItem(key) || '';
      totalSize += value.length * 2; // UTF-16 = 2 bytes per char
    }
  }

  return {
    interactionCount: interactions.length,
    textbookUnitCount: textbook.length,
    hasUserProfile: !!userProfile,
    hasActiveSession: !!session,
    totalSizeKB: Math.round(totalSize / 1024),
    lastActive: lastActive,
  };
}

// Helper functions

function safeGetStorageItem(key: string): Record<string, unknown> | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function safeGetStorageArray(key: string): unknown[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function safeGetStorageObject(key: string): Record<string, unknown> | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isValidBackup(backup: unknown): backup is AppBackup {
  if (typeof backup !== 'object' || backup === null) {
    return false;
  }

  const b = backup as Record<string, unknown>;

  // Check required fields
  if (b.version !== BACKUP_VERSION) {
    return false;
  }
  if (b.app !== 'sql-adapt') {
    return false;
  }
  if (typeof b.createdAt !== 'string') {
    return false;
  }

  // Check arrays
  if (!Array.isArray(b.interactions)) {
    return false;
  }
  if (!Array.isArray(b.textbook)) {
    return false;
  }

  return true;
}
