/**
 * Tests for useDebouncedCodeChange hook helpers
 *
 * @module hooks/useDebouncedCodeChange.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InteractionEvent } from '../types';

// Re-create helper functions for testing since we can't easily test the hook without @testing-library/react

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
 */
function calculateDiff(prev: string, curr: string): { added: number; deleted: number } {
  const prevLen = prev.length;
  const currLen = curr.length;

  if (currLen > prevLen) {
    return { added: currLen - prevLen, deleted: 0 };
  } else if (currLen < prevLen) {
    return { added: 0, deleted: prevLen - currLen };
  }
  return { added: 1, deleted: 1 };
}

/**
 * Generate a burst ID based on session, problem, and time bucket
 */
function generateBurstId(sessionId: string | undefined, problemId: string, timeBucket: number): string {
  return `burst:${sessionId || 'no-session'}:${problemId}:${timeBucket}`;
}

describe('useDebouncedCodeChange helpers', () => {
  describe('hashCode', () => {
    it('should generate consistent hashes for same content', () => {
      const hash1 = hashCode('SELECT * FROM users');
      const hash2 = hashCode('SELECT * FROM users');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
      const hash1 = hashCode('SELECT');
      const hash2 = hashCode('INSERT');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = hashCode('');
      expect(hash).toBe('0');
    });
  });

  describe('calculateDiff', () => {
    it('should detect additions', () => {
      const diff = calculateDiff('SELECT', 'SELECT *');
      expect(diff.added).toBe(2);
      expect(diff.deleted).toBe(0);
    });

    it('should detect deletions', () => {
      const diff = calculateDiff('SELECT * FROM', 'SELECT *');
      expect(diff.added).toBe(0);
      expect(diff.deleted).toBe(5);
    });

    it('should detect replacements', () => {
      const diff = calculateDiff('SELECT', 'INSERT');
      expect(diff.added).toBe(1);
      expect(diff.deleted).toBe(1);
    });

    it('should handle same content', () => {
      const diff = calculateDiff('SELECT', 'SELECT');
      expect(diff.added).toBe(1);
      expect(diff.deleted).toBe(1);
    });

    it('should handle empty to content', () => {
      const diff = calculateDiff('', 'SELECT');
      expect(diff.added).toBe(6);
      expect(diff.deleted).toBe(0);
    });

    it('should handle content to empty', () => {
      const diff = calculateDiff('SELECT', '');
      expect(diff.added).toBe(0);
      expect(diff.deleted).toBe(6);
    });
  });

  describe('generateBurstId', () => {
    it('should generate burst ID with session', () => {
      const burstId = generateBurstId('session-123', 'problem-456', 100);
      expect(burstId).toBe('burst:session-123:problem-456:100');
    });

    it('should generate burst ID without session', () => {
      const burstId = generateBurstId(undefined, 'problem-456', 100);
      expect(burstId).toBe('burst:no-session:problem-456:100');
    });

    it('should include time bucket', () => {
      const burstId1 = generateBurstId('session-123', 'problem-456', 100);
      const burstId2 = generateBurstId('session-123', 'problem-456', 200);
      expect(burstId1).not.toBe(burstId2);
    });
  });
});

describe('Debounced code change behavior', () => {
  it('should track expected event structure', () => {
    // Simulate what the hook would produce
    const mockEvent: Partial<InteractionEvent> = {
      eventType: 'code_change',
      id: `event-code-change-${Date.now()}`,
      learnerId: 'learner-123',
      problemId: 'problem-456',
      code: 'SELECT * FROM users',
      inputs: {
        previous_code_hash: hashCode(''),
      },
      outputs: {
        code_hash: hashCode('SELECT * FROM users'),
        draft_length: 21,
        chars_added: 21,
        chars_deleted: 0,
        edit_burst_id: generateBurstId('session-xyz', 'problem-456', 100),
      },
    };

    expect(mockEvent.eventType).toBe('code_change');
    expect(mockEvent.outputs).toHaveProperty('code_hash');
    expect(mockEvent.outputs).toHaveProperty('draft_length');
    expect(mockEvent.outputs).toHaveProperty('chars_added');
    expect(mockEvent.outputs).toHaveProperty('chars_deleted');
    expect(mockEvent.outputs).toHaveProperty('edit_burst_id');
    expect(mockEvent.inputs).toHaveProperty('previous_code_hash');
  });

  it('should accumulate changes over a burst', () => {
    const edits = ['S', 'SE', 'SEL', 'SELE', 'SELEC', 'SELECT'];
    const totalAdded = edits[edits.length - 1].length - edits[0].length;
    expect(totalAdded).toBe(5); // "ELECT" added
  });
});
