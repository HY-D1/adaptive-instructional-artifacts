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

export type DecisionRuleFired =
  | 'no-errors-show-hint'
  | 'auto-escalation-after-hints'
  | 'escalation-threshold-met'
  | 'aggregation-threshold-met'
  | 'progressive-hint';

export type StrategyThresholds = {
  escalate: number;
  aggregate: number;
};

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
  reasoning: string;
};

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

  getThresholds(strategy: LearnerProfile['currentStrategy']): StrategyThresholds {
    return { ...this.errorThresholds[strategy] };
  }

  /**
   * Main decision function: analyzes interaction context and decides next action
   */
  makeDecision(
    profile: LearnerProfile,
    recentInteractions: InteractionEvent[],
    currentProblemId: string
  ): AdaptiveDecision {
    const now = Date.now();
    const context = this.analyzeContext(recentInteractions, currentProblemId, now);
    const thresholds = this.getThresholds(profile.currentStrategy);
    const autoEscalation = this.getAutoEscalationState(recentInteractions, currentProblemId);
    const selection = this.selectDecision(context, thresholds, autoEscalation);

    return {
      timestamp: now,
      learnerId: profile.id,
      context,
      decision: selection.decision,
      ruleFired: selection.ruleFired,
      reasoning: selection.reasoning
    };
  }

  replayDecisionTrace(
    profile: LearnerProfile,
    traceSlice: InteractionEvent[],
    strategyOverride: LearnerProfile['currentStrategy']
  ): ReplayDecisionPoint[] {
    const sortedTrace = this.getPolicyReplayTrace(traceSlice);
    const thresholds = this.getThresholds(strategyOverride);
    const policyVersion = getSqlEngagePolicyVersion();
    const runningInteractions: InteractionEvent[] = [];

    return sortedTrace
      .map((event, index) => {
        runningInteractions.push(event);
        const context = this.analyzeContext(runningInteractions, event.problemId, event.timestamp);
        const autoEscalation = this.getAutoEscalationState(runningInteractions, event.problemId);
        const selection = this.selectDecision(context, thresholds, autoEscalation);

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
          reasoning: selection.reasoning
        };
      });
  }

  getPolicyReplayTrace(traceSlice: InteractionEvent[]): InteractionEvent[] {
    return [...traceSlice]
      .filter((event) => Boolean(event.problemId) && POLICY_REPLAY_EVENT_TYPES.includes(event.eventType))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  private selectDecision(
    context: AdaptiveDecision['context'],
    thresholds: StrategyThresholds,
    autoEscalation: ReturnType<AdaptiveOrchestrator['getAutoEscalationState']>
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

    if (Number.isFinite(thresholds.escalate) && autoEscalation.shouldEscalate) {
      return {
        decision: 'show_explanation',
        ruleFired: 'auto-escalation-after-hints',
        reasoning: `Auto-escalation triggered after ${autoEscalation.hintCount} hints and another failed run`
      };
    }

    if (context.errorCount >= thresholds.escalate && context.retryCount >= 2) {
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
    const errorsAfterThreshold = problemInteractions.filter(
      (interaction) =>
        interaction.eventType === 'error' &&
        interaction.timestamp > thresholdHint.timestamp
    );
    const latestErrorAfterThreshold = errorsAfterThreshold[errorsAfterThreshold.length - 1];
    const latestInteraction = problemInteractions[problemInteractions.length - 1];

    if (!latestErrorAfterThreshold || !latestInteraction || latestInteraction.id !== latestErrorAfterThreshold.id) {
      return {
        shouldEscalate: false,
        triggerErrorId: latestErrorAfterThreshold?.id,
        hintCount: hintViews.length
      };
    }

    const explanationAfterError = problemInteractions.some(
      (interaction) =>
        interaction.eventType === 'explanation_view' &&
        interaction.timestamp >= latestErrorAfterThreshold.timestamp
    );

    return {
      shouldEscalate: !explanationAfterError,
      triggerErrorId: latestErrorAfterThreshold.id,
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
      shouldEscalate: nextLevel >= 3
    };
  }
}

export const orchestrator = new AdaptiveOrchestrator();
