import { describe, expect, it } from 'vitest';
import { buildEnhancedRetrievalBundle } from './retrieval';

describe('hint-service retrieval bundle', () => {
  it('keeps the canonical problem object for LLM prompt construction', () => {
    const bundle = buildEnhancedRetrievalBundle(
      {
        learnerId: 'learner-1',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query',
        rung: 1,
        recentInteractions: [],
      },
      {
        sqlEngage: true,
        textbook: false,
        llm: true,
        pdfIndex: false,
      },
    );

    expect(bundle?.problem?.id).toBe('problem-1');
    expect(bundle?.problem?.title).toBeTruthy();
  });
});
