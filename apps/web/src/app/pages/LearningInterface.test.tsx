import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GeneratedExplanationCard,
  GeneratedExplanationPreview,
  SessionConfigErrorCard,
  SESSION_CONFIG_ERROR_MESSAGE,
  resolvePracticeDraftState,
  resolvePracticeProblemFromSources,
} from './LearningInterface';
import type { SQLProblem } from '../types';

const problems: SQLProblem[] = [
  {
    id: 'problem-1',
    title: 'Problem One',
    description: 'First problem',
    difficulty: 'beginner',
    concepts: ['select-basics'],
    schema: 'CREATE TABLE users (id INT, name TEXT);',
    expectedQuery: 'SELECT 1',
    expectedResult: [],
    topic: 'basics',
    topicDifficultyLevel: 1,
  },
  {
    id: 'problem-2',
    title: 'Problem Two',
    description: 'Second problem',
    difficulty: 'beginner',
    concepts: ['where-filtering'],
    schema: 'CREATE TABLE users (id INT, name TEXT);',
    expectedQuery: 'SELECT 2',
    expectedResult: [],
    topic: 'basics',
    topicDifficultyLevel: 1,
  },
];

const fallbackProblem = problems[0];
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
});

describe('LearningInterface restore precedence', () => {
  it('prefers backend session problem over stale persisted UI state in account mode', () => {
    const resolved = resolvePracticeProblemFromSources({
      problems,
      fallbackProblem,
      persistedProblemId: 'problem-1',
      backendProblemId: 'problem-2',
      preferBackendProblem: true,
    });

    expect(resolved.id).toBe('problem-2');
  });

  it('keeps backend problem locked when a different local draft exists', () => {
    const drafts = new Map<string, string>([
      ['session-backend::problem-1', 'SELECT stale_problem_one'],
    ]);

    const resolved = resolvePracticeDraftState({
      sessionId: 'session-backend',
      fallbackProblem,
      problems,
      isMeaningfulDraft: (draft): draft is string =>
        typeof draft === 'string' && draft.trim().length > 0,
      lockProblemId: 'problem-2',
      lookup: {
        getPracticeDraft: (sessionId, problemId) => drafts.get(`${sessionId}::${problemId}`) ?? null,
        findAnyPracticeDraft: (problemId) => {
          for (const [key, value] of drafts.entries()) {
            if (key.endsWith(`::${problemId}`)) {
              return value;
            }
          }
          return null;
        },
      },
    });

    expect(resolved.problem.id).toBe('problem-2');
    expect(resolved.draft).toBeNull();
  });
});

describe('GeneratedExplanationPreview', () => {
  it('shows the generated explanation text when a unit exists', () => {
    render(
      <GeneratedExplanationPreview
        unit={{
          id: 'unit-explanation',
          type: 'explanation',
          conceptId: 'select-basics',
          title: 'Understanding SELECT',
          content: 'Use **SELECT** to choose columns.',
          contentFormat: 'markdown',
          prerequisites: [],
          addedTimestamp: 1,
          sourceInteractionIds: [],
        }}
      />,
    );

    expect(screen.getByText('Use', { exact: false })).toBeTruthy();
  });
});

describe('GeneratedExplanationCard', () => {
  const unit = {
    id: 'unit-explanation',
    type: 'explanation' as const,
    conceptId: 'select-basics',
    title: 'Understanding SELECT',
    content: 'Use **SELECT** to choose columns.',
    contentFormat: 'markdown' as const,
    prerequisites: [],
    addedTimestamp: 1,
    sourceInteractionIds: [],
  };

  it('renders between the explanation banner and Ask My Textbook slot', () => {
    const { container } = render(
      <div>
        <div data-testid="full-explanation-banner" />
        <GeneratedExplanationCard
          unit={unit}
          isGeneratingUnit={false}
          onSave={vi.fn()}
        />
        <div data-testid="ask-my-textbook" />
      </div>,
    );

    expect(
      Array.from(container.querySelectorAll('[data-testid]')).map((element) => (element as HTMLElement).dataset.testid),
    ).toEqual([
      'full-explanation-banner',
      'generated-explanation-card',
      'ask-my-textbook',
    ]);
  });

  it('scrolls into view once for each generated unit', () => {
    const { rerender } = render(
      <GeneratedExplanationCard
        unit={unit}
        isGeneratingUnit={false}
        onSave={vi.fn()}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
    });

    rerender(
      <GeneratedExplanationCard
        unit={{ ...unit, title: 'Updated title' }}
        isGeneratingUnit={false}
        onSave={vi.fn()}
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(
      <GeneratedExplanationCard
        unit={{ ...unit, id: 'unit-explanation-2' }}
        isGeneratingUnit={false}
        onSave={vi.fn()}
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});

describe('SessionConfigErrorCard', () => {
  it('shows the session setup error alert instead of a loading skeleton', () => {
    render(<SessionConfigErrorCard />);

    expect(screen.getByRole('alert').textContent).toContain(SESSION_CONFIG_ERROR_MESSAGE);
    expect(screen.queryByTestId('session-loading-skeleton')).toBeNull();
  });

  it('does not show the session setup alert when the session setup succeeds', () => {
    render(<div data-testid="session-ready" />);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
