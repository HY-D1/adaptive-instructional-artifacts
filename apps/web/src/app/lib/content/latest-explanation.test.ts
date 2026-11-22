import { describe, expect, it } from 'vitest';
import type { InstructionalUnit, InteractionEvent } from '../../types';
import { findLatestExplanation } from './latest-explanation';

const event = (over: Partial<InteractionEvent>): InteractionEvent =>
  ({
    id: 'e',
    learnerId: 'l1',
    sessionId: 's1',
    problemId: 'problem-3',
    timestamp: 1,
    eventType: 'textbook_add',
    templateId: 'explanation.v1',
    noteId: 'note-a',
    noteTitle: 'Saved title',
    noteContent: 'Saved **text**',
    ...over,
  }) as InteractionEvent;

const unit = (over: Partial<InstructionalUnit>): InstructionalUnit =>
  ({
    id: 'note-a',
    type: 'explanation',
    conceptId: 'select-basic',
    title: 'Textbook title',
    content: 'Textbook text',
    contentFormat: 'markdown',
    prerequisites: [],
    addedTimestamp: 1,
    sourceInteractionIds: [],
    ...over,
  }) as InstructionalUnit;

describe('findLatestExplanation', () => {
  it('returns null when no explanation note was saved for the problem', () => {
    expect(findLatestExplanation([], 'problem-3')).toBeNull();
    expect(findLatestExplanation([event({ problemId: 'problem-9' })], 'problem-3')).toBeNull();
    expect(findLatestExplanation([event({ templateId: 'notebook_unit.v1' })], 'problem-3')).toBeNull();
    expect(findLatestExplanation([event({ eventType: 'hint_view' })], 'problem-3')).toBeNull();
  });

  it('uses the text copied on the saved-note event when the note is not in the textbook list', () => {
    expect(findLatestExplanation([event({})], 'problem-3')).toEqual({
      noteId: 'note-a',
      title: 'Saved title',
      content: 'Saved **text**',
      contentFormat: 'markdown',
    });
  });

  it('prefers the note in the textbook, which may have been updated since', () => {
    const result = findLatestExplanation([event({})], 'problem-3', [unit({})]);
    expect(result?.title).toBe('Textbook title');
    expect(result?.content).toBe('Textbook text');
  });

  it('ignores archived notes and falls back to the event copy', () => {
    const result = findLatestExplanation([event({})], 'problem-3', [unit({ status: 'archived' })]);
    expect(result?.content).toBe('Saved **text**');
  });

  it('picks the most recent saved explanation for the problem', () => {
    const older = event({ id: 'old', timestamp: 1, noteId: 'note-old', noteContent: 'old text' });
    const newer = event({ id: 'new', timestamp: 5, eventType: 'textbook_update', noteId: 'note-new', noteContent: 'new text' });
    expect(findLatestExplanation([newer, older], 'problem-3')?.content).toBe('new text');
  });

  it('can show the unit that was just generated before its event is logged', () => {
    const just = unit({ id: 'note-fresh', content: 'fresh text' });
    expect(findLatestExplanation([], 'problem-3', [], just)?.content).toBe('fresh text');
  });
});
