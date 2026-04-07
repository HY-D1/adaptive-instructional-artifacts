import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnhancedRetrievalBundle, RetrievalSignalMeta } from './types';

const mocks = vi.hoisted(() => ({
  generateWithLLM: vi.fn(),
  isLLMAvailable: vi.fn(),
}));

vi.mock('../../api/llm-client', () => ({
  generateWithLLM: mocks.generateWithLLM,
  isLLMAvailable: mocks.isLLMAvailable,
}));

const retrievalBundle: EnhancedRetrievalBundle = {
  problem: {
    id: 'problem-1',
    title: 'Select All Users',
    description: 'Select all columns from users.',
    difficulty: 'beginner',
    concepts: ['select-basic'],
    schema: 'CREATE TABLE users (id INTEGER, name TEXT);',
    expectedQuery: 'SELECT * FROM users;',
    expectedResult: [],
  },
  learnerId: 'learner-1',
  problemId: 'problem-1',
  problemTitle: 'Select All Users',
  schemaText: 'CREATE TABLE users (id INTEGER, name TEXT);',
  lastErrorSubtypeId: 'incorrect results',
  hintHistory: [{ hintLevel: 1, hintText: 'Think about what should appear.', interactionId: 'hint-1' }],
  conceptCandidates: [{ id: 'select-basic', name: 'Basic SELECT', description: 'SELECT basics' }],
  recentInteractionsSummary: { errors: 0, retries: 1, timeSpent: 1000, hintCount: 1 },
  retrievedSourceIds: ['sql-engage:select-basic'],
  triggerInteractionIds: ['exec-1'],
  pdfPassages: [],
  pdfIndexProvenance: null,
  sourcePassages: [],
  whyRetrieved: {
    trigger: 'error_subtype_match',
    errorSubtypeId: 'incorrect results',
    conceptIds: ['select-basic'],
    traceEvidence: {
      errorCount: 0,
      retryCount: 1,
      hintCount: 1,
      timeSpentMs: 1000,
      lastInteractionTypes: ['execution', 'hint_view'],
    },
  },
  conceptSourceRefs: [],
  textbookUnits: [],
};

const retrievalSignals: RetrievalSignalMeta = {
  retrievalConfidence: 0.8,
  retrievedSourceIds: ['sql-engage:select-basic'],
  retrievedChunkIds: [],
};

describe('LLM hint generation safety retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isLLMAvailable.mockResolvedValue(true);
  });

  it('retries with stricter instructions when the first LLM hint leaks a direct answer', async () => {
    mocks.generateWithLLM
      .mockResolvedValueOnce({
        text: 'Content: SELECT * FROM users;\nConcepts: select-basic\nSources: sql-engage:select-basic',
        model: 'openai/gpt-oss-20b',
        params: {},
      })
      .mockResolvedValueOnce({
        text: 'Content: Think about whether your result includes every row the prompt expects.\nConcepts: select-basic\nSources: sql-engage:select-basic',
        model: 'openai/gpt-oss-20b',
        params: {},
      });

    const { generateLLMEnhancedHint } = await import('./llm-generation');
    const result = await generateLLMEnhancedHint(
      {
        learnerId: 'learner-1',
        problemId: 'problem-1',
        sessionId: 'session-1',
        errorSubtypeId: 'incorrect results',
        rung: 2,
        recentInteractions: [
          {
            id: 'exec-1',
            learnerId: 'learner-1',
            sessionId: 'session-1',
            timestamp: 1_700_000_000_000,
            eventType: 'execution',
            problemId: 'problem-1',
            successful: false,
          },
        ],
      },
      retrievalBundle,
      { sqlEngage: true, textbook: false, llm: true, pdfIndex: false },
      retrievalSignals,
    );

    expect(mocks.generateWithLLM).toHaveBeenCalledTimes(2);
    expect(result.content).toContain('every row');
    expect(result.content).not.toContain('SELECT * FROM users');
    expect(result.safetyFilterApplied).toBe(false);
  });
});
