import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InteractiveExample } from './InteractiveExample';
import { startExampleRun } from '../../../lib/content/concept-example-runner';
vi.mock('../../../lib/content/concept-example-runner', () => ({ startExampleRun: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const example = { title: 'Names', sql: 'SELECT name FROM users;', schema: "CREATE TABLE users(name); INSERT INTO users VALUES('Ada');", explanation: 'Read names.' };
it('runs edited SQL with the declared seed and resets without a second execution', async () => {
  vi.mocked(startExampleRun).mockReturnValue({ promise: Promise.resolve({ result: { success: true, columns: ['name'], values: [['Ada']] } }), cancel: vi.fn() });
  render(<InteractiveExample example={example} />);
  fireEvent.change(screen.getByLabelText('Editable SQL — Names'), { target: { value: 'SELECT * FROM users;' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run example' }));
  await screen.findByText('Ada');
  expect(startExampleRun).toHaveBeenCalledWith({ sql: 'SELECT * FROM users;', schema: example.schema, inspectSql: undefined });
  fireEvent.click(screen.getByRole('button', { name: 'Reset example' }));
  expect((screen.getByLabelText('Editable SQL — Names') as HTMLTextAreaElement).value).toBe(example.sql);
  expect(screen.queryByRole('table')).toBeNull(); expect(startExampleRun).toHaveBeenCalledTimes(1);
});
it('cancels an active run on navigation and suppresses its late result', async () => {
  let resolve: (value: any) => void = () => {};
  const cancel = vi.fn();
  vi.mocked(startExampleRun).mockReturnValue({ promise: new Promise(r => { resolve = r; }), cancel });
  const view = render(<InteractiveExample example={example} />);
  fireEvent.click(screen.getByRole('button', { name: 'Run example' }));
  view.rerender(<InteractiveExample example={{ ...example, title: 'New example' }} />);
  expect(cancel).toHaveBeenCalledOnce();
  resolve({ result: { success: true, columns: ['old'], values: [['stale']] } });
  await waitFor(() => expect(screen.queryByText('stale')).toBeNull());
});
it('offers no run action for explanatory SQL without SQLite setup', () => {
  render(<InteractiveExample example={{ title: 'MySQL procedure', sql: 'CALL report();', explanation: 'MySQL-only syntax.' }} />);
  expect(screen.queryByRole('button', { name: 'Run example' })).toBeNull();
});
