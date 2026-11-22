import type { InstructionalUnit, InteractionEvent } from '../../types';

/** The full explanation for a problem, ready to show on the hint card. */
export interface ProblemExplanation {
  noteId?: string;
  title: string;
  content: string;
  contentFormat?: InstructionalUnit['contentFormat'];
}

const EXPLANATION_TEMPLATE_ID = 'explanation.v1';

/**
 * Finds the most recent full explanation generated for a problem.
 *
 * The page saves the explanation to My Textbook and logs a textbook_add /
 * textbook_update event that carries the note id and a copy of the text. We read
 * that event so the hint card can show the same text, also after a reload or when
 * the learner comes back to the problem later. If the saved note is still in the
 * textbook, its text wins (it may have been updated since).
 */
export function findLatestExplanation(
  interactions: InteractionEvent[],
  problemId: string,
  textbookUnits: InstructionalUnit[] = [],
  justGenerated?: InstructionalUnit | null
): ProblemExplanation | null {
  const latestEvent = interactions
    .filter(
      (event) =>
        event.problemId === problemId &&
        event.templateId === EXPLANATION_TEMPLATE_ID &&
        (event.eventType === 'textbook_add' || event.eventType === 'textbook_update') &&
        Boolean(event.noteId)
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  const noteId = latestEvent?.noteId ?? (justGenerated?.type === 'explanation' ? justGenerated.id : undefined);
  if (!noteId) {
    return null;
  }

  const stored = textbookUnits.find((unit) => unit.id === noteId && unit.status !== 'archived');
  if (stored?.content) {
    return { noteId, title: stored.title, content: stored.content, contentFormat: stored.contentFormat };
  }
  if (justGenerated && justGenerated.id === noteId && justGenerated.content) {
    return {
      noteId,
      title: justGenerated.title,
      content: justGenerated.content,
      contentFormat: justGenerated.contentFormat
    };
  }
  if (latestEvent?.noteContent) {
    return {
      noteId,
      title: latestEvent.noteTitle || 'Full explanation',
      content: latestEvent.noteContent,
      contentFormat: 'markdown'
    };
  }
  return null;
}
