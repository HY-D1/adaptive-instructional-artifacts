import { 
  InteractionEvent, 
  AdaptiveDecision, 
  InstructionalUnit,
  LearnerProfile,
  NextHintSelection
} from '../types';
import {
  getConceptById,
  getConceptIdsForSqlEngageSubtype,
  canonicalizeSqlEngageSubtype,
  getDeterministicSqlEngageAnchor,
  getProgressiveSqlEngageHintText,
  getSqlEngagePolicyVersion
} from '../data/sql-engage';

const POLICY_REPLAY_EVENT_TYPES: InteractionEvent['eventType'][] = [
  'execution',
  'error',
  'hint_view',
  'explanation_view'
];
const POLICY_SEMANTICS_VERSION = 'orchestrator-auto-escalation-variant-v2';

/**
 * Type for decision rules that can be fired by the orchestrator
 */
export type DecisionRuleFired =
  | 'no-errors-show-hint'
  | 'auto-escalation-after-hints'
  | 'escalation-threshold-met'
  | 'aggregation-threshold-met'
  | 'progressive-hint';

/**
 * Thresholds for escalation and aggregation decisions
 */
export type StrategyThresholds = {
  escalate: number;
  aggregate: number;
};

/**
 * Mode for auto-escalation behavior
 */
export type AutoEscalationMode = 'always-after-hint-threshold' | 'threshold-gated';

/**
 * A single decision point in a policy replay trace
 */
export type ReplayDecisionPoint = {
  index: number;
  eventId: string;
  learnerId: string;
  timestamp: number;
  problemId: string;
  eventType: InteractionEvent['eventType'];
  errorSubtypeId?: string;
  strategy: LearnerProfile['currentStrategy'];
  thresholds: StrategyThresholds;
  context: AdaptiveDecision['context'];
  decision: AdaptiveDecision['decision'];
  ruleFired: DecisionRuleFired;
  policyVersion: string;
  policySemanticsVersion: string;
  autoEscalationMode: AutoEscalationMode;
  reasoning: string;
};

/**
 * Selection result for the next hint
 * 
 * This type alias exists to provide a domain-specific name for hint selections
 * within the orchestrator context. While semantically equivalent to NextHintSelection,
 * using HintSelection makes the orchestrator's intent clearer when the type is
 * referenced in other modules.
 */
export type HintSelection = NextHintSelection;

/**
 * Adaptive Content Orchestrator
 * Determines when to:
 * - Stay at hint level
 * - Escalate to deeper explanations
 * - Aggregate content into textbook
 */
export class AdaptiveOrchestrator {
  private errorThresholds: Record<LearnerProfile['currentStrategy'], StrategyThresholds> = {
    'hint-only': { escalate: Infinity, aggregate: Infinity },
    'adaptive-low': { escalate: 5, aggregate: 10 },
    'adaptive-medium': { escalate: 3, aggregate: 6 },
    'adaptive-high': { escalate: 2, aggregate: 4 }
  };

  /**
   * Get escalation/aggregation thresholds for a given strategy
   * @param strategy - The learner's current strategy
   * @returns Strategy thresholds object
   */
  getThresholds(strategy: LearnerProfile['currentStrategy']): StrategyThresholds {
    return { ...this.errorThresholds[strategy] };
  }

  /**
   * Get the current policy semantics version
   * @returns Policy version string
   */
  getPolicySemanticsVersion(): string {
    return POLICY_SEMANTICS_VERSION;
  }

  /**
   * Main decision function: analyzes interaction context and decides next action
   */
  makeDecision(
    profile: LearnerProfile,
    recentInteractions: InteractionEvent[],
    currentProblemId: string,
    options?: {
      autoEscalationMode?: AutoEscalationMode;
    }
  ): AdaptiveDecision {
    const now = Date.now();
    const context = this.analyzeContext(recentInteractions, currentProblemId, now);
    const thresholds = this.getThresholds(profile.currentStrategy);
    const autoEscalation = this.getAutoEscalationState(recentInteractions, currentProblemId);
    const autoEscalationMode = options?.autoEscalationMode || 'always-after-hint-threshold';
    const selection = this.selectDecision(context, thresholds, autoEscalation, autoEscalationMode);

    return {
      timestamp: now,
      learnerId: profile.id,
      context,
      decision: selection.decision,
      ruleFired: selection.ruleFired,
      reasoning: selection.reasoning
    };
  }

