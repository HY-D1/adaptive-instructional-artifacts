import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ConceptChecks } from './ConceptChecks';
afterEach(cleanup);
it('conceals feedback until submitted and supports a corrected answer', () => {
  render(<ConceptChecks checks={[{ question: 'How do you match NULL?', options: [{ text: '= NULL', feedback: 'NULL equality is unknown.' }, { text: 'IS NULL', feedback: 'IS NULL tests missing values.' }], correctIndex: 1 }]} />);
  expect(screen.queryByRole('status')).toBeNull();
  expect((screen.getByRole('button', { name: 'Check answer' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('= NULL')); fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  expect(screen.getByRole('status').textContent).toContain('Try again.');
  expect(screen.queryByText('IS NULL tests missing values.')).toBeNull();
  fireEvent.click(screen.getByLabelText('IS NULL')); expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
  expect(screen.getByRole('status').textContent).toContain('Correct.');
  expect(screen.getByRole('status').textContent).toContain('IS NULL tests missing values.');
});
