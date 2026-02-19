import { SQLProblem, InteractionEvent, PdfIndexProvenance } from '../types';
import {
  canonicalizeSqlEngageSubtype,
  getConceptById,
  getConceptIdsForSqlEngageSubtype,
  getDeterministicSqlEngageAnchor,
  getProgressiveSqlEngageHintText,
  getSqlEngageRowsBySubtype
} from '../data/sql-engage';
import {
  getConceptFromRegistry
} from '../data';
import { getActivePdfIndexProvenance, retrievePdfChunks } from './pdf-retrieval';

/**
 * History entry for a retrieved hint
 */
export type RetrievalHintHistory = {
  /** Hint level (1-3) */
  hintLevel: 1 | 2 | 3;
  /** Hint text content */
  hintText: string;
  /** ID of source interaction */
  interactionId: string;
  /** Index in help request sequence */
  helpRequestIndex?: number;
  /** Source identifier */
  sourceId?: string;
};

/**
 * SQL-Engage anchor data for retrieval
 */
export type RetrievalSqlEngageAnchor = {
  /** Row identifier */
  rowId: string;
  /** Error subtype */
  error_subtype: string;
  /** Target of feedback */
  feedback_target: string;
  /** Learning outcome description */
  intended_learning_outcome: string;
};

/**
 * PDF passage retrieved for context
 */
export type RetrievalPdfPassage = {
  /** Chunk identifier */
  chunkId: string;
  /** Document identifier */
  docId: string;
  /** Page number */
  page: number;
  /** Passage text */
  text: string;
  /** Relevance score */
  score: number;
};

// Week 3 D2: Source passages from Concept Registry
/**
 * Source passage from concept registry
 */
export type RetrievalSourcePassage = {
  /** Passage identifier */
  passageId: string;
  /** Associated concept ID */
  conceptId: string;
  /** Document identifier */
  docId: string;
  /** Chunk identifier */
  chunkId: string;
  /** Page number */
  page: number;
  /** Passage text */
  text: string;
  /** Reason for inclusion */
  whyIncluded: string;
};

// Week 3 D2: Why sources were retrieved
/**
 * Explanation of why sources were retrieved
 */
export type WhyRetrieved = {
  /** Trigger reason for retrieval */
  trigger: 'error_subtype_match' | 'concept_mapping' | 'learner_request' | 'escalation';
  /** Error subtype that triggered retrieval */
  errorSubtypeId?: string;
  /** Concept IDs used for retrieval */
  conceptIds: string[];
  /** Evidence from interaction trace */
  traceEvidence: {
    errorCount: number;
    retryCount: number;
    hintCount: number;
    timeSpentMs: number;
    lastInteractionTypes: string[];
  };
};

/**
 * Complete retrieval bundle with all context for LLM generation
 */
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
  // Week 3 D2: Source grounding fields
  sourcePassages: RetrievalSourcePassage[];
  whyRetrieved: WhyRetrieved;
  conceptSourceRefs: Array<{
    conceptId: string;
    sourceRefIds: string[];
  }>;
};

/**
 * Build a retrieval bundle for LLM generation
 * Gathers context from problem, interactions, PDF index, and SQL-Engage
 * @param options - Bundle construction options
 * @returns Complete retrieval bundle
 */
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

  // Week 3 D2: Build whyRetrieved with trace evidence
  const lastInteractionTypes = problemInteractions
    .slice(-5)
    .map((i) => i.eventType);
  
  const whyRetrieved: WhyRetrieved = {
    trigger: determineRetrievalTrigger(errors, hintCount, normalizedSubtype, lastInteractionTypes),
    errorSubtypeId: normalizedSubtype,
    conceptIds,
    traceEvidence: {
      errorCount: errors,
      retryCount: Math.max(0, errors - 1),
      hintCount,
      timeSpentMs: timeSpent,
      lastInteractionTypes
    }
  };

  // Week 3 D2: Build conceptSourceRefs from concept registry
  const conceptSourceRefs = conceptIds.map((conceptId) => {
    const registryConcept = getConceptFromRegistry(conceptId);
    const sourceRefIds = registryConcept?.sourceRefs.map(
      (ref) => `${ref.docId}:${ref.chunkId}:${ref.passageId || ref.page}`
    ) ?? [];
    return {
      conceptId,
      sourceRefIds
    };
  });

  // Week 3 D2: Build sourcePassages from concept registry (placeholder for actual text retrieval)
  // In a full implementation, this would fetch actual passage text from the PDF/textbook
  const sourcePassages: RetrievalSourcePassage[] = [];
  for (const conceptId of conceptIds) {
    const registryConcept = getConceptFromRegistry(conceptId);
    if (registryConcept?.sourceRefs) {
      for (const ref of registryConcept.sourceRefs.slice(0, 2)) { // Top 2 refs per concept
        sourcePassages.push({
          passageId: ref.passageId || `${ref.chunkId}-p${ref.page}`,
          conceptId,
          docId: ref.docId,
          chunkId: ref.chunkId,
          page: ref.page,
          text: `[Source: ${ref.docId}, Page ${ref.page}]`, // Placeholder - actual text would come from PDF/chunk store
          whyIncluded: `Concept registry source for ${conceptId}`
        });
      }
    }
  }

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
    retrievedSourceIds: Array.from(new Set([
      ...retrievedSourceIds,
      ...conceptSourceRefs.flatMap((csr) => csr.sourceRefIds)
    ])),
    triggerInteractionIds,
    pdfPassages,
    pdfIndexProvenance,
    // Week 3 D2: New source grounding fields
    sourcePassages,
    whyRetrieved,
    conceptSourceRefs
  };
}

// Week 3 D2: Determine why sources were retrieved
function determineRetrievalTrigger(
  errors: number,
  hintCount: number,
  errorSubtypeId: string,
  lastInteractionTypes: string[]
): WhyRetrieved['trigger'] {
  const lastType = lastInteractionTypes[lastInteractionTypes.length - 1];
  
  if (lastType === 'hint_request' || lastType === 'explanation_view') {
    return 'learner_request';
  }
  if (hintCount >= 3) {
    return 'escalation';
  }
  if (errors > 0 && errorSubtypeId && errorSubtypeId !== 'incomplete query') {
    return 'error_subtype_match';
  }
  return 'concept_mapping';
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

  // Guard against empty query
  if (!query) {
    return [];
  }

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
