/**
 * useDebouncedCodeChange Hook
 *
 * Debounces code_change telemetry events to reduce noise.
 * Keeps draft persistence immediate (for UX) but debounces telemetry (for research).
 *
 * Paper Data Contract Requirements:
 * - Debounce duration: 1500-2000ms idle
 * - Emit on: idle debounce, blur, execute/run, problem leave/unmount
 * - Do NOT emit: individual keystrokes, problem switching
 * - Include: previousCodeHash, codeHash, draftLength, charsAdded, charsDeleted, editBurstId
 *
 * @module hooks/useDebouncedCodeChange
 */

import { useRef, useCallback, useEffect } from 'react';
import type { InteractionEvent } from '../types';

export interface DebouncedCodeChangeOptions {
  /** Learner ID */
  learnerId: string;
  /** Session ID */
  sessionId?: string;
  /** Current problem ID */
  problemId: string;
  /** Condition ID for experimental tracking */
  conditionId?: string;
  /** Debounce delay in milliseconds (default: 1500) */
  debounceMs?: number;
  /** Callback to save the interaction event */
  onSaveInteraction: (event: InteractionEvent) => void;
}

export interface CodeChangeMetrics {
  /** Hash of code before change */
  previousCodeHash: string;
  /** Hash of code after change */
  codeHash: string;
  /** Character count after change */
  draftLength: number;
  /** Characters added in this change */
  charsAdded: number;
  /** Characters deleted in this change */
  charsDeleted: number;
  /** Identifier for this burst of edits */
  editBurstId: string;
}

/**
 * Simple hash function for code content
 */
function hashCode(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Calculate diff between two strings
 * Returns approximate chars added and deleted
 */
function calculateDiff(prev: string, curr: string): { added: number; deleted: number } {
  // Simple length-based diff for performance
  // More sophisticated diff algorithms could be used if needed
  const prevLen = prev.length;
  const currLen = curr.length;

  if (currLen > prevLen) {
    return { added: currLen - prevLen, deleted: 0 };
  } else if (currLen < prevLen) {
    return { added: 0, deleted: prevLen - currLen };
  }

  // Same length but content changed - approximate as replacement
  return { added: 1, deleted: 1 };
}

/**
 * Generate a burst ID based on session, problem, and time bucket
 */
function generateBurstId(sessionId: string | undefined, problemId: string): string {
  const timeBucket = Math.floor(Date.now() / 10000); // 10-second buckets
  return `burst:${sessionId || 'no-session'}:${problemId}:${timeBucket}`;
}

export function useDebouncedCodeChange(options: DebouncedCodeChangeOptions) {
  const {
    learnerId,
    sessionId,
    problemId,
    conditionId,
    debounceMs = 1500,
    onSaveInteraction,
  } = options;

  // Refs for managing debounce state
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCodeRef = useRef<string | null>(null);
  const previousCodeRef = useRef<string>('');
  const burstIdRef = useRef<string>(generateBurstId(sessionId, problemId));
  const isDirtyRef = useRef(false);

  // Update burst ID when session or problem changes
  useEffect(() => {
    burstIdRef.current = generateBurstId(sessionId, problemId);
  }, [sessionId, problemId]);

  /**
   * Emit a code_change event with full metrics
   */
  const emitCodeChange = useCallback((code: string, force: boolean = false) => {
    if (!isDirtyRef.current && !force) {
      return;
    }

    const previousCode = previousCodeRef.current;
    const diff = calculateDiff(previousCode, code);

    // Don't emit if no meaningful change
    if (diff.added === 0 && diff.deleted === 0 && !force) {
      return;
    }

    const metrics: CodeChangeMetrics = {
      previousCodeHash: hashCode(previousCode),
      codeHash: hashCode(code),
      draftLength: code.length,
      charsAdded: diff.added,
      charsDeleted: diff.deleted,
      editBurstId: burstIdRef.current,
    };

    const event: InteractionEvent = {
      id: `event-code-change-${Date.now()}`,
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'code_change',
      problemId,
      code,
      conditionId,
      inputs: {
        previous_code_hash: metrics.previousCodeHash,
      },
      outputs: {
        code_hash: metrics.codeHash,
        draft_length: metrics.draftLength,
        chars_added: metrics.charsAdded,
        chars_deleted: metrics.charsDeleted,
        edit_burst_id: metrics.editBurstId,
      },
    };

    onSaveInteraction(event);

    // Update previous code reference
    previousCodeRef.current = code;
    isDirtyRef.current = false;
  }, [learnerId, sessionId, problemId, conditionId, onSaveInteraction]);

  /**
   * Handle code change - debounces telemetry but tracks state
   */
  const handleCodeChange = useCallback((code: string) => {
    // Track that we have pending changes
    pendingCodeRef.current = code;
    isDirtyRef.current = true;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced emission
    timeoutRef.current = setTimeout(() => {
      if (pendingCodeRef.current !== null) {
        emitCodeChange(pendingCodeRef.current);
        pendingCodeRef.current = null;
      }
    }, debounceMs);
  }, [debounceMs, emitCodeChange]);

  /**
   * Flush pending changes immediately
   * Call on: blur, execute/run, problem leave/unmount
   */
  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (pendingCodeRef.current !== null) {
      emitCodeChange(pendingCodeRef.current, true);
      pendingCodeRef.current = null;
    }
  }, [emitCodeChange]);

  /**
   * Reset the debounce state (e.g., when problem changes)
   */
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingCodeRef.current = null;
    previousCodeRef.current = '';
    burstIdRef.current = generateBurstId(sessionId, problemId);
    isDirtyRef.current = false;
  }, [sessionId, problemId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Flush any pending changes before unmount
      if (pendingCodeRef.current !== null) {
        emitCodeChange(pendingCodeRef.current, true);
      }
    };
  }, [emitCodeChange]);

  return {
    handleCodeChange,
    flush,
    reset,
  };
}
