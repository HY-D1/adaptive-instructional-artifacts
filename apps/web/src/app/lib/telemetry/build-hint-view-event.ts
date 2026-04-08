/**
 * Build Hint View Event
 *
 * Centralized helper for constructing `hint_view` events with full research contract compliance.
 * All hint emissions must route through this helper to ensure consistent, complete telemetry.
 *
 * Paper Data Contract Requirements:
 * - hintId: Stable identifier for the viewed hint item
 * - hintText: Full rendered hint text shown to learner
 * - hintLevel: 1, 2, or 3 indicating guidance-ladder rung
 * - templateId: Template identifier for pedagogical classification
 * - sqlEngageSubtype: Error subtype from SQL-Engage taxonomy
 * - sqlEngageRowId: Deterministic row anchor for taxonomy linkage
 * - policyVersion: Version of hint-selection policy in effect
 * - helpRequestIndex: Sequence number for the help ladder
 *
 * @module telemetry/build-hint-view-event
 */

import type { InteractionEvent } from '../../types';
import { createEventId } from '../utils/event-id';

/**
 * Required fields for a research-ready hint_view event
 */
export interface HintViewEventData {
  /** Event ID (optional - will be generated if not provided) */
  id?: string;
  /** Session ID for grouping */
  sessionId?: string;
  /** Learner ID */
  learnerId: string;
  /** Timestamp (optional - will use Date.now() if not provided) */
  timestamp?: number;
  /** Problem ID */
  problemId: string;
  /** Stable hint identifier */
  hintId: string;
  /** Full rendered hint text */
  hintText: string;
  /** Hint level (1, 2, or 3) */
  hintLevel: 1 | 2 | 3;
  /** Template identifier */
  templateId: string;
  /** SQL-Engage error subtype */
  sqlEngageSubtype: string;
  /** Deterministic row anchor */
  sqlEngageRowId: string;
  /** Policy version */
  policyVersion: string;
  /** Sequence number for help requests */
  helpRequestIndex: number;
  /** Condition ID for experimental tracking */
  conditionId?: string;
  /** Rule that fired to select this hint */
  ruleFired?: string;
  /** Source IDs retrieved for this hint */
  retrievedSourceIds?: string[];
  /** Chunk info retrieved for this hint */
  retrievedChunks?: Array<{
    docId: string;
    page?: number;
    chunkId?: string;
    score?: number;
    snippet?: string;
  }>;
  /** Input metadata */
  inputs?: Record<string, string | number | boolean | null>;
  /** Output metadata */
  outputs?: Record<string, string | number | boolean | null | string[]>;
}

/**
 * Contract violation warning helper
 * In dev/test, logs warnings for missing fields
 */
function warnContractViolation(field: string, eventId: string): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    // eslint-disable-next-line no-console
    console.warn(`[telemetry_contract_violation] hint_view event ${eventId} missing required field: ${field}`);
  }
}

/**
 * Validate that all required fields are present
 * Returns array of missing field names
 */
function validateHintViewData(data: HintViewEventData): string[] {
  const missing: string[] = [];

  if (!data.hintId?.trim()) missing.push('hintId');
  if (!data.hintText?.trim()) missing.push('hintText');
  if (data.hintLevel !== 1 && data.hintLevel !== 2 && data.hintLevel !== 3) missing.push('hintLevel');
  if (!data.templateId?.trim()) missing.push('templateId');
  if (!data.sqlEngageSubtype?.trim()) missing.push('sqlEngageSubtype');
  if (!data.sqlEngageRowId?.trim()) missing.push('sqlEngageRowId');
  if (!data.policyVersion?.trim()) missing.push('policyVersion');
  if (typeof data.helpRequestIndex !== 'number' || data.helpRequestIndex < 1) missing.push('helpRequestIndex');

  return missing;
}

/**
 * Build a complete hint_view event with contract enforcement
 *
 * @param data - Hint view event data
 * @returns Complete InteractionEvent of type 'hint_view'
 * @throws Error if required fields are missing (in dev/test only)
 */
export function buildHintViewEvent(data: HintViewEventData): InteractionEvent {
  const eventId = data.id || createEventId('event', 'hint-view');
  const timestamp = data.timestamp || Date.now();

  // Validate required fields
  const missing = validateHintViewData(data);

  if (missing.length > 0) {
    for (const field of missing) {
      warnContractViolation(field, eventId);
    }

    // In dev/test, throw error to catch issues early
    if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
      throw new Error(
        `Hint view event missing required fields for research contract: ${missing.join(', ')}. ` +
        `All hint_view events must have: hintId, hintText, hintLevel, templateId, ` +
        `sqlEngageSubtype, sqlEngageRowId, policyVersion, helpRequestIndex`
      );
    }
  }

  // Build the event
  const event: InteractionEvent = {
    id: eventId,
    sessionId: data.sessionId,
    learnerId: data.learnerId,
    timestamp,
    eventType: 'hint_view',
    problemId: data.problemId,
    hintId: data.hintId.trim(),
    hintText: data.hintText.trim(),
    hintLevel: data.hintLevel,
    templateId: data.templateId.trim(),
    helpRequestIndex: data.helpRequestIndex,
    sqlEngageSubtype: data.sqlEngageSubtype.trim(),
    sqlEngageRowId: data.sqlEngageRowId.trim(),
    policyVersion: data.policyVersion.trim(),
    ruleFired: data.ruleFired,
    retrievedSourceIds: data.retrievedSourceIds,
    retrievedChunks: data.retrievedChunks,
    inputs: data.inputs,
    outputs: data.outputs,
    conditionId: data.conditionId,
  };

  return event;
}

/**
 * Build a stable hint ID from hint components
 * Used when a deterministic ID is needed based on content
 *
 * @param params - Hint identification parameters
 * @returns Stable hint ID string
 */
export function buildStableHintId(params: {
  subtype: string;
  rowId: string;
  level: 1 | 2 | 3;
  templateId?: string;
}): string {
  const baseId = `sql-engage:${params.subtype}:hint:${params.rowId}:L${params.level}`;
  if (params.templateId) {
    return `${baseId}:${params.templateId}`;
  }
  return baseId;
}

/**
 * Check if a hint view event is research-ready
 * Validates that all paper data contract fields are present
 *
 * @param event - InteractionEvent to check
 * @returns Object with valid flag and list of any missing fields
 */
export function isResearchReadyHintView(
  event: InteractionEvent
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (event.eventType !== 'hint_view') {
    return { valid: false, missing: ['eventType must be hint_view'] };
  }

  if (!event.hintId?.trim()) missing.push('hintId');
  if (!event.hintText?.trim()) missing.push('hintText');
  if (event.hintLevel !== 1 && event.hintLevel !== 2 && event.hintLevel !== 3) missing.push('hintLevel');
  if (!event.templateId?.trim()) missing.push('templateId');
  if (!event.sqlEngageSubtype?.trim()) missing.push('sqlEngageSubtype');
  if (!event.sqlEngageRowId?.trim()) missing.push('sqlEngageRowId');
  if (!event.policyVersion?.trim()) missing.push('policyVersion');
  if (typeof event.helpRequestIndex !== 'number' || event.helpRequestIndex < 1) missing.push('helpRequestIndex');

  return { valid: missing.length === 0, missing };
}

/**
 * Research contract version for tracking compliance
 */
export const HINT_VIEW_CONTRACT_VERSION = 'hint-view-contract-v1';
