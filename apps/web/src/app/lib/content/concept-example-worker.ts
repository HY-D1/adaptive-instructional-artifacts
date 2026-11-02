import { SQLExecutor, type QueryResult } from '../sql-executor';
import type { ExampleWorkerReply } from './concept-example-runner';

const executor = new SQLExecutor();
const reply = (message: ExampleWorkerReply) => self.postMessage(message);
function limited(result: QueryResult): QueryResult {
  return { ...result, values: result.values?.slice(0, 100), allResults: result.allResults?.map(set => ({ ...set, values: set.values.slice(0, 100) })) };
}
self.onmessage = async (event: MessageEvent<{ type: string; schema: string; sql: string; inspectSql?: string }>) => {
  try {
    if (event.data.type === 'initialize') {
      await executor.initialize(event.data.schema);
      reply({ type: 'ready' });
    } else if (event.data.type === 'run') {
      const result = limited(await executor.executeQuery(event.data.sql));
      const inspection = result.success && event.data.inspectSql ? limited(await executor.executeQuery(event.data.inspectSql)) : undefined;
      executor.close();
      reply({ type: 'result', output: { result, inspection } });
    }
  } catch (error) {
    executor.close();
    reply({ type: 'error', error: error instanceof Error ? error.message : 'SQL example failed.' });
  }
};