  /**
   * Replay a decision trace with a specific strategy override
   * @param profile - The learner profile
   * @param traceSlice - Slice of interaction events to replay
   * @param strategyOverride - Strategy to use for all decisions
   * @param options - Optional settings including auto-escalation mode
   * @returns Array of replay decision points
   */
  replayDecisionTrace(
    profile: LearnerProfile,
    traceSlice: InteractionEvent[],
    strategyOverride: LearnerProfile['currentStrategy'],
    options?: {
      autoEscalationMode?: AutoEscalationMode;
    }
  ): ReplayDecisionPoint[] {
    const sortedTrace = this.getPolicyReplayTrace(traceSlice);
    const thresholds = this.getThresholds(strategyOverride);
    const policyVersion = getSqlEngagePolicyVersion();
    const policySemanticsVersion = this.getPolicySemanticsVersion();
    const autoEscalationMode = options?.autoEscalationMode || 'always-after-hint-threshold';
    const runningInteractions: InteractionEvent[] = [];

    return sortedTrace
      .map((event, index) => {
        runningInteractions.push(event);
        const context = this.analyzeContext(runningInteractions, event.problemId, event.timestamp);
        const autoEscalation = this.getAutoEscalationState(runningInteractions, event.problemId);
        const selection = this.selectDecision(
          context,
          thresholds,
          autoEscalation,
          autoEscalationMode
        );

        return {
          index: index + 1,
          eventId: event.id,
          learnerId: profile.id,
          timestamp: event.timestamp,
          problemId: event.problemId,
          eventType: event.eventType,
          errorSubtypeId: event.errorSubtypeId,
          strategy: strategyOverride,
          thresholds: { ...thresholds },
          context,
          decision: selection.decision,
          ruleFired: selection.ruleFired,
          policyVersion,
          policySemanticsVersion,
          autoEscalationMode,
          reasoning: selection.reasoning
        };
      });
  }

