/**
 * Tests for build-hint-view-event.ts
 *
 * @module telemetry/build-hint-view-event.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildHintViewEvent,
  buildStableHintId,
  isResearchReadyHintView,
  HINT_VIEW_CONTRACT_VERSION,
  type HintViewEventData,
} from './build-hint-view-event';

describe('buildHintViewEvent', () => {
  const validHintData: HintViewEventData = {
    learnerId: 'learner-123',
    problemId: 'problem-456',
    hintId: 'hint-abc-123',
    hintText: 'Consider using a WHERE clause to filter results.',
    hintLevel: 2,
    templateId: 'template-guiding-question',
    sqlEngageSubtype: 'incorrect_where_clause',
    sqlEngageRowId: 'sql-engage-incorrect_where_clause-hint-001',
    policyVersion: 'sql-engage-v1.0.0',
    helpRequestIndex: 1,
  };

  it('should build a complete hint_view event', () => {
    const event = buildHintViewEvent(validHintData);

    expect(event.eventType).toBe('hint_view');
    expect(event.learnerId).toBe('learner-123');
    expect(event.problemId).toBe('problem-456');
    expect(event.hintId).toBe('hint-abc-123');
    expect(event.hintText).toBe('Consider using a WHERE clause to filter results.');
    expect(event.hintLevel).toBe(2);
    expect(event.templateId).toBe('template-guiding-question');
    expect(event.sqlEngageSubtype).toBe('incorrect_where_clause');
    expect(event.sqlEngageRowId).toBe('sql-engage-incorrect_where_clause-hint-001');
    expect(event.policyVersion).toBe('sql-engage-v1.0.0');
    expect(event.helpRequestIndex).toBe(1);
    expect(event.timestamp).toBeDefined();
    expect(event.id).toBeDefined();
  });

  it('should use provided id and timestamp', () => {
    const customId = 'custom-event-id';
    const customTimestamp = 1234567890;

    const event = buildHintViewEvent({
      ...validHintData,
      id: customId,
      timestamp: customTimestamp,
    });

    expect(event.id).toBe(customId);
    expect(event.timestamp).toBe(customTimestamp);
  });

  it('should use provided sessionId and conditionId', () => {
    const event = buildHintViewEvent({
      ...validHintData,
      sessionId: 'session-xyz',
      conditionId: 'condition-adaptive',
    });

    expect(event.sessionId).toBe('session-xyz');
    expect(event.conditionId).toBe('condition-adaptive');
  });

  it('should include optional fields', () => {
    const event = buildHintViewEvent({
      ...validHintData,
      ruleFired: 'enhanced-hint',
      retrievedSourceIds: ['chunk-1', 'chunk-2'],
      retrievedChunks: [
        { docId: 'doc-1', page: 5, chunkId: 'chunk-1', score: 0.95, snippet: 'text...' },
      ],
      inputs: { retry_count: 1, hint_count: 0 },
      outputs: { will_escalate: false },
    });

    expect(event.ruleFired).toBe('enhanced-hint');
    expect(event.retrievedSourceIds).toEqual(['chunk-1', 'chunk-2']);
    expect(event.retrievedChunks).toHaveLength(1);
    expect(event.inputs).toEqual({ retry_count: 1, hint_count: 0 });
    expect(event.outputs).toEqual({ will_escalate: false });
  });

  it('should trim whitespace from string fields', () => {
    const event = buildHintViewEvent({
      ...validHintData,
      hintId: '  hint-123  ',
      hintText: '  Some hint text  ',
      templateId: '  template-1  ',
    });

    expect(event.hintId).toBe('hint-123');
    expect(event.hintText).toBe('Some hint text');
    expect(event.templateId).toBe('template-1');
  });

  it('should accept all valid hint levels', () => {
    const level1Event = buildHintViewEvent({ ...validHintData, hintLevel: 1 });
    expect(level1Event.hintLevel).toBe(1);

    const level2Event = buildHintViewEvent({ ...validHintData, hintLevel: 2 });
    expect(level2Event.hintLevel).toBe(2);

    const level3Event = buildHintViewEvent({ ...validHintData, hintLevel: 3 });
    expect(level3Event.hintLevel).toBe(3);
  });
});

describe('buildStableHintId', () => {
  it('should build a stable hint ID without template', () => {
    const id = buildStableHintId({
      subtype: 'incorrect_where_clause',
      rowId: 'sql-engage-incorrect_where_clause-hint-001',
      level: 2,
    });

    expect(id).toBe('sql-engage:incorrect_where_clause:hint:sql-engage-incorrect_where_clause-hint-001:L2');
  });

  it('should build a stable hint ID with template', () => {
    const id = buildStableHintId({
      subtype: 'incorrect_where_clause',
      rowId: 'sql-engage-incorrect_where_clause-hint-001',
      level: 2,
      templateId: 'template-guiding-question',
    });

    expect(id).toBe('sql-engage:incorrect_where_clause:hint:sql-engage-incorrect_where_clause-hint-001:L2:template-guiding-question');
  });
});

describe('isResearchReadyHintView', () => {
  it('should return valid for a complete hint_view event', () => {
    const event = buildHintViewEvent({
      learnerId: 'learner-123',
      problemId: 'problem-456',
      hintId: 'hint-abc',
      hintText: 'Some hint',
      hintLevel: 1,
      templateId: 'template-1',
      sqlEngageSubtype: 'subtype-1',
      sqlEngageRowId: 'row-1',
      policyVersion: 'v1',
      helpRequestIndex: 1,
    });

    const result = isResearchReadyHintView(event);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('should detect missing hintId', () => {
    const result = isResearchReadyHintView({
      eventType: 'hint_view',
      id: 'test',
      learnerId: 'l1',
      timestamp: 1,
      problemId: 'p1',
      hintText: 'hint',
      hintLevel: 1,
      templateId: 't1',
      sqlEngageSubtype: 's1',
      sqlEngageRowId: 'r1',
      policyVersion: 'v1',
      helpRequestIndex: 1,
    } as any);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('hintId');
  });

  it('should detect missing templateId', () => {
    const result = isResearchReadyHintView({
      eventType: 'hint_view',
      id: 'test',
      learnerId: 'l1',
      timestamp: 1,
      problemId: 'p1',
      hintId: 'h1',
      hintText: 'hint',
      hintLevel: 1,
      sqlEngageSubtype: 's1',
      sqlEngageRowId: 'r1',
      policyVersion: 'v1',
      helpRequestIndex: 1,
    } as any);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('templateId');
  });

  it('should detect invalid hintLevel', () => {
    const result = isResearchReadyHintView({
      eventType: 'hint_view',
      id: 'test',
      learnerId: 'l1',
      timestamp: 1,
      problemId: 'p1',
      hintId: 'h1',
      hintText: 'hint',
      hintLevel: 4 as any,
      templateId: 't1',
      sqlEngageSubtype: 's1',
      sqlEngageRowId: 'r1',
      policyVersion: 'v1',
      helpRequestIndex: 1,
    } as any);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('hintLevel');
  });

  it('should detect wrong event type', () => {
    const result = isResearchReadyHintView({
      eventType: 'code_change',
      id: 'test',
      learnerId: 'l1',
      timestamp: 1,
      problemId: 'p1',
    } as any);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('eventType must be hint_view');
  });
});

describe('HINT_VIEW_CONTRACT_VERSION', () => {
  it('should have the correct version', () => {
    expect(HINT_VIEW_CONTRACT_VERSION).toBe('hint-view-contract-v1');
  });
});
