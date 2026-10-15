import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EscalationPrompt } from './components/features/hints/components/EscalationPrompt';
import { HintDisplay } from './components/features/hints/components/HintDisplay';

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('./lib/api/auth-client', () => ({
  getPreSurveyStatus: vi.fn(async () => ({ completed: false })),
}));

vi.mock('./lib/api/storage-client', () => ({
  getSurveyInvitations: vi.fn(async () => []),
}));

import { PreSurveyRequiredPage } from './pages/PreSurveyRequiredPage';

const experimentTerms = /\b(control|adaptive|condition|group|aggressive|conservative|explanation-first|fast escalator|slow escalator|explanation first|bandit)\b/i;

afterEach(() => {
  vi.clearAllMocks();
});

describe.each(['control', 'adaptive'] as const)('student UI for %s assignment', (condition) => {
  it('does not render condition or strategy vocabulary in hint and escalation surfaces', () => {
    const { container } = render(
      <div data-condition={condition}>
        <HintDisplay
          index={0}
          hint="Check the columns selected by your query."
          isLatest
        />
        <EscalationPrompt
          currentRung={1}
          hintCount={3}
          onEscalate={vi.fn()}
          onContinue={vi.fn()}
        />
      </div>,
    );

    expect(container.textContent).not.toMatch(experimentTerms);
  });

  it('does not render condition or strategy vocabulary on the student lock screen', () => {
    const { container } = render(<PreSurveyRequiredPage />);

    expect(container.textContent).not.toMatch(experimentTerms);
  });
});