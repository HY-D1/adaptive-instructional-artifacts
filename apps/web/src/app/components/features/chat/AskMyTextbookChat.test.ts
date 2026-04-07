import { describe, expect, it } from 'vitest';
import { deriveChatLearningSignals } from './AskMyTextbookChat';
import type { InteractionEvent } from '../../../types';

describe('AskMyTextbookChat learning signals', () => {
  it('summarizes latest error, retries, hints, and stuck state for Groq prompts', () => {
    const interactions: InteractionEvent[] = [
      {
        id: 'exec-1',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_000,
        eventType: 'execution',
        problemId: 'problem-1',
        successful: false,
        errorSubtypeId: 'incorrect_results',
      },
      {
        id: 'hint-1',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_100,
        eventType: 'hint_request',
        problemId: 'problem-1',
      },
      {
        id: 'exec-2',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_200,
        eventType: 'execution',
        problemId: 'problem-1',
        successful: false,
        sqlEngageSubtype: 'missing_from',
      },
    ];

    const signals = deriveChatLearningSignals(interactions, 'problem-1', 'session-1');

    expect(signals.latestIssue).toBe('missing_from');
    expect(signals.failedRunCount).toBe(2);
    expect(signals.retryCount).toBe(1);
    expect(signals.hintCount).toBe(1);
    expect(signals.lastInteractionTypes).toEqual(['execution', 'hint_request', 'execution']);
    expect(signals.stuckReason).toBe('latest_execution_incorrect');
  });
});
