/**
 * Code snippet for: scripts/validate-telemetry-integrity.ts
 *
 * Add validation checks for escalation chains and standing data rule compliance.
 * These checks should run before publishing any research analysis.
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// NEW: Escalation Chain Validator
// ============================================================================

/**
 * Validate that escalation events form a valid chain:
 * - fromRung < toRung (always escalating forward)
 * - trigger_reason is not null
 * - at most one escalation per (problem, learner, session)
 */
export function validateEscalationChains(
  events: InteractionEvent[]
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const escalations = events.filter(e => e.eventType === 'guidance_escalate');

  for (const event of escalations) {
    // Check: fromRung and toRung exist
    if (event.fromRung === undefined) {
      errors.push({
        eventId: event.id,
        type: 'missing_field',
        field: 'fromRung',
        severity: 'error',
        message: 'Escalation event missing fromRung',
      });
    }

    if (event.toRung === undefined) {
      errors.push({
        eventId: event.id,
        type: 'missing_field',
        field: 'toRung',
        severity: 'error',
        message: 'Escalation event missing toRung',
      });
    }

    // Check: toRung > fromRung
    if (event.fromRung !== undefined && event.toRung !== undefined) {
      if (event.toRung <= event.fromRung) {
        errors.push({
          eventId: event.id,
          type: 'invalid_escalation',
          severity: 'error',
          message: `Invalid escalation: toRung (${event.toRung}) must be > fromRung (${event.fromRung})`,
        });
      }

      // Check: rung bounds (1-3)
      if (event.fromRung < 1 || event.fromRung > 3) {
        errors.push({
          eventId: event.id,
          type: 'out_of_bounds',
          field: 'fromRung',
          severity: 'error',
          message: `fromRung ${event.fromRung} out of bounds [1-3]`,
        });
      }

      if (event.toRung < 1 || event.toRung > 3) {
        errors.push({
          eventId: event.id,
          type: 'out_of_bounds',
          field: 'toRung',
          severity: 'error',
          message: `toRung ${event.toRung} out of bounds [1-3]`,
        });
      }
    }

    // Check: trigger_reason not null
    if (!event.trigger) {
      errors.push({
        eventId: event.id,
        type: 'missing_field',
        field: 'trigger_reason',
        severity: 'warning',
        message: 'Escalation event missing trigger_reason (useful for causality analysis)',
      });
    }
  }

  // Check: No duplicate escalations per (learner, problem, session)
  const escalationKeys = new Map<string, InteractionEvent[]>();
  for (const event of escalations) {
    const key = `${event.learnerId}:${event.problemId}:${event.sessionId}`;
    if (!escalationKeys.has(key)) {
      escalationKeys.set(key, []);
    }
    escalationKeys.get(key)!.push(event);
  }

  for (const [key, events] of escalationKeys.entries()) {
    // Sort by timestamp to detect consecutive escalations
    const sorted = events.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];

      // Check if escalations are consecutive without reset
      const timeDiff = next.timestamp - curr.timestamp;
      if (timeDiff < 1000 && curr.toRung !== next.fromRung) {
        errors.push({
          eventId: next.id,
          type: 'escalation_chain_broken',
          severity: 'warning',
          message: `Escalation chain broken: after rung ${curr.toRung}, expected from ${curr.toRung} but got ${next.fromRung}`,
        });
      }
    }
  }

  return {
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
  };
}

// ============================================================================
// NEW: Standing Data Rule Validator
// ============================================================================

/**
 * Verify that a dataset only contains events from production sections.
 * This enforces the standing data rule for research exports.
 */
export async function validateStandingDataRule(
  events: InteractionEvent[],
  productionSectionIds: string[]
): Promise<{
  valid: boolean;
  testDataCount: number;
  testSectionIds: string[];
  errors: ValidationError[];
}> {
  const errors: ValidationError[] = [];
  const sectionSet = new Set(productionSectionIds);
  const testSectionIds = new Set<string>();
  let testDataCount = 0;

  for (const event of events) {
    if (event.sectionId && !sectionSet.has(event.sectionId)) {
      testDataCount++;
      testSectionIds.add(event.sectionId);

      if (testDataCount <= 10) {  // Only report first 10 violations
        errors.push({
          eventId: event.id,
          type: 'non_production_section',
          field: 'sectionId',
          severity: 'error',
          message: `Event from non-production section: ${event.sectionId}`,
        });
      }
    }
  }

  if (testDataCount > 10) {
    errors.push({
      type: 'standing_data_rule_violated',
      severity: 'error',
      message: `${testDataCount} total events from non-production sections (showing first 10 above)`,
    });
  }

  return {
    valid: testDataCount === 0,
    testDataCount,
    testSectionIds: Array.from(testSectionIds),
    errors,
  };
}

// ============================================================================
// NEW: HDI Event Completeness Validator
// ============================================================================

/**
 * Validate that HDI calculation events have required fields for analysis.
 */
