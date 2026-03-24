import type { InteractionEvent, InstructionalUnit, LearnerProfile } from '@/app/types';

export interface InstructorLearnerRow {
  id: string;
  name: string;
  email: string;
  lastActive: number;
  conceptsCount: number;
  conceptIds: string[];
  isActive: boolean;
}

export function buildInstructorLearnerRows(profiles: LearnerProfile[]): InstructorLearnerRow[] {
  const now = Date.now();
  return profiles.map((profile) => {
    const conceptIds = Array.from(profile.conceptsCovered ?? new Set<string>());
    const lastActive = profile.lastActive || profile.createdAt || now;
    return {
      id: profile.id,
      name: profile.name || profile.id,
      email: `${profile.id}@local`,
      lastActive,
      conceptsCount: conceptIds.length,
      conceptIds,
      isActive: now - lastActive < 60 * 60 * 1000,
    };
  });
}

export function filterInteractionsByLearners(
  interactions: InteractionEvent[],
  learnerIds: Set<string>
): InteractionEvent[] {
  if (learnerIds.size === 0) return [];
  return interactions.filter((interaction) => learnerIds.has(interaction.learnerId));
}

export function countInteractionsByType(
  interactions: InteractionEvent[],
  eventType: InteractionEvent['eventType']
): number {
  return interactions.filter((interaction) => interaction.eventType === eventType).length;
}

export function getTextbookSummaryCounts(units: InstructionalUnit[]): {
  totalNotes: number;
  conceptCount: number;
  problemLinkedNotes: number;
} {
  const conceptCount = new Set(units.map((unit) => unit.conceptId).filter(Boolean)).size;
  const problemLinkedNotes = units.filter((unit) => Boolean(unit.problemId)).length;
  return {
    totalNotes: units.length,
    conceptCount,
    problemLinkedNotes,
  };
}
