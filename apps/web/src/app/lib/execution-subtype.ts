import { canonicalizeSqlEngageSubtype } from '../data/sql-engage';
import { classifySemanticSqlIssue } from './sql-semantic-classifier';
import type { InteractionEvent, SQLProblem } from '../types';

export type ExecutionSubtypeInput = {
  /** The query the learner ran. */
  query: string;
  /** The executor's verdict: whether the engine accepted the query, and its subtype if not. */
  result: { success: boolean; errorSubtypeId?: string };
  /** Whether the grader accepted the answer. */
  actuallyCorrect: boolean;
  problem: Pick<SQLProblem, 'expectedQuery' | 'orderSensitive' | 'gradingMode'>;
  instructorSubtypeOverride?: string;
};

/**
 * The subtype an execution event carries in both `errorSubtypeId` and
 * `sqlEngageSubtype`.
 *
 * An engine error arrives with its own subtype from `normalizeSqlErrorSubtype`.
 * A query that ran but answered wrongly is classified semantically against the
 * reference solution. A correct run, or a wrong run no rule explains, carries
 * none.
 *
 * Any event with `errorSubtypeId` increments the learner's server-side
 * `error_history`, so a wrong-result run with a subtype counts as an error for
 * that subtype. That is intended: wrong answers get targeted hints.
 */
export function resolveExecutionSubtype(input: ExecutionSubtypeInput): string | undefined {
  const { query, result, actuallyCorrect, problem, instructorSubtypeOverride } = input;

  if (!result.success) {
    return canonicalizeSqlEngageSubtype(instructorSubtypeOverride || result.errorSubtypeId);
  }

  if (actuallyCorrect) return undefined;

  const semanticSubtype = classifySemanticSqlIssue({
    query,
    expectedQuery: problem.expectedQuery,
    orderSensitive: problem.orderSensitive,
    gradingMode: problem.gradingMode
  });

  return semanticSubtype
    ? canonicalizeSqlEngageSubtype(instructorSubtypeOverride || semanticSubtype)
    : undefined;
}

type MistakeCandidate = Pick<
  InteractionEvent,
  'eventType' | 'successful' | 'timestamp' | 'errorSubtypeId' | 'sqlEngageSubtype'
>;

/**
 * A learner mistake a hint can target: an engine error, or a query that ran but
 * answered wrongly. Either counts only when it carries a subtype.
 */
export function isSubtypedMistake(interaction: MistakeCandidate): boolean {
  const isMistake =
    interaction.eventType === 'error' ||
    (interaction.eventType === 'execution' && interaction.successful === false);
  return isMistake && Boolean(interaction.sqlEngageSubtype || interaction.errorSubtypeId);
}

/**
 * The subtype of the most recent subtyped mistake, as stored on the event (not
 * canonicalised). Latest is by timestamp; on a tie the later array entry wins.
 */
export function latestMistakeSubtype(interactions: readonly MistakeCandidate[]): string | undefined {
  let latest: MistakeCandidate | undefined;
  for (const interaction of interactions) {
    if (!isSubtypedMistake(interaction)) continue;
    if (!latest || interaction.timestamp >= latest.timestamp) latest = interaction;
  }
  return latest ? latest.sqlEngageSubtype || latest.errorSubtypeId : undefined;
}
