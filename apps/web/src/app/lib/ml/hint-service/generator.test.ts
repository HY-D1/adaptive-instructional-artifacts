import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnhancedHint, EnhancedRetrievalBundle, RetrievalSignalMeta } from './types';
import { getGenericFallbackHint } from './safety';

const mocks = vi.hoisted(() => ({
  checkAvailableResources: vi.fn(),
  buildEnhancedRetrievalBundle: vi.fn(),
  extractRetrievalSignals: vi.fn(),
  generateSqlEngageFallbackHint: vi.fn(),
  createUltimateFallbackHint: vi.fn(),
  mergeFallbackReasons: vi.fn((...reasons: Array<string | null | undefined>) =>
    reasons.filter(Boolean).join(',') || null,
  ),
  generateTextbookEnhancedHint: vi.fn(),
  generateLLMEnhancedHint: vi.fn(),
  resolveRefinedHintForProblem: vi.fn(),
  loadConceptMap: vi.fn(),
  getProblemById: vi.fn(),
}));

vi.mock('./resources', () => ({
  checkAvailableResources: mocks.checkAvailableResources,
}));

vi.mock('./retrieval', () => ({
  buildEnhancedRetrievalBundle: mocks.buildEnhancedRetrievalBundle,
  extractRetrievalSignals: mocks.extractRetrievalSignals,
  MIN_RETRIEVAL_CONFIDENCE: 0.45,
}));

vi.mock('./fallback', () => ({
  generateSqlEngageFallbackHint: mocks.generateSqlEngageFallbackHint,
  createUltimateFallbackHint: mocks.createUltimateFallbackHint,
  mergeFallbackReasons: mocks.mergeFallbackReasons,
}));

vi.mock('./textbook-generation', () => ({
  generateTextbookEnhancedHint: mocks.generateTextbookEnhancedHint,
}));

vi.mock('./llm-generation', () => ({
  generateLLMEnhancedHint: mocks.generateLLMEnhancedHint,
}));

vi.mock('./refined-hints', () => ({
  resolveRefinedHintForProblem: mocks.resolveRefinedHintForProblem,
}));

vi.mock('../../content/concept-loader', () => ({
  loadConceptMap: mocks.loadConceptMap,
}));

vi.mock('../../../data/problems', () => ({
  getProblemById: mocks.getProblemById,
}));

const retrievalBundle: EnhancedRetrievalBundle = {
  learnerId: 'learner-1',
  problemId: 'problem-1',
  problemTitle: 'Select All Users',
  schemaText: 'CREATE TABLE users (id INTEGER, name TEXT);',
  lastErrorSubtypeId: 'incorrect results',
  hintHistory: [],
  conceptCandidates: [{ id: 'select-basic', name: 'Basic SELECT', description: 'SELECT basics' }],
  recentInteractionsSummary: { errors: 1, retries: 0, timeSpent: 1000, hintCount: 0 },
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
      errorCount: 1,
      retryCount: 0,
      hintCount: 0,
      timeSpentMs: 1000,
      lastInteractionTypes: ['execution'],
    },
  },
  conceptSourceRefs: [],
  textbookUnits: [],
  problem: {
    id: 'problem-1',
    title: 'Select All Users',
    description: 'Select all users from the users table',
    difficulty: 'beginner',
    concepts: ['select-basic'],
    schema: 'CREATE TABLE users (id INTEGER, name TEXT);',
    expectedQuery: 'SELECT * FROM users',
  },
};

const retrievalSignals: RetrievalSignalMeta = {
  retrievalConfidence: 0.2,
  retrievedSourceIds: ['sql-engage:select-basic'],
  retrievedChunkIds: [],
};

const llmHint: EnhancedHint = {
  content: 'Think about what rows the prompt expects back.',
  rung: 1,
  sources: { sqlEngage: false, textbook: false, llm: true, pdfPassages: false },
  conceptIds: ['select-basic'],
  llmGenerated: true,
  confidence: 0.7,
  retrievalConfidence: 0.2,
  fallbackReason: null,
  safetyFilterApplied: false,
  retrievedSourceIds: ['sql-engage:select-basic'],
  retrievedChunkIds: [],
};

const fallbackHint: EnhancedHint = {
  content: 'Fallback hint',
  rung: 1,
  sources: { sqlEngage: true, textbook: false, llm: false, pdfPassages: false },
  conceptIds: [],
  llmGenerated: false,
  confidence: 0.5,
  retrievalConfidence: 0.2,
  fallbackReason: 'fallback',
  safetyFilterApplied: false,
  retrievedSourceIds: [],
  retrievedChunkIds: [],
};

