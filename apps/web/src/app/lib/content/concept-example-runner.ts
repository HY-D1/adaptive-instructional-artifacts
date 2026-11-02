import type { QueryResult } from '../sql-executor';

export interface ExampleInput { schema: string; sql: string; inspectSql?: string }
export interface ExampleOutput { result: QueryResult; inspection?: QueryResult }
export type ExampleWorkerReply = { type: 'ready' } | { type: 'result'; output: ExampleOutput } | { type: 'error'; error: string };

/** One worker and one fresh database per run. No learner storage or grading. */
export function startExampleRun(
  input: ExampleInput,
  factory: () => Worker = () => new Worker(new URL('./concept-example-worker.ts', import.meta.url), { type: 'module' }),
): { promise: Promise<ExampleOutput>; cancel: () => void } {
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let finished = false;
  let rejectRun: (reason: Error) => void;
  const promise = new Promise<ExampleOutput>((resolve, reject) => {
    rejectRun = reject;
    const finish = (error?: Error, output?: ExampleOutput) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker?.terminate();
      if (error) reject(error); else resolve(output!);
    };
    try {
      worker = factory();
      timer = setTimeout(() => finish(new Error('SQL engine initialization timed out. Try again.')), 10_000);
      worker.onerror = () => finish(new Error('The SQL example worker could not run. Try again.'));
      worker.onmessage = (event: MessageEvent<ExampleWorkerReply>) => {
        if (finished) return;
        const reply = event.data;
        if (reply.type === 'ready') {
          clearTimeout(timer);
          timer = setTimeout(() => finish(new Error('Query exceeded the 3-second limit. Simplify it and try again.')), 3_000);
          worker!.postMessage({ type: 'run', sql: input.sql, inspectSql: input.inspectSql });
        } else if (reply.type === 'error') finish(new Error(reply.error));
        else finish(undefined, reply.output);
      };
      worker.postMessage({ type: 'initialize', schema: input.schema });
    } catch (error) { finish(error instanceof Error ? error : new Error('Unable to start SQL example.')); }
  });
  return { promise, cancel() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    worker?.terminate();
    rejectRun(new Error('Example run cancelled.'));
  } };
}
