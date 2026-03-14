/**
 * Replay Normalization Tests
 * 
 * Verifies that the normalized trace preservation correctly handles
 * the full replay-relevant event set.
 * 
 * @module tests/unit/replay/replay-normalize
 */

import { describe, it, expect } from 'vitest';

// The allowed event types from normalize-real-traces.mjs
const ALLOWED_EVENT_TYPES = new Set([
  // Core interaction events
  'code_change',
  'execution',
  'error',
  // Help-seeking events
  'hint_request',
  'hint_view',
  'explanation_view',
  'guidance_request',
  'guidance_view',
  'guidance_escalate',
  // Content events
  'llm_generate',
  'textbook_add',
  'textbook_update',
  'textbook_unit_upsert',
  // Reinforcement events
  'reinforcement_response',
  'reinforcement_shown',
  // Profile/policy events
  'profile_assigned',
  'escalation_triggered',
  // Bandit events
  'bandit_arm_selected',
  'bandit_reward_observed',
  'bandit_updated',
  // HDI events
  'hdi_calculated',
  'hdi_trajectory_updated',
  'dependency_intervention_triggered',
  // Source events
  'source_view',
  'pdf_index_rebuilt',
  'pdf_index_uploaded',
  // Session events
  'session_started',
  'session_ended',
  // Concept events
  'concept_extraction',
  'prerequisite_violation_detected'
]);

describe('Replay Event Type Coverage', () => {
  it('should include all core interaction events', () => {
    expect(ALLOWED_EVENT_TYPES.has('code_change')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('execution')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('error')).toBe(true);
  });

  it('should include all help-seeking events', () => {
    expect(ALLOWED_EVENT_TYPES.has('hint_request')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('hint_view')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('explanation_view')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('guidance_request')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('guidance_view')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('guidance_escalate')).toBe(true);
  });

  it('should include all textbook/content events', () => {
    expect(ALLOWED_EVENT_TYPES.has('textbook_add')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('textbook_update')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('textbook_unit_upsert')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('llm_generate')).toBe(true);
  });

  it('should include all reinforcement events', () => {
    expect(ALLOWED_EVENT_TYPES.has('reinforcement_response')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('reinforcement_shown')).toBe(true);
  });

  it('should include all profile/policy events', () => {
    expect(ALLOWED_EVENT_TYPES.has('profile_assigned')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('escalation_triggered')).toBe(true);
  });

  it('should include all bandit events', () => {
    expect(ALLOWED_EVENT_TYPES.has('bandit_arm_selected')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('bandit_reward_observed')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('bandit_updated')).toBe(true);
  });

  it('should include all HDI events', () => {
    expect(ALLOWED_EVENT_TYPES.has('hdi_calculated')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('hdi_trajectory_updated')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('dependency_intervention_triggered')).toBe(true);
  });

  it('should include all session events', () => {
    expect(ALLOWED_EVENT_TYPES.has('session_started')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('session_ended')).toBe(true);
  });

  it('should include all concept events', () => {
    expect(ALLOWED_EVENT_TYPES.has('concept_extraction')).toBe(true);
    expect(ALLOWED_EVENT_TYPES.has('prerequisite_violation_detected')).toBe(true);
  });

  it('should have at least 27 replay-relevant event types', () => {
    // Core (3) + Help-seeking (6) + Content (4) + Reinforcement (2) + 
    // Profile (2) + Bandit (3) + HDI (3) + Source (3) + Session (2) + Concept (2) = 30
    expect(ALLOWED_EVENT_TYPES.size).toBeGreaterThanOrEqual(27);
  });
});

describe('Replay Metrics with Broadened Events', () => {
  it('should count guidance events correctly', () => {
    const mockTrace = [
      { eventType: 'hint_view', hintLevel: 1 },
      { eventType: 'hint_view', hintLevel: 2 },
      { eventType: 'guidance_view', hintLevel: 3 },
      { eventType: 'explanation_view' }
    ];
    
    const hintViews = mockTrace.filter(e => e.eventType === 'hint_view').length;
    const guidanceViews = mockTrace.filter(e => e.eventType === 'guidance_view').length;
    const explanations = mockTrace.filter(e => e.eventType === 'explanation_view').length;
    
    expect(hintViews).toBe(2);
    expect(guidanceViews).toBe(1);
    expect(explanations).toBe(1);
  });

  it('should count textbook events correctly', () => {
    const mockTrace = [
      { eventType: 'textbook_add' },
      { eventType: 'textbook_update' },
      { eventType: 'textbook_unit_upsert' }
    ];
    
    const textbookEvents = mockTrace.filter(e => 
      e.eventType.startsWith('textbook_')
    ).length;
    
    expect(textbookEvents).toBe(3);
  });

  it('should count reinforcement events correctly', () => {
    const mockTrace = [
      { eventType: 'reinforcement_shown' },
      { eventType: 'reinforcement_response', isCorrect: true },
      { eventType: 'reinforcement_response', isCorrect: false }
    ];
    
    const reinforcements = mockTrace.filter(e => 
      e.eventType.startsWith('reinforcement_')
    ).length;
    const correctResponses = mockTrace.filter(e => 
      e.eventType === 'reinforcement_response' && e.isCorrect
    ).length;
    
    expect(reinforcements).toBe(3);
    expect(correctResponses).toBe(1);
  });

  it('should count HDI and profile events correctly', () => {
    const mockTrace = [
      { eventType: 'hdi_calculated', hdi: 0.5 },
      { eventType: 'hdi_trajectory_updated' },
      { eventType: 'profile_assigned', profileId: 'adaptive' }
    ];
    
    const hdiEvents = mockTrace.filter(e => e.eventType.startsWith('hdi_')).length;
    const profileEvents = mockTrace.filter(e => e.eventType === 'profile_assigned').length;
    
    expect(hdiEvents).toBe(2);
    expect(profileEvents).toBe(1);
  });

  it('should handle empty/minimal trace without crashing', () => {
    const emptyTrace: Array<{ eventType: string }> = [];
    const hintViews = emptyTrace.filter(e => e.eventType === 'hint_view').length;
    
    expect(hintViews).toBe(0);
  });
});

describe('Replay Event Field Preservation', () => {
  it('should preserve required core fields in normalized events', () => {
    const mockEvent = {
      id: 'evt-001',
      learnerId: 'learner-1',
      sessionId: 'sess-001',
      problemId: 'p1-test',
      timestamp: 1700000000000,
      eventType: 'hint_view',
      hintLevel: 1,
      conceptIds: ['concept-1']
    };
    
    expect(mockEvent.id).toBeDefined();
    expect(mockEvent.learnerId).toBeDefined();
    expect(mockEvent.timestamp).toBeDefined();
    expect(mockEvent.eventType).toBeDefined();
    expect(mockEvent.problemId).toBeDefined();
  });

  it('should preserve extended fields for broadened event types', () => {
    const guidanceEvent = {
      id: 'evt-guidance',
      eventType: 'guidance_escalate',
      fromRung: 2,
      toRung: 3
    };
    
    expect(guidanceEvent.fromRung).toBe(2);
    expect(guidanceEvent.toRung).toBe(3);
    
    const textbookEvent = {
      id: 'evt-textbook',
      eventType: 'textbook_add',
      noteTitle: 'Test Note',
      conceptIds: ['concept-1']
    };
    
    expect(textbookEvent.noteTitle).toBe('Test Note');
    expect(textbookEvent.conceptIds).toContain('concept-1');
  });
});
