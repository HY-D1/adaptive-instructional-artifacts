import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstructionalUnit } from '../../types';
import { markUnitsSeen } from '../../lib/storage/textbook-updates';
import { TextbookUpdatesButton } from './TextbookUpdatesButton';

const mocks = vi.hoisted(() => ({ getTextbook: vi.fn() }));

vi.mock('../../lib/storage', () => ({
  storage: { getTextbook: mocks.getTextbook },
  subscribeToSync: () => () => undefined,
}));

function note(id: string, added: number): InstructionalUnit {
  return {
    id,
    type: 'explanation',
    conceptId: 'select-basic',
    title: `Note ${id}`,
    content: 'x',
    prerequisites: [],
    addedTimestamp: added,
    sourceInteractionIds: [],
  };
}

function renderButton() {
  return render(
    <MemoryRouter>
      <TextbookUpdatesButton learnerId="learner-1" />
    </MemoryRouter>,
  );
}

describe('TextbookUpdatesButton', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getTextbook.mockReset();
  });

  it('starts with no badge and does not count notes saved before the first look', () => {
    mocks.getTextbook.mockReturnValue([note('old', 1)]);
    renderButton();
    expect(screen.queryByTestId('textbook-updates-badge')).toBeNull();
  });

  it('shows a counter for notes saved after the last look', () => {
    markUnitsSeen('learner-1', [note('old', 50)]);
    mocks.getTextbook.mockReturnValue([note('a', 200), note('b', 300), note('old', 50)]);
    renderButton();
    expect(screen.getByTestId('textbook-updates-badge').textContent).toBe('2');
    expect(screen.getByRole('button', { name: /2 new updates/i })).toBeTruthy();
  });

  it('opens a quick view without clearing the counter, then lowers it when a note is opened', async () => {
    const user = userEvent.setup();
    markUnitsSeen('learner-1', []);
    mocks.getTextbook.mockReturnValue([note('a', 200), note('b', 300)]);
    renderButton();
    expect(screen.getByTestId('textbook-updates-badge').textContent).toBe('2');

    await user.click(screen.getByTestId('textbook-updates-button'));
    expect(screen.getByTestId('textbook-updates-panel').textContent).toContain('Note a');
    expect(screen.getByTestId('textbook-updates-badge').textContent).toBe('2');

    await user.click(screen.getByText('Note a'));
    expect(screen.getByTestId('textbook-updates-badge').textContent).toBe('1');
  });

  it('does not clear the counter just because My Textbook is opened; each note has to be opened', async () => {
    const user = userEvent.setup();
    markUnitsSeen('learner-1', []);
    mocks.getTextbook.mockReturnValue([note('a', 200), note('b', 300)]);
    renderButton();
    await user.click(screen.getByTestId('textbook-updates-button'));
    await user.click(screen.getByTestId('textbook-updates-open'));
    expect(screen.getByTestId('textbook-updates-badge').textContent).toBe('2');
  });
});
