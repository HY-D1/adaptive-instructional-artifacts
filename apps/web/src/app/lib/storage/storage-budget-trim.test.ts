import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkBudgetAndAct, STORAGE_BUDGET_BYTES, stopBudgetMonitoring } from './storage-budget';
import { runStartupTrimPass } from './cache-trimmer';

vi.mock('./cache-trimmer', () => ({
  emergencyEviction: vi.fn(() => 0),
  runStartupTrimPass: vi.fn(() => ({
    action: 'none' as const,
    telemetry: [],
    freedBytes: 0,
    quotaPercentBefore: null,
    quotaPercentAfter: null,
  })),
}));

describe('storage-budget proactive trimming (static import)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    stopBudgetMonitoring();
  });
  afterEach(() => {
    localStorage.clear();
    stopBudgetMonitoring();
  });

  it('runs the startup trim pass at the warning threshold without throwing in ESM', () => {
    // ~85% of budget (UTF-16: 2 bytes/char), above the 80% warning, below 95% critical
    const chars = Math.floor((STORAGE_BUDGET_BYTES * 0.85) / 2);
    localStorage.setItem('filler', 'x'.repeat(chars));

    expect(() => checkBudgetAndAct()).not.toThrow();
    expect(runStartupTrimPass).toHaveBeenCalledTimes(1);
  });
});