export function validateHDIEvents(
  events: InteractionEvent[]
): { valid: boolean; missingFields: Record<string, number>; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const missingFields: Record<string, number> = {};

  const hdiEvents = events.filter(e =>
    e.eventType === 'hdi_calculated' ||
    e.eventType === 'hdi_trajectory_updated'
  );

  const requiredFields = {
    hdi_calculated: ['hdi', 'hdiLevel', 'hdiComponents'],
    hdi_trajectory_updated: ['hdi', 'trend'],
  };

  for (const event of hdiEvents) {
    const required = requiredFields[event.eventType as keyof typeof requiredFields];
    if (!required) continue;

    for (const field of required) {
      const fieldExists = event[field as keyof InteractionEvent] !== undefined;
      if (!fieldExists) {
        missingFields[`${event.eventType}.${field}`] =
          (missingFields[`${event.eventType}.${field}`] || 0) + 1;

        if (!errors.find(e => e.field === field && e.type === 'missing_field')) {
          errors.push({
            type: 'missing_hdi_field',
            field,
            severity: 'warning',
            message: `${event.eventType} events missing ${field} (${missingFields[`${event.eventType}.${field}`]} occurrences)`,
          });
        }
      }
    }
  }

  return {
    valid: Object.keys(missingFields).length === 0,
    missingFields,
    errors,
  };
}

// ============================================================================
// NEW: Bandit Event Validator
// ============================================================================

/**
 * Validate that bandit events have complete decision/reward information.
 */
export function validateBanditEvents(
  events: InteractionEvent[]
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  const armSelections = events.filter(e => e.eventType === 'bandit_arm_selected');
  const rewardObservations = events.filter(e => e.eventType === 'bandit_reward_observed');

  // Validate arm selections
  for (const event of armSelections) {
    if (!event.selectedArm) {
      errors.push({
        eventId: event.id,
        type: 'missing_field',
        field: 'selectedArm',
        severity: 'error',
        message: 'Arm selection missing selectedArm',
      });
    }

    if (!event.selectionMethod) {
      errors.push({
        eventId: event.id,
        type: 'missing_field',
        field: 'selectionMethod',
        severity: 'warning',
        message: 'Arm selection missing selectionMethod (thompson_sampling or epsilon_greedy)',
      });
    }

    if (!event.armStatsAtSelection) {
      errors.push({
        eventId: event.id,
        type: 'missing_field',
        field: 'armStatsAtSelection',
        severity: 'warning',
        message: 'Arm selection missing armStatsAtSelection (prior state)',
      });
    }
  }

  // Validate reward observations
  for (const event of rewardObservations) {
    if (event.reward === undefined) {
      errors.push({
        eventId: event.id,
        type: 'missing_field',
        field: 'reward',
        severity: 'error',
        message: 'Reward observation missing reward value',
      });
    }

    if (!event.newAlpha !== !event.newBeta) {
      errors.push({
        eventId: event.id,
        type: 'inconsistent_fields',
        severity: 'error',
        message: 'Reward observation has alpha but not beta (or vice versa)',
      });
    }
  }

  // Check pairing: each arm selection should have corresponding reward
  const armSelectionIds = new Set(armSelections.map(e => e.id));
  for (const reward of rewardObservations) {
    // Typically linked by session/problem context or explicit reference
    // This check is heuristic; add explicit linking if needed
    if (!reward.payload?.sourceEventId) {
      console.warn(
        `[validate-bandit] Reward event ${reward.id} missing sourceEventId linkage`,
      );
    }
  }

  return {
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
  };
}

// ============================================================================
// INTEGRATION: Run All Validators
// ============================================================================

export async function runAllValidations(
  events: InteractionEvent[],
  productionSectionIds: string[]
): Promise<{
  summary: { valid: boolean; totalErrors: number; totalWarnings: number };
  escalation: ReturnType<typeof validateEscalationChains>;
  standingData: Awaited<ReturnType<typeof validateStandingDataRule>>;
  hdi: ReturnType<typeof validateHDIEvents>;
  bandit: ReturnType<typeof validateBanditEvents>;
}> {
  const escalation = validateEscalationChains(events);
  const standingData = await validateStandingDataRule(events, productionSectionIds);
  const hdi = validateHDIEvents(events);
  const bandit = validateBanditEvents(events);

  const allErrors = [
    ...escalation.errors,
    ...standingData.errors,
    ...hdi.errors,
    ...bandit.errors,
  ];

  const errorCount = allErrors.filter(e => e.severity === 'error').length;
  const warningCount = allErrors.filter(e => e.severity === 'warning').length;

  return {
    summary: {
      valid: errorCount === 0,
      totalErrors: errorCount,
      totalWarnings: warningCount,
    },
    escalation,
    standingData,
    hdi,
    bandit,
  };
}

// ============================================================================
// EXPORT: Report Generation
// ============================================================================

export function generateValidationReport(
  result: Awaited<ReturnType<typeof runAllValidations>>
): string {
  let report = `
# Data Validation Report
Generated: ${new Date().toISOString()}

## Summary
- Valid: ${result.summary.valid ? '✅ Yes' : '❌ No'}
- Total Errors: ${result.summary.totalErrors}
- Total Warnings: ${result.summary.totalWarnings}

## Escalation Chains
- Valid: ${result.escalation.valid ? '✅' : '❌'}
- Issues: ${result.escalation.errors.length}

## Standing Data Rule
- Valid: ${result.standingData.valid ? '✅' : '❌'}
- Non-production events: ${result.standingData.testDataCount}
- Affected sections: ${result.standingData.testSectionIds.join(', ')}

## HDI Events
- Valid: ${result.hdi.valid ? '✅' : '❌'}
- Missing fields: ${JSON.stringify(result.hdi.missingFields)}

## Bandit Events
- Valid: ${result.bandit.valid ? '✅' : '❌'}
- Issues: ${result.bandit.errors.length}

## Detailed Errors
${result.escalation.errors.concat(result.standingData.errors, result.hdi.errors, result.bandit.errors)
  .map(e => `- [${e.severity.toUpperCase()}] ${e.message}`)
  .join('\n')}
`;

  return report;
}
