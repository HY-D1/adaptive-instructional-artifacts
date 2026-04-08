import { describe, expect, it } from 'vitest';
import { validateResearchBatchForWrite } from '../../../apps/server/src/routes/neon-interactions';

describe('neon interaction research validation', () => {
  it('rejects a batch before insert when any research-critical event is incomplete', () => {
    const result = validateResearchBatchForWrite([
      {
        id: 'hint-valid-1',
        learnerId: 'learner-1',
        eventType: 'hint_view',
        problemId: 'problem-1',
        hintId: 'hint-1',
        hintText: 'Check your join condition.',
        hintLevel: 2,
        templateId: 'sql-engage-rung-2',
        sqlEngageSubtype: 'joins',
        sqlEngageRowId: 'sql-engage:joins:1',
        policyVersion: 'policy-definitions-v1',
        helpRequestIndex: 2,
      },
      {
        id: 'hint-invalid-1',
        learnerId: 'learner-1',
        eventType: 'hint_view',
        problemId: 'problem-1',
        hintId: 'hint-2',
        hintLevel: 3,
        sqlEngageSubtype: 'joins',
        sqlEngageRowId: 'sql-engage:joins:2',
        policyVersion: 'policy-definitions-v1',
        helpRequestIndex: 3,
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.failedIds).toEqual(['hint-invalid-1']);
    expect(result.errors).toEqual([
      {
        eventId: 'hint-invalid-1',
        eventType: 'hint_view',
        missingFields: ['hintText', 'templateId'],
      },
    ]);
  });

  it('requires note identity fields for textbook save events', () => {
    const result = validateResearchBatchForWrite([
      {
        id: 'textbook-invalid-1',
        learnerId: 'learner-1',
        eventType: 'textbook_add',
        problemId: 'problem-1',
        noteTitle: 'Joins review',
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      {
        eventId: 'textbook-invalid-1',
        eventType: 'textbook_add',
        missingFields: ['noteId', 'noteContent', 'templateId', 'policyVersion'],
      },
    ]);
  });

  it('requires chat content and retrieval linkage when chat reports retrieved units', () => {
    const result = validateResearchBatchForWrite([
      {
        id: 'chat-invalid-1',
        learnerId: 'learner-1',
        eventType: 'chat_interaction',
        problemId: 'problem-1',
        chatMessage: 'Can you explain joins?',
        textbookUnitsRetrieved: ['unit-joins'],
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      {
        eventId: 'chat-invalid-1',
        eventType: 'chat_interaction',
        missingFields: ['chatResponse', 'retrievedSourceIds'],
      },
    ]);
  });
});