  /**
   * Filter and sort events for policy replay
   * @param traceSlice - Raw interaction trace
   * @returns Filtered and sorted events
   */
  getPolicyReplayTrace(traceSlice: InteractionEvent[]): InteractionEvent[] {
    return [...traceSlice]
      .filter((event) => Boolean(event.problemId) && POLICY_REPLAY_EVENT_TYPES.includes(event.eventType))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private selectDecision(
    context: AdaptiveDecision['context'],
    thresholds: StrategyThresholds,
    autoEscalation: ReturnType<AdaptiveOrchestrator['getAutoEscalationState']>,
    autoEscalationMode: AutoEscalationMode
  ): {
    decision: AdaptiveDecision['decision'];
    ruleFired: DecisionRuleFired;
    reasoning: string;
  } {
    if (context.errorCount === 0) {
      return {
        decision: 'show_hint',
        ruleFired: 'no-errors-show-hint',
        reasoning: 'No errors detected, showing basic hint'
      };
    }

    const thresholdMet = context.errorCount >= thresholds.escalate && context.retryCount >= 2;
    const shouldAutoEscalate =
      Number.isFinite(thresholds.escalate) &&
      autoEscalation.shouldEscalate &&
      (autoEscalationMode === 'always-after-hint-threshold' || thresholdMet);

    if (shouldAutoEscalate) {
      return {
        decision: 'show_explanation',
        ruleFired: 'auto-escalation-after-hints',
        reasoning:
          autoEscalationMode === 'threshold-gated'
            ? `Threshold-gated auto-escalation triggered after ${autoEscalation.hintCount} hints and threshold match`
            : `Auto-escalation triggered after ${autoEscalation.hintCount} hints with no explanation yet`
      };
    }

    if (thresholdMet) {
      return {
        decision: 'show_explanation',
        ruleFired: 'escalation-threshold-met',
        reasoning: `Error count (${context.errorCount}) and retries (${context.retryCount}) exceed escalation threshold (${thresholds.escalate})`
      };
    }

    if (context.errorCount >= thresholds.aggregate || context.timeSpent > 600000) {
      return {
        decision: 'add_to_textbook',
        ruleFired: 'aggregation-threshold-met',
        reasoning: `High error count (${context.errorCount}) or extended time (${Math.round(context.timeSpent / 1000)}s) suggests need for comprehensive notes`
      };
    }

    return {
      decision: 'show_hint',
      ruleFired: 'progressive-hint',
      reasoning: `Below escalation threshold (${thresholds.escalate}), showing level ${context.currentHintLevel + 1} hint`
    };
  }

  /**
   * Analyze recent interactions to build context
   */
  private analyzeContext(
    interactions: InteractionEvent[],
    problemId: string,
    nowTimestamp: number = Date.now()
  ): AdaptiveDecision['context'] {
    const problemInteractions = interactions.filter(i => i.problemId === problemId);
    
    const errorInteractions = problemInteractions.filter(i => i.eventType === 'error');
    const hintViews = problemInteractions.filter(i => i.eventType === 'hint_view');
    
    const recentErrors = errorInteractions
      .slice(-5)
      .map(i => i.errorSubtypeId)
      .filter(Boolean) as string[];

    const timeSpent = problemInteractions.length > 0
      ? nowTimestamp - problemInteractions[0].timestamp
      : 0;

    return {
      errorCount: errorInteractions.length,
      // Retry count is failed re-attempts after the first failure for this problem.
      retryCount: Math.max(0, errorInteractions.length - 1),
      timeSpent,
      currentHintLevel: Math.min(hintViews.length, 3),
      recentErrors
    };
  }

  /**
   * Determine if auto-escalation should occur based on hint count
   * @param recentInteractions - Recent learner interactions
   * @param currentProblemId - Current problem being worked on
   * @param hintThreshold - Number of hints before escalation (default: 3)
   * @returns Auto-escalation state with shouldEscalate flag
   */
  getAutoEscalationState(
    recentInteractions: InteractionEvent[],
    currentProblemId: string,
    hintThreshold = 3
  ): {
    shouldEscalate: boolean;
    triggerErrorId?: string;
    hintCount: number;
  } {
    const problemInteractions = recentInteractions
      .filter((interaction) => interaction.problemId === currentProblemId)
      .sort((a, b) => a.timestamp - b.timestamp);
    const hintViews = problemInteractions.filter((interaction) => interaction.eventType === 'hint_view');

    if (hintViews.length < hintThreshold) {
      return { shouldEscalate: false, hintCount: hintViews.length };
    }

    const thresholdHint = hintViews[hintThreshold - 1];
    const explanationAfterThreshold = problemInteractions.some(
      (interaction) =>
        interaction.eventType === 'explanation_view' &&
        interaction.timestamp >= thresholdHint.timestamp
    );
    const latestErrorAfterThreshold = [...problemInteractions]
      .reverse()
      .find(
        (interaction) =>
          interaction.eventType === 'error' &&
          interaction.timestamp >= thresholdHint.timestamp
      );
    const triggerInteractionId = latestErrorAfterThreshold?.id || thresholdHint.id;

    return {
      shouldEscalate: !explanationAfterThreshold,
      triggerErrorId: triggerInteractionId,
      hintCount: hintViews.length
    };
  }

  /**
   * Generate a deeper explanation based on error patterns
   */
  private generateExplanation(
    errorSubtypeIds: string[],
    profile: LearnerProfile
  ): InstructionalUnit {
    const errorCounts = errorSubtypeIds.reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonSubtype = canonicalizeSqlEngageSubtype(
      Object.entries(errorCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'incomplete query'
    );
    const anchor = getDeterministicSqlEngageAnchor(
      mostCommonSubtype,
      `${profile.id}|${mostCommonSubtype}`
    );
    const conceptId = getConceptIdsForSqlEngageSubtype(mostCommonSubtype)[0] || 'select-basic';
    const concept = getConceptById(conceptId);
    const content = this.generateExplanationContent(mostCommonSubtype, conceptId, anchor);

    return {
      id: `explanation-${Date.now()}`,
      type: 'explanation',
      conceptId,
      title: `Understanding: ${concept?.name || mostCommonSubtype}`,
      content,
      prerequisites: [],
      addedTimestamp: Date.now(),
      sourceInteractionIds: errorSubtypeIds
    };
  }

  /**
   * Use LLM in controlled manner to generate explanation
   * (Template-based with constrained scope)
   */
  private generateExplanationContent(
    errorSubtypeId: string,
    conceptId: string,
    anchor?: { feedback_target: string; intended_learning_outcome: string }
  ): string {
    const concept = getConceptById(conceptId);
    const level1 = getProgressiveSqlEngageHintText(errorSubtypeId, 1, anchor);
    const level2 = getProgressiveSqlEngageHintText(errorSubtypeId, 2, anchor);
    const level3 = getProgressiveSqlEngageHintText(errorSubtypeId, 3, anchor);

    return `
# ${concept?.name || 'SQL Concept'}

${concept?.description || ''}

## Common Issues

You've encountered this error multiple times. Here's a deeper explanation:

- ${level1}
- ${level2}
- ${level3}

## Examples

${concept?.examples.map(ex => `\`\`\`sql\n${ex}\n\`\`\``).join('\n\n') || ''}

## Key Points to Remember

1. Start with the basic structure
2. Check syntax carefully
3. Test with simple examples first

---
*This explanation was added to your textbook based on your interaction patterns.*
    `.trim();
  }

  /**
   * Aggregate multiple instructional units into a comprehensive textbook entry
   */
  /**
   * Aggregate multiple instructional units into a comprehensive textbook entry
   * @param units - Units to aggregate
   * @param profile - Learner profile for personalization
   * @returns Aggregated textbook unit
   */
  aggregateToTextbook(
    units: InstructionalUnit[],
    profile: LearnerProfile
  ): InstructionalUnit {
    const conceptIds = [...new Set(units.map(u => u.conceptId))];
    const concepts = conceptIds.map(id => getConceptById(id)).filter(Boolean);

    return {
      id: `textbook-${Date.now()}`,
      type: 'summary',
      conceptId: conceptIds[0] || 'mixed',
      title: `Your Learning Summary: ${concepts.map(c => c?.name).join(', ')}`,
      content: this.generateSummaryContent(concepts, units),
      prerequisites: [],
      addedTimestamp: Date.now(),
      sourceInteractionIds: units.flatMap(u => u.sourceInteractionIds)
    };
  }

  private generateSummaryContent(concepts: any[], units: InstructionalUnit[]): string {
    return `
# Learning Summary

Based on your practice, here's a personalized summary of what you've learned:

${concepts.map(c => `
## ${c?.name}

${c?.description}

### What You Practiced

${units.filter(u => u.conceptId === c?.id).map(u => `- ${u.title}`).join('\n')}

### Key Takeaways

${c?.examples.map((ex, i) => `${i + 1}. Review this pattern: \`${ex}\``).join('\n')}
`).join('\n')}

---
*This summary was automatically generated from your interaction history.*
    `.trim();
  }

