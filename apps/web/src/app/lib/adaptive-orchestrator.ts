import { 
  InteractionEvent, 
  AdaptiveDecision, 
  InstructionalUnit,
  LearnerProfile 
} from '../types';
import {
  getErrorSubtype,
  getConceptById,
  getHintsForError,
  canonicalizeSqlEngageSubtype,
  getDeterministicSqlEngageAnchor,
  getProgressiveSqlEngageHintText,
  getSqlEngagePolicyVersion
} from '../data/sql-engage';

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
    'adaptive': { escalate: 3, aggregate: 6 },
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

    if (selection.decision === 'show_explanation') {
      const explanation = this.generateExplanation(context.recentErrors, profile);
      return {
        timestamp: now,
        learnerId: profile.id,
        context,
        decision: selection.decision,
        reasoning: selection.reasoning,
        instructionalUnitId: explanation.id
      };
    }

    return {
      timestamp: now,
      learnerId: profile.id,
      context,
      decision: selection.decision,
      reasoning: selection.reasoning
    };
  }

  replayDecisionTrace(
    profile: LearnerProfile,
    traceSlice: InteractionEvent[],
    strategyOverride: LearnerProfile['currentStrategy']
  ): ReplayDecisionPoint[] {
    const sortedTrace = [...traceSlice].sort((a, b) => a.timestamp - b.timestamp);
    const thresholds = this.getThresholds(strategyOverride);
    const policyVersion = getSqlEngagePolicyVersion();
    const runningInteractions: InteractionEvent[] = [];

    return sortedTrace
      .filter(event => Boolean(event.problemId))
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
    const executionAttempts = problemInteractions.filter(
      i => i.eventType === 'execution' || i.eventType === 'error'
    );
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
      retryCount: Math.max(0, executionAttempts.length - 1),
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
    // Find most common error
    const errorCounts = errorSubtypeIds.reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonError = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    const errorSubtype = getErrorSubtype(''); // Get from SQL-Engage
    const hints = getHintsForError(mostCommonError || '', 3);
    
    // Generate comprehensive explanation
    const content = this.generateExplanationContent(mostCommonError, hints);

    return {
      id: `explanation-${Date.now()}`,
      type: 'explanation',
      conceptId: hints[0]?.conceptId || 'unknown',
      title: `Understanding: ${errorSubtype?.description || 'SQL Concept'}`,
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
  private generateExplanationContent(errorSubtypeId: string, hints: any[]): string {
    // Retrieval-first: Get validated templates
    const conceptId = hints[0]?.conceptId;
    const concept = getConceptById(conceptId);

    // Template with constrained generation
    return `
# ${concept?.name || 'SQL Concept'}

${concept?.description || ''}

## Common Issues

You've encountered this error multiple times. Here's a deeper explanation:

${hints.map(h => `- ${h.content}`).join('\n')}

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
    _profile: LearnerProfile,
    seed: string,
    options?: {
      knownSubtypeOverride?: string;
      isSubtypeOverrideActive?: boolean;
    }
  ): {
    hint: string;
    shouldEscalate: boolean;
    sqlEngageSubtypeUsed: string;
    sqlEngageRowId: string;
    policyVersion: string;
  } {
    const nextLevel = currentLevel + 1;
    const policyVersion = getSqlEngagePolicyVersion();
    const effectiveSubtype = options?.isSubtypeOverrideActive
      ? options.knownSubtypeOverride || errorSubtypeId
      : errorSubtypeId;
    const canonicalSubtype = canonicalizeSqlEngageSubtype(effectiveSubtype);
    const row = getDeterministicSqlEngageAnchor(canonicalSubtype, seed);
    if (row) {
      const subtypeUsed = canonicalizeSqlEngageSubtype(row.error_subtype);
      return {
        hint: getProgressiveSqlEngageHintText(subtypeUsed, nextLevel, row),
        shouldEscalate: nextLevel >= 3,
        sqlEngageSubtypeUsed: subtypeUsed,
        sqlEngageRowId: row.rowId,
        policyVersion
      };
    }
    const fallbackRow = getDeterministicSqlEngageAnchor('incomplete query', seed);
    return {
      hint: getProgressiveSqlEngageHintText('incomplete query', nextLevel, fallbackRow),
      shouldEscalate: nextLevel >= 3,
      sqlEngageSubtypeUsed: 'incomplete query',
      sqlEngageRowId: fallbackRow?.rowId || 'sql-engage:incomplete-query-fallback',
      policyVersion
    };
  }
}

export const orchestrator = new AdaptiveOrchestrator();
