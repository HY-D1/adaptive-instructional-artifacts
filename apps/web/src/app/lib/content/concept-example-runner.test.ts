import { afterEach, describe, expect, it, vi } from 'vitest';
import { startExampleRun, type ExampleWorkerReply } from './concept-example-runner';
class FakeWorker {
  onmessage: ((event: { data: ExampleWorkerReply }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  send(data: ExampleWorkerReply) { this.onmessage?.({ data }); }
}
afterEach(() => vi.useRealTimers());
function setup() { const worker = new FakeWorker(); const run = startExampleRun({ schema: 'CREATE TABLE t(n);', sql: 'SELECT * FROM t;', inspectSql: 'SELECT count(*) FROM t;' }, () => worker as unknown as Worker); return { worker, run }; }
describe('isolated concept example lifecycle', () => {
  it('waits for setup before query and terminates after results', async () => {
    const { worker, run } = setup();
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'initialize', schema: 'CREATE TABLE t(n);' });
    worker.send({ type: 'ready' });
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'run', sql: 'SELECT * FROM t;', inspectSql: 'SELECT count(*) FROM t;' });
    const output = { result: { success: false, error: 'bad SQL' } };
    worker.send({ type: 'result', output });
    await expect(run.promise).resolves.toEqual(output);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
  it('terminates initialization after ten seconds', async () => {
    vi.useFakeTimers(); const { worker, run } = setup();
    const rejection = expect(run.promise).rejects.toThrow('initialization timed out');
    await vi.advanceTimersByTimeAsync(10_000); await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('starts a separate three-second query deadline after initialization', async () => {
    vi.useFakeTimers(); const { worker, run } = setup();
    await vi.advanceTimersByTimeAsync(9_000); worker.send({ type: 'ready' });
    const rejection = expect(run.promise).rejects.toThrow('3-second limit');
    await vi.advanceTimersByTimeAsync(3_000); await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('cancels once and ignores late replies', async () => {
    const { worker, run } = setup(); const rejection = expect(run.promise).rejects.toThrow('cancelled');
    run.cancel(); run.cancel(); worker.send({ type: 'ready' }); await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce(); expect(worker.postMessage).toHaveBeenCalledTimes(1);
  });
  it('surfaces initialization and worker failures', async () => {
    const first = setup(); first.worker.send({ type: 'error', error: 'invalid seed' });
    await expect(first.run.promise).rejects.toThrow('invalid seed');
    const second = setup(); second.worker.onerror?.(); await expect(second.run.promise).rejects.toThrow('could not run');
  });
});