  /**
   * Get next hint level based on interaction history
   */
  /**
   * Get the next hint based on error subtype and current level
   * @param errorSubtypeId - The error subtype identifier
   * @param currentLevel - Current hint level (0-3)
   * @param profile - Learner profile
   * @param problemId - Current problem ID
   * @param options - Optional overrides and settings
   * @returns Hint selection with text and metadata
   */
  getNextHint(
    errorSubtypeId: string,
    currentLevel: number,
    profile: LearnerProfile,
    problemId: string,
    options?: {
      knownSubtypeOverride?: string;
      isSubtypeOverrideActive?: boolean;
      helpRequestIndex?: number;
    }
  ): HintSelection {
    const requestedLevel = Number.isFinite(options?.helpRequestIndex)
      ? Number(options?.helpRequestIndex)
      : currentLevel + 1;
    const nextLevel = Math.max(1, Math.min(3, requestedLevel)) as 1 | 2 | 3;
    const policyVersion = getSqlEngagePolicyVersion();
    const effectiveSubtype = options?.isSubtypeOverrideActive
      ? options.knownSubtypeOverride || errorSubtypeId
      : errorSubtypeId;
    const canonicalSubtype = canonicalizeSqlEngageSubtype(effectiveSubtype);
    const learnerKey = profile.id?.trim() || 'anonymous-learner';
    const problemKey = problemId.trim() || 'unknown-problem';
    const deterministicSeed = `${learnerKey}|${problemKey}|${canonicalSubtype}|L${nextLevel}`;
    const row = getDeterministicSqlEngageAnchor(canonicalSubtype, deterministicSeed);
    const subtypeUsed = canonicalizeSqlEngageSubtype(row.error_subtype || canonicalSubtype);
    const rowId = row.rowId?.trim() || 'sql-engage:fallback-synthetic';

    return {
      hintText: getProgressiveSqlEngageHintText(subtypeUsed, nextLevel, row),
      sqlEngageSubtype: subtypeUsed,
      sqlEngageRowId: rowId,
      hintLevel: nextLevel,
      policyVersion,
      // FIX: Use requestedLevel (unclamped) instead of nextLevel (clamped to 3)
      // to properly detect when escalation should occur
      shouldEscalate: requestedLevel > 3
    };
  }
}

export const orchestrator = new AdaptiveOrchestrator();
