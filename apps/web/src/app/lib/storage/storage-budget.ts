/**
 * Storage Budget Monitor
 * 
 * Proactive storage budget monitoring with configurable thresholds.
 * Prevents quota exceeded errors by monitoring usage and triggering
 * proactive eviction before limits are reached.
 * 
 * Features:
 * - Real-time storage usage estimation
 * - Configurable warning (80%) and critical (95%) thresholds
 * - Automatic proactive trimming at warning threshold
 * - Emergency eviction at critical threshold
 * - Telemetry events for monitoring and alerting
 * - Performance-conscious (uses requestIdleCallback when available)
 */

import { emergencyEviction } from './cache-trimmer';

// ============================================================================
// Constants
// ============================================================================

/** Storage budget: 5MB (typical browser localStorage limit) */
export const STORAGE_BUDGET_BYTES = 5 * 1024 * 1024;

/** Warning threshold: 80% of budget - triggers proactive trimming */
export const WARNING_THRESHOLD = 0.8;

/** Critical threshold: 95% of budget - triggers emergency eviction */
export const CRITICAL_THRESHOLD = 0.95;

/** Default monitoring interval: 30 seconds */
export const DEFAULT_MONITORING_INTERVAL_MS = 30_000;

// ============================================================================
// Types
// ============================================================================

/** Storage budget status levels */
export type StorageBudgetStatus = 'ok' | 'warning' | 'critical';

/** Storage budget information */
export interface StorageBudgetInfo {
  /** Current usage in bytes */
  usedBytes: number;
  /** Total budget in bytes */
  totalBytes: number;
  /** Percentage used (0-1) */
  percentUsed: number;
  /** Status level based on thresholds */
  status: StorageBudgetStatus;
  /** Timestamp of the measurement */
  timestamp: number;
}

/** Storage budget telemetry event */
export interface StorageBudgetTelemetryEvent {
  type: 'storage_budget_warning' | 'storage_budget_critical' | 'storage_budget_ok';
  timestamp: number;
  details: {
    usedBytes: number;
    totalBytes: number;
    percentUsed: number;
    previousStatus?: StorageBudgetStatus;
    newStatus: StorageBudgetStatus;
    actionTaken?: 'proactive_trim' | 'emergency_eviction' | 'none';
    freedBytes?: number;
  };
}

/** Monitoring state */
interface MonitoringState {
  intervalId: ReturnType<typeof setInterval> | null;
  lastStatus: StorageBudgetStatus | null;
  isRunning: boolean;
}

// ============================================================================
// Telemetry
// ============================================================================

const telemetryListeners: Set<(event: StorageBudgetTelemetryEvent) => void> = new Set();

/**
 * Subscribe to storage budget telemetry events
 * @param callback - Function to call when telemetry events are emitted
 * @returns Unsubscribe function
 */
export function subscribeToStorageBudgetTelemetry(
  callback: (event: StorageBudgetTelemetryEvent) => void
): () => void {
  telemetryListeners.add(callback);
  return () => telemetryListeners.delete(callback);
}

/**
 * Emit a storage budget telemetry event
 */
function emitBudgetTelemetry(event: StorageBudgetTelemetryEvent): void {
  // Log to console for debugging
  const prefix = `[telemetry_${event.type}]`;
  if (event.type === 'storage_budget_critical') {
    console.error(prefix, {
      percentUsed: `${(event.details.percentUsed * 100).toFixed(1)}%`,
      usedBytes: event.details.usedBytes,
      totalBytes: event.details.totalBytes,
      actionTaken: event.details.actionTaken,
      freedBytes: event.details.freedBytes,
      timestamp: event.timestamp,
    });
  } else if (event.type === 'storage_budget_warning') {
    console.warn(prefix, {
      percentUsed: `${(event.details.percentUsed * 100).toFixed(1)}%`,
      usedBytes: event.details.usedBytes,
      totalBytes: event.details.totalBytes,
      actionTaken: event.details.actionTaken,
      freedBytes: event.details.freedBytes,
      timestamp: event.timestamp,
    });
  } else {
    console.info(prefix, {
      percentUsed: `${(event.details.percentUsed * 100).toFixed(1)}%`,
      usedBytes: event.details.usedBytes,
      totalBytes: event.details.totalBytes,
      timestamp: event.timestamp,
    });
  }

  // Notify subscribers
  for (const listener of telemetryListeners) {
    try {
      listener(event);
    } catch {
      // Ignore listener errors
    }
  }

  // Dispatch custom event for window listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('storage_budget_status_change', { detail: event })
    );
  }
}

