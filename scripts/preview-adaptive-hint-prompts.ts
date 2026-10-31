import { buildAdaptivePrompt } from '../apps/web/src/app/lib/ml/hint-service/llm-generation';
import type { AdaptiveHintContext } from '../apps/web/src/app/lib/ml/hint-service/types';

const cases = [
  ['wrong column name', 'SELECT missing_name FROM users;', 'column "missing_name" does not exist'],
  ['syntax error', 'SELEC name FROM users;', 'syntax error near "SELEC"'],
  ['missing JOIN', 'SELECT users.name, orders.total FROM users;', 'result is missing the relationship between users and orders'],
  ['valid but wrong result', 'SELECT name FROM users;', 'The query executed, but its result did not match the expected result.'],
  ['wrong aggregation', 'SELECT AVG(amount) FROM orders;', 'The aggregate does not match the requested grouping'],
  ['missing WHERE', 'SELECT * FROM orders;', 'The result includes rows outside the requested filter'],
] as const;

const problem = {
  id: 'preview-problem',
  title: 'Order analysis',
  description: 'Summarize orders for the requested customers.',
  difficulty: 'beginner' as const,
  concepts: ['filtering', 'aggregation'],
  schema: 'CREATE TABLE users (id INTEGER, name TEXT); CREATE TABLE orders (id INTEGER, user_id INTEGER, amount NUMERIC);',
  expectedQuery: 'SELECT ...',
  topic: 'aggregation' as const,
  topicDifficultyLevel: 2,
};

for (const [label, studentSql, errorMessage] of cases) {
  const context: AdaptiveHintContext = {
    rung: 2,
    errorSubtype: label,
    problem,
    previousHints: [],
    textbookUnits: [],
    pdfPassages: [],
    sqlEngageRecords: [],
    learningSignals: {
      latestIssue: errorMessage,
      failedRunCount: 1,
      retryCount: 0,
      hintCount: 0,
      lastInteractionTypes: ['error'],
    },
    studentSql,
    errorMessage,
    tableSchema: 'users: id, name\norders: id, user_id, amount',
  };
  console.log(`\n=== ${label} ===\n${buildAdaptivePrompt(context)}\n`);
}
