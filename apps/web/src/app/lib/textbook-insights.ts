import { InstructionalUnit, InteractionEvent } from '../types';
import { conceptNodes, getConceptById, getConceptIdsForSqlEngageSubtype } from '../data/sql-engage';

export type MisconceptionCard = {
  id: string;
  subtype: string;
  count: number;
  lastSeenAt: number;
  conceptNames: string[];
  evidenceIds: string[];
};

export type SpacedReviewPrompt = {
  id: string;
  title: string;
  message: string;
  dueAt: number;
  lastSeenAt: number;
  evidenceIds: string[];
};

export type TextbookInsights = {
  orderedUnits: InstructionalUnit[];
  misconceptionCards: MisconceptionCard[];
  spacedReviewPrompts: SpacedReviewPrompt[];
};

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

function getConceptDepthMap(): Map<string, number> {
  const byId = new Map(conceptNodes.map((node) => [node.id, node]));
  const memo = new Map<string, number>();

  const visit = (conceptId: string, stack: Set<string>): number => {
    if (memo.has(conceptId)) {
      return memo.get(conceptId)!;
    }
    if (stack.has(conceptId)) {
      return 0;
    }

    const concept = byId.get(conceptId);
    if (!concept || concept.prerequisites.length === 0) {
      memo.set(conceptId, 0);
      return 0;
    }

    stack.add(conceptId);
    const depth = Math.max(
      ...concept.prerequisites.map((prereq) => visit(prereq, stack) + 1),
      0
    );
    stack.delete(conceptId);

    memo.set(conceptId, depth);
    return depth;
  };

  for (const concept of conceptNodes) {
    visit(concept.id, new Set<string>());
  }

  return memo;
}

export function orderUnitsByPrerequisite(units: InstructionalUnit[]): InstructionalUnit[] {
  const depthMap = getConceptDepthMap();

  return [...units].sort((a, b) => {
    const depthA = depthMap.get(a.conceptId) ?? 999;
    const depthB = depthMap.get(b.conceptId) ?? 999;
    if (depthA !== depthB) {
      return depthA - depthB;
    }

    const titleDelta = (a.title || '').localeCompare(b.title || '');
    if (titleDelta !== 0) {
      return titleDelta;
    }

    return a.addedTimestamp - b.addedTimestamp;
  });
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function buildMisconceptionCards(interactions: InteractionEvent[]): MisconceptionCard[] {
  const grouped = new Map<string, { count: number; lastSeenAt: number; evidenceIds: string[] }>();

  interactions
    .filter((interaction) => interaction.eventType === 'error' || interaction.eventType === 'hint_view' || interaction.eventType === 'explanation_view')
    .forEach((interaction) => {
      const subtype = (interaction.sqlEngageSubtype || interaction.errorSubtypeId || 'unknown-subtype').trim();
      const key = subtype || 'unknown-subtype';
      const current = grouped.get(key) || { count: 0, lastSeenAt: 0, evidenceIds: [] };
      current.count += 1;
      current.lastSeenAt = Math.max(current.lastSeenAt, interaction.timestamp);
      current.evidenceIds.push(interaction.id);
      grouped.set(key, current);
    });

  return [...grouped.entries()]
    .filter(([, stats]) => stats.count >= 2)
    .sort((a, b) => {
      if (a[1].count !== b[1].count) {
        return b[1].count - a[1].count;
      }
      return b[1].lastSeenAt - a[1].lastSeenAt;
    })
    .slice(0, 4)
    .map(([subtype, stats]) => {
      const conceptNames = getConceptIdsForSqlEngageSubtype(subtype)
        .map((conceptId) => getConceptById(conceptId)?.name || conceptId)
        .filter(Boolean);

      return {
        id: `misconception-${sanitizeId(subtype)}`,
        subtype,
        count: stats.count,
        lastSeenAt: stats.lastSeenAt,
        conceptNames,
        evidenceIds: stats.evidenceIds
      };
    });
}

function buildSpacedReviewPrompts(cards: MisconceptionCard[], nowTimestamp: number): SpacedReviewPrompt[] {
  return cards.slice(0, 3).map((card) => {
    const intervalMs = card.count >= 5 ? 60 * 60 * 1000 : card.count >= 3 ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const dueAt = card.lastSeenAt + intervalMs;
    const remaining = dueAt - nowTimestamp;
    const isDueNow = remaining <= 0;

    return {
      id: `review-${sanitizeId(card.subtype)}`,
      title: `Review ${card.subtype}`,
      message: isDueNow
        ? `Ready now. You revisited this ${card.count} times.`
        : `Review in ${formatDuration(remaining)} based on recent attempts (${card.count}).`,
      dueAt,
      lastSeenAt: card.lastSeenAt,
      evidenceIds: card.evidenceIds.slice(-6)
    };
  });
}

export function buildTextbookInsights(options: {
  units: InstructionalUnit[];
  interactions: InteractionEvent[];
  nowTimestamp?: number;
}): TextbookInsights {
  const nowTimestamp = options.nowTimestamp ?? Date.now();
  const orderedUnits = orderUnitsByPrerequisite(options.units);
  const misconceptionCards = buildMisconceptionCards(options.interactions);
  const spacedReviewPrompts = buildSpacedReviewPrompts(misconceptionCards, nowTimestamp);

  return {
    orderedUnits,
    misconceptionCards,
    spacedReviewPrompts
  };
}