describe('hint-service Groq-first generator policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAvailableResources.mockReturnValue({
      sqlEngage: true,
      textbook: false,
      llm: true,
      pdfIndex: false,
    });
    mocks.buildEnhancedRetrievalBundle.mockReturnValue(retrievalBundle);
    mocks.extractRetrievalSignals.mockReturnValue(retrievalSignals);
    mocks.generateLLMEnhancedHint.mockResolvedValue(llmHint);
    mocks.resolveRefinedHintForProblem.mockResolvedValue({
      content: null,
      rejectReason: 'missing_refined_hint',
    });
    mocks.generateSqlEngageFallbackHint.mockReturnValue(fallbackHint);
    mocks.createUltimateFallbackHint.mockReturnValue(fallbackHint);
    mocks.generateTextbookEnhancedHint.mockReturnValue({
      ...fallbackHint,
      sources: { ...fallbackHint.sources, textbook: true },
    });
  });

  it('attempts LLM for rung 1 before refined/static hints', async () => {
    mocks.resolveRefinedHintForProblem.mockResolvedValue({
      content: 'Cached static hint',
      sourceChunkIds: ['refined:1'],
      refinementConfidence: 0.9,
    });

    const { generateEnhancedHint } = await import('./generator');
    const result = await generateEnhancedHint({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      sessionId: 'session-1',
      errorSubtypeId: 'incorrect results',
      rung: 1,
      recentInteractions: [],
    });

    expect(result.llmGenerated).toBe(true);
    expect(mocks.generateLLMEnhancedHint).toHaveBeenCalledWith(
      expect.objectContaining({ rung: 1 }),
      retrievalBundle,
      expect.objectContaining({ llm: true }),
      retrievalSignals,
    );
  });

  it('does not let low retrieval confidence block the first LLM attempt', async () => {
    mocks.extractRetrievalSignals.mockReturnValue({
      ...retrievalSignals,
      retrievalConfidence: 0.1,
    });

    const { generateEnhancedHint } = await import('./generator');
    const result = await generateEnhancedHint({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      sessionId: 'session-1',
      errorSubtypeId: 'incorrect results',
      rung: 2,
      recentInteractions: [],
    });

    expect(result.llmGenerated).toBe(true);
    expect(mocks.generateSqlEngageFallbackHint).not.toHaveBeenCalled();
  });

  it('falls back to refined hints after the LLM path fails', async () => {
    mocks.generateLLMEnhancedHint.mockRejectedValue(new Error('groq timeout'));
    mocks.extractRetrievalSignals.mockReturnValue({
      ...retrievalSignals,
      retrievalConfidence: 0.8,
    });
    mocks.resolveRefinedHintForProblem.mockResolvedValue({
      content: 'Cached refined fallback hint',
      sourceChunkIds: ['refined:1'],
      refinementConfidence: 0.9,
    });

    const { generateEnhancedHint } = await import('./generator');
    const result = await generateEnhancedHint({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      sessionId: 'session-1',
      errorSubtypeId: 'incorrect results',
      rung: 2,
      recentInteractions: [],
    });

    expect(result.content).toBe('Cached refined fallback hint');
    expect(result.llmGenerated).toBe(false);
    expect(mocks.generateLLMEnhancedHint).toHaveBeenCalled();
    expect(mocks.resolveRefinedHintForProblem).toHaveBeenCalled();
  });

  it('falls back to refined hints when the LLM helper returns an LLM fallback hint', async () => {
    mocks.generateLLMEnhancedHint.mockResolvedValue({
      ...fallbackHint,
      fallbackReason: 'llm_error',
      llmFailed: true,
    });
    mocks.extractRetrievalSignals.mockReturnValue({
      ...retrievalSignals,
      retrievalConfidence: 0.8,
    });
    mocks.resolveRefinedHintForProblem.mockResolvedValue({
      content: 'Cached refined fallback hint',
      sourceChunkIds: ['refined:1'],
      refinementConfidence: 0.9,
    });

    const { generateEnhancedHint } = await import('./generator');
    const result = await generateEnhancedHint({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      sessionId: 'session-1',
      errorSubtypeId: 'incorrect results',
      rung: 2,
      recentInteractions: [],
    });

    expect(result.content).toBe('Cached refined fallback hint');
    expect(result.llmGenerated).toBe(false);
    expect(mocks.resolveRefinedHintForProblem).toHaveBeenCalled();
  });
});

describe('getGenericFallbackHint improved quality', () => {
  test('rung 1 for group-by gives grouping nudge', () => {
    const hint = getGenericFallbackHint(1, 'missing-group-by');
    expect(hint).toContain('grouping');
    expect(hint.length).toBeLessThanOrEqual(100);
  });

  test('rung 2 for join asks guiding question', () => {
    const hint = getGenericFallbackHint(2, 'missing-join-condition');
    expect(hint).toContain('?');
    expect(hint.length).toBeLessThanOrEqual(220);
  });

  test('rung 3 for aggregation includes pattern', () => {
    const hint = getGenericFallbackHint(3, 'aggregation-error');
    expect(hint).toContain('GROUP BY');
    expect(hint).toContain('___');
    expect(hint.length).toBeLessThanOrEqual(420);
  });

  test('rung 1 for alias gives column name nudge', () => {
    const hint = getGenericFallbackHint(1, 'column-alias-mismatch');
    expect(hint).toContain('column');
  });

  test('rung 3 for alias includes AS pattern', () => {
    const hint = getGenericFallbackHint(3, 'column-alias-mismatch');
    expect(hint).toContain('AS');
  });

  test('unknown subtype still produces valid hint', () => {
    const hint = getGenericFallbackHint(2, 'some-unknown-error');
    expect(hint.length).toBeGreaterThan(10);
    expect(hint.length).toBeLessThanOrEqual(220);
  });
});
