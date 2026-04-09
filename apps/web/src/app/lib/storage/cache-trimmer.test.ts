/**
 * Unit tests for Cache Trimmer (Workstream 4/6)
 * 
 * Tests size-aware trimming for noncritical local caches:
 * - Chat history: cap at 50 messages per learner/problem, FIFO eviction
 * - Hint backup: cap at 20 hints per learner/problem
 * - LLM cache: already has LRU eviction at 100 entries
 * - PDF index: already has memory fallback
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MAX_CHAT_MESSAGES,
  checkStorageQuota,
  getCacheStats,
  trimChatHistory,
  trimAllChatHistories,
  trimLLMCache,
  clearPdfIndex,
  runStartupTrimPass,
  emergencyEviction,
  type StorageEvictionTelemetry
} from './cache-trimmer';
import { cleanupHintCache } from './hint-cache';

// Mock hint-cache module
vi.mock('./hint-cache', () => ({
  cleanupHintCache: vi.fn(() => ({ success: true, removedCount: 0 }))
}));

describe('Cache Trimmer', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MAX_CHAT_MESSAGES', () => {
    it('should be 50', () => {
      expect(MAX_CHAT_MESSAGES).toBe(50);
    });
  });

  describe('checkStorageQuota', () => {
    it('should return used bytes and estimated quota', () => {
      // Add some data
      localStorage.setItem('test-key', 'test-value');
      
      const result = checkStorageQuota();
      
      expect(result.used).toBeGreaterThan(0);
      expect(result.total).toBe(5 * 1024 * 1024); // 5MB estimate
      expect(result.percent).toBeGreaterThan(0);
      expect(result.percent).toBeLessThan(1);
    });

    it('should return null percent if total is null', () => {
      const result = checkStorageQuota();
      
      expect(result.used).toBe(0);
      expect(result.total).toBe(5 * 1024 * 1024);
      expect(result.percent).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return zero stats for empty storage', () => {
      const stats = getCacheStats();
      
      expect(stats.chatHistoryKeys).toBe(0);
      expect(stats.hintCacheKeys).toBe(0);
      expect(stats.llmCacheEntries).toBe(0);
      expect(stats.pdfIndexSize).toBe(0);
      expect(stats.estimatedBytes).toBe(0);
    });

    it('should count chat history keys', () => {
      localStorage.setItem('chat-history-learner1-problem1', JSON.stringify([{ id: '1' }]));
      localStorage.setItem('chat-history-learner1-problem2', JSON.stringify([{ id: '2' }]));
      
      const stats = getCacheStats();
      
      expect(stats.chatHistoryKeys).toBe(2);
      expect(stats.estimatedBytes).toBeGreaterThan(0);
    });

    it('should count hint cache keys', () => {
      localStorage.setItem('hint-cache:learner1:problem1', JSON.stringify({ updatedAt: Date.now() }));
      
      const stats = getCacheStats();
      
      expect(stats.hintCacheKeys).toBe(1);
    });

    it('should count LLM cache entries', () => {
      localStorage.setItem('sql-learning-llm-cache', JSON.stringify({
        key1: { createdAt: Date.now() },
        key2: { createdAt: Date.now() }
      }));
      
      const stats = getCacheStats();
      
      expect(stats.llmCacheEntries).toBe(2);
    });

    it('should track PDF index size', () => {
      const pdfIndex = { indexId: 'test', chunks: [{ text: 'content' }] };
      localStorage.setItem('sql-learning-pdf-index', JSON.stringify(pdfIndex));
      
      const stats = getCacheStats();
      
      expect(stats.pdfIndexSize).toBeGreaterThan(0);
    });
  });

  describe('trimChatHistory', () => {
    it('should return 0 if no chat history exists', () => {
      const bytesRemoved = trimChatHistory('learner1', 'problem1');
      expect(bytesRemoved).toBe(0);
    });

    it('should return 0 if chat history is within limit', () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`
      }));
      localStorage.setItem('chat-history-learner1-problem1', JSON.stringify(messages));
      
      const bytesRemoved = trimChatHistory('learner1', 'problem1');
      
      expect(bytesRemoved).toBe(0);
    });

    it('should trim chat history to MAX_CHAT_MESSAGES with FIFO eviction', () => {
      const messages = Array.from({ length: 60 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        timestamp: Date.now() + i
      }));
      localStorage.setItem('chat-history-learner1-problem1', JSON.stringify(messages));
      
      const bytesRemoved = trimChatHistory('learner1', 'problem1');
      
      expect(bytesRemoved).toBeGreaterThan(0);
      
      const trimmed = JSON.parse(localStorage.getItem('chat-history-learner1-problem1')!);
      expect(trimmed.length).toBe(MAX_CHAT_MESSAGES);
      
      // Verify FIFO - oldest messages should be removed
      expect(trimmed[0].id).toBe('msg-10'); // First 10 removed, so first is now msg-10
      expect(trimmed[trimmed.length - 1].id).toBe('msg-59'); // Most recent preserved
    });

    it('should remove invalid JSON entries', () => {
      localStorage.setItem('chat-history-learner1-problem1', 'invalid json');
      
      const bytesRemoved = trimChatHistory('learner1', 'problem1');
      
      expect(bytesRemoved).toBeGreaterThan(0);
      expect(localStorage.getItem('chat-history-learner1-problem1')).toBeNull();
    });
  });

  describe('trimAllChatHistories', () => {
    it('should return telemetry with zero values when no chat histories exist', () => {
      const telemetry = trimAllChatHistories();
      
      expect(telemetry.eventType).toBe('storage_eviction');
      expect(telemetry.keyClass).toBe('chat_history');
      expect(telemetry.bytesRemoved).toBe(0);
      expect(telemetry.entriesRemoved).toBe(0);
      expect(telemetry.trigger).toBe('startup_trim');
    });

    it('should trim multiple chat histories', () => {
      // Create 3 chat histories with 60 messages each
      for (let i = 1; i <= 3; i++) {
        const messages = Array.from({ length: 60 }, (_, j) => ({
          id: `msg-${j}`,
          content: `Message ${j} for problem ${i}`
        }));
        localStorage.setItem(`chat-history-learner1-problem${i}`, JSON.stringify(messages));
      }
      
      const telemetry = trimAllChatHistories();
      
      expect(telemetry.entriesRemoved).toBe(30); // 10 removed from each of 3 histories
      expect(telemetry.bytesRemoved).toBeGreaterThan(0);
      
      // Verify all are now at max
      for (let i = 1; i <= 3; i++) {
        const history = JSON.parse(localStorage.getItem(`chat-history-learner1-problem${i}`)!);
        expect(history.length).toBe(MAX_CHAT_MESSAGES);
      }
    });

    it('should handle mixed valid and invalid entries', () => {
      localStorage.setItem('chat-history-learner1-problem1', JSON.stringify([{ id: '1' }]));
      localStorage.setItem('chat-history-learner1-problem2', 'invalid json');
      
      const telemetry = trimAllChatHistories();
      
      expect(telemetry.entriesRemoved).toBe(1); // Invalid entry removed
      expect(localStorage.getItem('chat-history-learner1-problem2')).toBeNull();
    });
  });

  describe('trimLLMCache', () => {
    it('should return 0 if no LLM cache exists', () => {
      const bytesRemoved = trimLLMCache();
      expect(bytesRemoved).toBe(0);
    });

    it('should return 0 if cache is within target size', () => {
      const cache: Record<string, { createdAt: number }> = {};
      for (let i = 0; i < 50; i++) {
        cache[`key-${i}`] = { createdAt: Date.now() + i };
      }
      localStorage.setItem('sql-learning-llm-cache', JSON.stringify(cache));
      
      const bytesRemoved = trimLLMCache(100);
      
      expect(bytesRemoved).toBe(0);
    });

    it('should trim oldest entries first (LRU)', () => {
      const cache: Record<string, { createdAt: number }> = {};
      for (let i = 0; i < 120; i++) {
        cache[`key-${i}`] = { createdAt: 1000 + i }; // Oldest first
      }
      localStorage.setItem('sql-learning-llm-cache', JSON.stringify(cache));
      
      const bytesRemoved = trimLLMCache(100);
      
      expect(bytesRemoved).toBeGreaterThan(0);
      
      const trimmed = JSON.parse(localStorage.getItem('sql-learning-llm-cache')!);
      expect(Object.keys(trimmed).length).toBe(100);
      
      // Oldest 20 should be removed
      expect(trimmed['key-0']).toBeUndefined();
      expect(trimmed['key-19']).toBeUndefined();
      expect(trimmed['key-20']).toBeDefined();
      expect(trimmed['key-119']).toBeDefined();
    });

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem('sql-learning-llm-cache', 'invalid json');
      
      const bytesRemoved = trimLLMCache();
      
      expect(bytesRemoved).toBe(0);
    });
  });

  describe('clearPdfIndex', () => {
    it('should return 0 if no PDF index exists', () => {
      const bytesRemoved = clearPdfIndex();
      expect(bytesRemoved).toBe(0);
    });

    it('should remove PDF index and return bytes removed', () => {
      const pdfIndex = { indexId: 'test', chunks: Array(100).fill({ text: 'content' }) };
      const raw = JSON.stringify(pdfIndex);
      localStorage.setItem('sql-learning-pdf-index', raw);
      
      const bytesRemoved = clearPdfIndex();
      
      expect(bytesRemoved).toBe(raw.length);
      expect(localStorage.getItem('sql-learning-pdf-index')).toBeNull();
    });
  });

  describe('runStartupTrimPass', () => {
    it('should return "none" action when no caches need trimming', () => {
      const result = runStartupTrimPass();
      
      expect(result.action).toBe('none');
      expect(result.telemetry).toHaveLength(0);
      expect(result.freedBytes).toBe(0);
    });

    it('should trim chat histories on startup', () => {
      const messages = Array.from({ length: 60 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`
      }));
      localStorage.setItem('chat-history-learner1-problem1', JSON.stringify(messages));
      
      const result = runStartupTrimPass();
      
      expect(result.action).toBe('trimmed');
      expect(result.telemetry.length).toBeGreaterThan(0);
      expect(result.telemetry[0].keyClass).toBe('chat_history');
      expect(result.telemetry[0].entriesRemoved).toBe(10);
      expect(result.freedBytes).toBeGreaterThan(0);
    });

    it('should run hint cache cleanup on startup', () => {
      vi.mocked(cleanupHintCache).mockReturnValue({
        success: true,
        removedCount: 5,
        bytes: 1000
      });
      
      const result = runStartupTrimPass();
      
      expect(cleanupHintCache).toHaveBeenCalled();
      const hintTelemetry = result.telemetry.find(t => t.keyClass === 'hint_backup');
      expect(hintTelemetry).toBeDefined();
      expect(hintTelemetry?.entriesRemoved).toBe(5);
      expect(hintTelemetry?.bytesRemoved).toBe(1000);
    });

    it('should emit telemetry with quota information', () => {
      const messages = Array.from({ length: 60 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`
      }));
      localStorage.setItem('chat-history-learner1-problem1', JSON.stringify(messages));
      
      const result = runStartupTrimPass();
      
      expect(result.telemetry[0].quotaPercentBefore).toBeDefined();
      expect(result.telemetry[0].quotaPercentAfter).toBeDefined();
    });
  });

  describe('emergencyEviction', () => {
    it('should clear all recoverable caches', () => {
      // Setup various caches
      localStorage.setItem('chat-history-learner1-problem1', JSON.stringify([{ id: '1' }]));
      localStorage.setItem('chat-history-learner1-problem2', JSON.stringify([{ id: '2' }]));
      localStorage.setItem('hint-cache:learner1:problem1', JSON.stringify({}));
      localStorage.setItem('sql-learning-llm-cache', JSON.stringify({ key: {} }));
      localStorage.setItem('sql-learning-pdf-index', JSON.stringify({ indexId: 'test' }));
      
      const freedBytes = emergencyEviction();
      
      expect(freedBytes).toBeGreaterThan(0);
      expect(localStorage.getItem('chat-history-learner1-problem1')).toBeNull();
      expect(localStorage.getItem('chat-history-learner1-problem2')).toBeNull();
      expect(localStorage.getItem('hint-cache:learner1:problem1')).toBeNull();
      expect(localStorage.getItem('sql-learning-llm-cache')).toBeNull();
      expect(localStorage.getItem('sql-learning-pdf-index')).toBeNull();
    });

    it('should emit telemetry event', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      localStorage.setItem('chat-history-learner1-problem1', JSON.stringify([{ id: '1' }]));
      
      emergencyEviction();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[storage_eviction]',
        expect.objectContaining({
          keyClass: 'mixed',
          trigger: 'manual'
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle empty storage gracefully', () => {
      const freedBytes = emergencyEviction();
      
      expect(freedBytes).toBe(0);
    });
  });

  describe('FIFO eviction behavior', () => {
    it('should preserve most recent messages when trimming', () => {
      const messages = Array.from({ length: 55 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message content ${i}`,
        timestamp: 1000 + i
      }));
      localStorage.setItem('chat-history-learner1-problem1', JSON.stringify(messages));
      
      trimChatHistory('learner1', 'problem1');
      
      const remaining = JSON.parse(localStorage.getItem('chat-history-learner1-problem1')!);
      
      // Should keep the most recent 50
      expect(remaining.length).toBe(50);
      expect(remaining[0].id).toBe('msg-5'); // Oldest 5 removed
      expect(remaining[49].id).toBe('msg-54'); // Most recent kept
    });
  });

  describe('graceful degradation', () => {
    it('should not throw when localStorage is unavailable', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('localStorage unavailable');
      });
      
      expect(() => getCacheStats()).not.toThrow();
      
      localStorage.getItem = originalGetItem;
    });

    it('should handle malformed chat history gracefully', () => {
      localStorage.setItem('chat-history-learner1-problem1', '{invalid json');
      
      const bytesRemoved = trimChatHistory('learner1', 'problem1');
      
      expect(bytesRemoved).toBeGreaterThan(0);
      expect(localStorage.getItem('chat-history-learner1-problem1')).toBeNull();
    });
  });
});
