import { SQLProblem, InteractionEvent, PdfIndexProvenance } from '../types';
import {
  canonicalizeSqlEngageSubtype,
  getConceptById,
  getConceptIdsForSqlEngageSubtype,
  getDeterministicSqlEngageAnchor,
  getProgressiveSqlEngageHintText,
  getSqlEngageRowsBySubtype
} from '../data/sql-engage';
import { getActivePdfIndexProvenance, retrievePdfChunks } from './pdf-retrieval';

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
  docId: string;
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
  pdfIndexProvenance: PdfIndexProvenance | null;
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
      problemDescription: problem.description,
      conceptNames: conceptCandidates.map((concept) => concept.name)
    },
    pdfTopK
  );
  const pdfIndexProvenance = getActivePdfIndexProvenance();

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
    pdfPassages,
    pdfIndexProvenance
  };
}

function resolveHintSourceId(event: InteractionEvent, fallbackRowId?: string): string | undefined {
  if (event.sqlEngageRowId?.trim()) {
    return event.sqlEngageRowId.trim();
  }

  return fallbackRowId;
}

function findTopPdfPassages(
  input: {
    subtype: string;
    problemTitle: string;
    problemDescription?: string;
    conceptNames: string[];
  },
  topK: number
): RetrievalPdfPassage[] {
  // Build a more comprehensive query that includes:
  // 1. Error subtype (e.g., "incomplete query")
  // 2. Problem title (e.g., "Select All Users")
  // 3. Problem description if available
  // 4. Concept names (e.g., "Basic SELECT", "WHERE Clause")
  // 5. SQL keywords extracted from concepts
  const sqlKeywords = extractSqlKeywordsFromConcepts(input.conceptNames);
  
  const query = [
    input.subtype,
    input.problemTitle,
    input.problemDescription,
    ...input.conceptNames,
    ...sqlKeywords
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');

  const chunks = retrievePdfChunks(query, topK);
  
  // Deduplicate chunks by chunkId, keeping the highest score
  const seenChunkIds = new Map<string, RetrievalPdfPassage>();
  for (const chunk of chunks) {
    const existing = seenChunkIds.get(chunk.chunkId);
    if (!existing || chunk.score > existing.score) {
      seenChunkIds.set(chunk.chunkId, {
        chunkId: chunk.chunkId,
        docId: chunk.docId,
        page: chunk.page,
        text: chunk.text,
        score: chunk.score
      });
    }
  }
  
  return Array.from(seenChunkIds.values());
}

/**
 * Extract SQL keywords from concept names to improve PDF retrieval
 */
function extractSqlKeywordsFromConcepts(conceptNames: string[]): string[] {
  const keywords: string[] = [];
  
  for (const name of conceptNames) {
    const lowerName = name.toLowerCase();
    
    // Map concept names to likely SQL keywords in the PDF
    if (lowerName.includes('select')) {
      keywords.push('SELECT', 'FROM', 'columns');
    }
    if (lowerName.includes('where')) {
      keywords.push('WHERE', 'condition', 'filter');
    }
    if (lowerName.includes('join')) {
      keywords.push('JOIN', 'INNER JOIN', 'LEFT JOIN', 'ON', 'tables');
    }
    if (lowerName.includes('aggregation')) {
      keywords.push('COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'GROUP BY', 'aggregate');
    }
    if (lowerName.includes('order')) {
      keywords.push('ORDER BY', 'ASC', 'DESC', 'sort');
    }
    if (lowerName.includes('subquery')) {
      keywords.push('subquery', 'nested', 'IN', 'EXISTS');
    }
    if (lowerName.includes('insert')) {
      keywords.push('INSERT INTO', 'VALUES');
    }
    if (lowerName.includes('update')) {
      keywords.push('UPDATE', 'SET');
    }
    if (lowerName.includes('delete')) {
      keywords.push('DELETE FROM');
    }
    if (lowerName.includes('window')) {
      keywords.push('ROW_NUMBER', 'RANK', 'OVER', 'PARTITION BY');
    }
    if (lowerName.includes('case')) {
      keywords.push('CASE', 'WHEN', 'THEN', 'ELSE', 'END');
    }
    if (lowerName.includes('null')) {
      keywords.push('NULL', 'IS NULL', 'COALESCE');
    }
    if (lowerName.includes('string')) {
      keywords.push('UPPER', 'LOWER', 'LENGTH', 'concatenation');
    }
    if (lowerName.includes('date')) {
      keywords.push('date', 'strftime', 'timestamp');
    }
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}
