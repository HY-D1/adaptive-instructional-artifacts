import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getProblemById } from '../../../data/problems';
import { SQLEditor } from './SQLEditor';

vi.mock('@monaco-editor/react', () => ({ default: () => null }));

afterEach(cleanup);

describe('SQL editor mutation grading', () => {
  it.each([
    ['SELECT 1;', false],
    ["INSERT INTO users VALUES (6, 'Frank', 'wrong@email.com', 40, 'Austin');", false],
    ["INSERT INTO users VALUES (6, 'Frank', 'frank@email.com', 40, 'Austin');", true],
  ])('reports the actual database-state grade for %s', async (code, expected) => {
    const onExecute = vi.fn();
    render(<SQLEditor problem={getProblemById('problem-18')!} code={code}
      onExecute={onExecute} onCodeChange={() => {}} />);
    const button = screen.getByTestId('run-query-btn-bottom') as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
    expect(onExecute.mock.calls[0][1].success).toBe(true);
    expect(onExecute.mock.calls[0][2]).toBe(expected);
    expect(screen.getByText(expected ? 'Database state matches' : 'Results differ')).toBeTruthy();
  });

  it('lets a student correct a wrong INSERT on the next attempt', async () => {
    const onExecute = vi.fn();
    const problem = getProblemById('problem-18')!;
    const props = { problem, onExecute, onCodeChange: () => {} };
    const { rerender } = render(<SQLEditor {...props}
      code="INSERT INTO users VALUES (6, 'Frank', 'wrong@email.com', 40, 'Austin');" />);
    const button = screen.getByTestId('run-query-btn-bottom') as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
    expect(onExecute.mock.calls[0][2]).toBe(false);
    rerender(<SQLEditor {...props}
      code="INSERT INTO users VALUES (6, 'Frank', 'frank@email.com', 40, 'Austin');" />);
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(2));
    expect(onExecute.mock.calls[1][1].success).toBe(true);
    expect(onExecute.mock.calls[1][2]).toBe(true);
  });
});