// ============================================================================
// Budget Calculation
// ============================================================================

/**
 * Estimate storage usage across all localStorage keys
 * Calculates actual byte usage using UTF-16 encoding (2 bytes per character)
 * 
 * @returns Total bytes used by all localStorage items
 */
export function estimateStorageUsage(): number {
  if (typeof localStorage === 'undefined') {
    return 0;
  }

  let totalBytes = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          // UTF-16 encoding: 2 bytes per character for both key and value
          totalBytes += (key.length + value.length) * 2;
        }
      }
    }
  } catch (error) {
    // Handle security errors or other access issues
    console.warn('[StorageBudget] Failed to estimate storage usage:', error);
    return 0;
  }

  return totalBytes;
}

/**
 * Get current storage budget status
 * 
 * @returns Budget information including usage, total, percentage, and status
 */
export function getStorageBudgetStatus(): StorageBudgetInfo {
  const usedBytes = estimateStorageUsage();
  const percentUsed = usedBytes / STORAGE_BUDGET_BYTES;
  
  let status: StorageBudgetStatus;
  if (percentUsed >= CRITICAL_THRESHOLD) {
    status = 'critical';
  } else if (percentUsed >= WARNING_THRESHOLD) {
    status = 'warning';
  } else {
    status = 'ok';
  }

  return {
    usedBytes,
    totalBytes: STORAGE_BUDGET_BYTES,
    percentUsed,
    status,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Monitoring State
// ============================================================================

const monitoringState: MonitoringState = {
  intervalId: null,
  lastStatus: null,
  isRunning: false,
};

// ============================================================================
// Proactive Actions
// ============================================================================

/**
 * Run proactive trimming when approaching budget limit
 * Imports and runs the startup trim pass from cache-trimmer
 */
function runProactiveTrimming(): { freedBytes: number; actionTaken: boolean } {
  // Import dynamically to avoid circular dependencies
  const { runStartupTrimPass } = require('./cache-trimmer');
  
  console.info('[StorageBudget] Running proactive trimming at warning threshold');
  
  const result = runStartupTrimPass();
  
  if (result.freedBytes > 0) {
    console.info('[StorageBudget] Proactive trimming freed', result.freedBytes, 'bytes');
  }
  
  return {
    freedBytes: result.freedBytes,
    actionTaken: result.action !== 'none',
  };
}

/**
 * Run emergency eviction at critical threshold
 * Clears all recoverable caches to free up space
 */
function runEmergencyEviction(): { freedBytes: number } {
  console.error('[StorageBudget] Running emergency eviction at critical threshold');
  
  const freedBytes = emergencyEviction();
  
  if (freedBytes > 0) {
    console.info('[StorageBudget] Emergency eviction freed', freedBytes, 'bytes');
  }
  
  return { freedBytes };
}

/**
 * Check budget and take appropriate action based on thresholds
 * Called periodically during monitoring
 */
export function checkBudgetAndAct(): StorageBudgetInfo {
  const info = getStorageBudgetStatus();
  const previousStatus = monitoringState.lastStatus;
  
  // Only take action and emit events when status changes or at critical
  const statusChanged = previousStatus !== info.status;
  const shouldEmit = statusChanged || info.status === 'critical';
  
  if (info.status === 'critical') {
    // Critical threshold: emergency eviction
    const { freedBytes } = runEmergencyEviction();
    
    // Re-check status after eviction
    const newInfo = getStorageBudgetStatus();
    
    if (shouldEmit) {
      emitBudgetTelemetry({
        type: 'storage_budget_critical',
        timestamp: Date.now(),
        details: {
          usedBytes: info.usedBytes,
          totalBytes: info.totalBytes,
          percentUsed: info.percentUsed,
          previousStatus: previousStatus ?? undefined,
          newStatus: newInfo.status,
          actionTaken: 'emergency_eviction',
          freedBytes,
        },
      });
    }
    
    monitoringState.lastStatus = newInfo.status;
    return newInfo;
  }
  
  if (info.status === 'warning') {
    // Warning threshold: proactive trimming
    const { freedBytes, actionTaken } = runProactiveTrimming();
    
    // Re-check status after trimming
    const newInfo = getStorageBudgetStatus();
    
    if (shouldEmit) {
      emitBudgetTelemetry({
        type: 'storage_budget_warning',
        timestamp: Date.now(),
        details: {
          usedBytes: info.usedBytes,
          totalBytes: info.totalBytes,
          percentUsed: info.percentUsed,
          previousStatus: previousStatus ?? undefined,
          newStatus: newInfo.status,
          actionTaken: actionTaken ? 'proactive_trim' : 'none',
          freedBytes,
        },
      });
    }
    
    monitoringState.lastStatus = newInfo.status;
    return newInfo;
  }
  
  // Status is 'ok'
  if (statusChanged && previousStatus !== null) {
    // Emit recovery event when transitioning from warning/critical to ok
    emitBudgetTelemetry({
      type: 'storage_budget_ok',
      timestamp: Date.now(),
      details: {
        usedBytes: info.usedBytes,
        totalBytes: info.totalBytes,
        percentUsed: info.percentUsed,
        previousStatus,
        newStatus: 'ok',
      },
    });
  }
  
  monitoringState.lastStatus = info.status;
  return info;
}

// ============================================================================
// Budget Monitoring
// ============================================================================

/**
 * Perform a single budget check using requestIdleCallback if available
 * Falls back to immediate execution if requestIdleCallback is not available
 */
function performBudgetCheck(): void {
  const check = () => {
    try {
      checkBudgetAndAct();
    } catch (error) {
      console.error('[StorageBudget] Error during budget check:', error);
    }
  };

  // Use requestIdleCallback for non-critical background check if available
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(check, { timeout: 1000 });
  } else {
    // Fall back to setTimeout with 0 delay to yield to main thread
    setTimeout(check, 0);
  }
}

/**
 * Start periodic storage budget monitoring
 * 
 * @param intervalMs - Check interval in milliseconds (default: 30 seconds)
 * @returns Object with stop function to halt monitoring
 */
export function startBudgetMonitoring(
  intervalMs: number = DEFAULT_MONITORING_INTERVAL_MS
): { stop: () => void } {
  // Stop any existing monitoring
  stopBudgetMonitoring();
  
  if (typeof localStorage === 'undefined') {
    console.warn('[StorageBudget] localStorage not available, monitoring disabled');
    return { stop: () => {} };
  }
  
  monitoringState.isRunning = true;
  
  // Perform initial check immediately (but yield to main thread)
  performBudgetCheck();
  
  // Set up periodic checks
  monitoringState.intervalId = setInterval(performBudgetCheck, intervalMs);
  
  console.info(
    `[StorageBudget] Started monitoring with ${intervalMs}ms interval`,
    `(warning: ${(WARNING_THRESHOLD * 100).toFixed(0)}%,`,
    `critical: ${(CRITICAL_THRESHOLD * 100).toFixed(0)}%)`
  );
  
  return {
    stop: stopBudgetMonitoring,
  };
}

/**
 * Stop storage budget monitoring
 */
export function stopBudgetMonitoring(): void {
  if (monitoringState.intervalId !== null) {
    clearInterval(monitoringState.intervalId);
    monitoringState.intervalId = null;
  }
  
  monitoringState.isRunning = false;
  monitoringState.lastStatus = null;
  
  console.info('[StorageBudget] Monitoring stopped');
}

/**
 * Check if budget monitoring is currently running
 */
export function isBudgetMonitoringRunning(): boolean {
  return monitoringState.isRunning;
}

// ============================================================================
// Manual Budget Management
// ============================================================================

/**
 * Force an immediate budget check and action
 * Useful for testing or manual intervention
 */
export function forceBudgetCheck(): StorageBudgetInfo {
  return checkBudgetAndAct();
}

/**
 * Get a human-readable budget summary for debugging
 */
export function getBudgetSummary(): string {
  const info = getStorageBudgetStatus();
  const usedMB = (info.usedBytes / 1024 / 1024).toFixed(2);
  const totalMB = (info.totalBytes / 1024 / 1024).toFixed(2);
  const percent = (info.percentUsed * 100).toFixed(1);
  
  return `[StorageBudget] ${usedMB}MB / ${totalMB}MB (${percent}%) - ${info.status.toUpperCase()}`;
}

// ============================================================================
// Default Export
// ============================================================================

export const storageBudget = {
  estimateStorageUsage,
  getStorageBudgetStatus,
  startBudgetMonitoring,
  stopBudgetMonitoring,
  isBudgetMonitoringRunning,
  forceBudgetCheck,
  getBudgetSummary,
  subscribeToStorageBudgetTelemetry,
};

export default storageBudget;
