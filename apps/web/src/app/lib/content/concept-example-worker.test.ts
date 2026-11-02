import { afterEach, expect, it, vi } from 'vitest';
import type { ExampleWorkerReply } from './concept-example-runner';
afterEach(() => vi.unstubAllGlobals());
it('uses real SQLExecutor to seed isolated data, inspect mutation state, and cap output', async () => {
  const messages: ExampleWorkerReply[] = [];
  const scope = { onmessage: undefined as unknown as (event: { data: unknown }) => Promise<void>, postMessage: (message: ExampleWorkerReply) => messages.push(message) };
  vi.stubGlobal('self', scope);
  await import('./concept-example-worker');
  await scope.onmessage({ data: { type: 'initialize', schema: 'CREATE TABLE t(n INTEGER); INSERT INTO t VALUES(1),(2);' } });
  expect(messages).toEqual([{ type: 'ready' }]);
  await scope.onmessage({ data: { type: 'run', sql: 'UPDATE t SET n=n+10;', inspectSql: 'SELECT n FROM t ORDER BY n;' } });
  const result = messages[1];
  expect(result.type).toBe('result');
  if (result.type !== 'result') throw new Error('worker did not return a result');
  expect(result.output.result.success).toBe(true);
  expect(result.output.inspection?.values).toEqual([[11], [12]]);
  await scope.onmessage({ data: { type: 'initialize', schema: '' } });
  await scope.onmessage({ data: { type: 'run', sql: 'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<150) SELECT x FROM n;' } });
  const limited = messages[3];
  expect(limited.type).toBe('result');
  if (limited.type === 'result') {
    expect(limited.output.result.values).toHaveLength(100);
    expect(limited.output.result.allResults?.[0].values).toHaveLength(100);
  }
});
