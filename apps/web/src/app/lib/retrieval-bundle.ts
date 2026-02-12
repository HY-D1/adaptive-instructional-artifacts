import { SQLProblem, InteractionEvent, PdfIndexChunk } from '../types';
import {
  canonicalizeSqlEngageSubtype,
  getConceptById,
  getConceptIdsForSqlEngageSubtype,
  getDeterministicSqlEngageAnchor,
  getProgressiveSqlEngageHintText,
  getSqlEngageRowsBySubtype
} from '../data/sql-engage';
import { storage } from './storage';

export type RetrievalHintHistory = {
  hintLevel: 1 | 2 | 3;
  hintText: string;
  interactionId: string;
  helpRequestIndex?: number;
  sourceId?: string;
};

export type RetrievalSqlEngageAnchor = {
  rowId: string;
  error_subtype: string;
  feedback_target: string;
  intended_learning_outcome: string;
};

export type RetrievalPdfPassage = {
  chunkId: string;
  page: number;
  text: string;
  score: number;
};

export type RetrievalBundle = {
  learnerId: string;
  problemId: string;
  problemTitle: string;
  schemaText: string;
  lastErrorSubtypeId: string;
  hintHistory: RetrievalHintHistory[];
  sqlEngageAnchor?: RetrievalSqlEngageAnchor;
  conceptCandidates: Array<{ id: string; name: string; description: string }>;
  recentInteractionsSummary: {
    errors: number;
    retries: number;
    timeSpent: number;
    hintCount: number;
  };
  retrievedSourceIds: string[];
  triggerInteractionIds: string[];
  pdfPassages: RetrievalPdfPassage[];
};

export function buildRetrievalBundle(options: {
  learnerId: string;
  problem: SQLProblem;
  interactions: InteractionEvent[];
  triggerInteractionIds?: string[];
  lastErrorSubtypeId?: string;
  pdfTopK?: number;
}): RetrievalBundle {
  const {
    learnerId,
    problem,
    interactions,
    triggerInteractionIds = [],
    lastErrorSubtypeId,
    pdfTopK = 3
  } = options;

  const problemInteractions = interactions
    .filter((interaction) => interaction.problemId === problem.id)
    .sort((a, b) => a.timestamp - b.timestamp);

  const latestError = [...problemInteractions]
    .reverse()
    .find((interaction) => interaction.eventType === 'error');
  const normalizedSubtype = canonicalizeSqlEngageSubtype(
    lastErrorSubtypeId || latestError?.sqlEngageSubtype || latestError?.errorSubtypeId || 'incomplete query'
  );

  const hintEvents = problemInteractions
    .filter((interaction) => interaction.eventType === 'hint_view')
    .slice(-3);

  const hintHistory: RetrievalHintHistory[] = hintEvents.map((event, index) => {
    const level = (event.hintLevel || Math.min(index + 1, 3)) as 1 | 2 | 3;
    const hintSubtype = canonicalizeSqlEngageSubtype(event.sqlEngageSubtype || normalizedSubtype);
    const fallbackRow = getDeterministicSqlEngageAnchor(
      hintSubtype,
      `${learnerId}|${problem.id}|${hintSubtype}`
    );
    const sourceId = resolveHintSourceId(event, fallbackRow?.rowId);
    const hintText =
      event.hintText ||
      getProgressiveSqlEngageHintText(event.sqlEngageSubtype || normalizedSubtype, level, fallbackRow);

    return {
      hintLevel: level,
      hintText,
      interactionId: event.id,
      helpRequestIndex: event.helpRequestIndex,
      sourceId
    };
  });

  const anchor = getDeterministicSqlEngageAnchor(
    normalizedSubtype,
    `${learnerId}|${problem.id}|${normalizedSubtype}`
  );

  const conceptIds = Array.from(new Set([
    ...problem.concepts,
    ...getConceptIdsForSqlEngageSubtype(normalizedSubtype)
  ]));

  const conceptCandidates = conceptIds
    .map((conceptId) => {
      const concept = getConceptById(conceptId);
      if (!concept) {
        return {
          id: conceptId,
          name: conceptId,
          description: 'Not found in provided sources.'
        };
      }
      return {
        id: concept.id,
        name: concept.name,
        description: concept.description
      };
    });

  const errors = problemInteractions.filter((interaction) => interaction.eventType === 'error').length;
  const hintCount = hintEvents.length;
  const timeSpent = problemInteractions.length > 0
    ? problemInteractions[problemInteractions.length - 1].timestamp - problemInteractions[0].timestamp
    : 0;

  const pdfPassages = findTopPdfPassages(
    {
      subtype: normalizedSubtype,
      problemTitle: problem.title,
      conceptNames: conceptCandidates.map((concept) => concept.name)
    },
    pdfTopK
  );

  const retrievedSourceIds = Array.from(new Set([
    ...(anchor ? [anchor.rowId] : []),
    ...hintHistory
      .map((hint) => hint.sourceId)
      .filter((sourceId): sourceId is string => Boolean(sourceId)),
    ...pdfPassages.map((passage) => passage.chunkId),
    ...getSqlEngageRowsBySubtype(normalizedSubtype).slice(0, 2).map((row) => row.rowId)
  ]));

  return {
    learnerId,
    problemId: problem.id,
    problemTitle: problem.title,
    schemaText: problem.schema,
    lastErrorSubtypeId: normalizedSubtype,
    hintHistory,
    sqlEngageAnchor: anchor
      ? {
          rowId: anchor.rowId,
          error_subtype: anchor.error_subtype,
          feedback_target: anchor.feedback_target,
          intended_learning_outcome: anchor.intended_learning_outcome
        }
      : undefined,
    conceptCandidates,
    recentInteractionsSummary: {
      errors,
      retries: Math.max(0, errors - 1),
      timeSpent,
      hintCount
    },
    retrievedSourceIds,
    triggerInteractionIds,
    pdfPassages
  };
}

function resolveHintSourceId(event: InteractionEvent, fallbackRowId?: string): string | undefined {
  if (event.sqlEngageRowId?.trim()) {
    return event.sqlEngageRowId.trim();
  }

  return fallbackRowId;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scoreChunk(chunk: PdfIndexChunk, keywords: Set<string>): number {
  const tokens = tokenize(chunk.text);
  if (tokens.length === 0 || keywords.size === 0) return 0;

  let matches = 0;
  for (const token of tokens) {
    if (keywords.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.sqrt(tokens.length);
}

function findTopPdfPassages(
  input: {
    subtype: string;
    problemTitle: string;
    conceptNames: string[];
  },
  topK: number
): RetrievalPdfPassage[] {
  const pdfIndex = storage.getPdfIndex();
  if (!pdfIndex) return [];

  const keywords = new Set<string>([
    ...tokenize(input.subtype),
    ...tokenize(input.problemTitle),
    ...input.conceptNames.flatMap(tokenize)
  ]);

  return pdfIndex.chunks
    .map((chunk) => ({
      chunkId: chunk.chunkId,
      page: chunk.page,
      text: chunk.text,
      score: scoreChunk(chunk, keywords)
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
