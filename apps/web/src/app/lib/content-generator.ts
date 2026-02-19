import {
  InstructionalUnit,
  LLMCacheRecord,
  LLMGenerationParams,
  SQLProblem,
  InteractionEvent,
  PdfCitation
} from '../types';
import { createInputHash, stableStringify } from './hash';
import { generateWithOllama, OLLAMA_MODEL } from './llm-client';
import { buildRetrievalBundle, RetrievalBundle } from './retrieval-bundle';
import { renderPrompt, TemplateId } from '../prompts/templates';
import { storage } from './storage';
import { calculateQualityScore } from './textbook-units';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Options for generating an instructional unit from LLM
 */
export type GenerateUnitOptions = {
  /** Learner identifier */
  learnerId: string;
  /** Optional session ID */
  sessionId?: string;
  /** Template ID for prompt selection */
  templateId: TemplateId;
  /** Retrieval bundle with context */
  bundle: RetrievalBundle;
  /** IDs of interactions that triggered this generation */
  triggerInteractionIds: string[];
  /** LLM model to use */
  model?: string;
  /** Generation parameters */
  params?: Partial<LLMGenerationParams>;
};

/**
 * Result of generating an instructional unit
 */
export type GenerateUnitResult = {
  /** Generated instructional unit */
  unit: InstructionalUnit;
  /** Hash of input for caching */
  inputHash: string;
  /** Cache key used */
  cacheKey: string;
  /** Whether result came from cache */
  fromCache: boolean;
  /** Whether fallback content was used */
  usedFallback: boolean;
  /** Reason for using fallback */
  fallbackReason: FallbackReason;
  /** Model used for generation */
  model: string;
  /** Parameters used */
  params: LLMGenerationParams;
  /** Parsing telemetry */
  parseTelemetry: TemplateParseTelemetry;
  /** Generation time in milliseconds */
  generationTimeMs?: number;
};

type StructuredTemplateOutput = {
  title: string;
  content_markdown: string;
  key_points: string[];
  common_pitfall?: string;
  next_steps: string[];
  source_ids: string[];
};

type ParseMode = 'strict-json' | 'code-fence-json' | 'brace-extract' | 'json-repair';

export type TemplateParseTelemetry = {
  status: 'success' | 'failure' | 'not_attempted';
  mode?: ParseMode;
  attempts: number;
  rawLength: number;
  failureReason?: string;
  // Additional LLM telemetry fields
  tokensUsed?: number;
  generationTimeMs?: number;
  cacheHit?: boolean;
  retrievalMetrics?: {
    pdfChunksRetrieved: number;
    sqlEngageRowsUsed: number;
    hintHistoryCount: number;
  };
};

type TemplateParseResult = {
  output: StructuredTemplateOutput | null;
  telemetry: TemplateParseTelemetry;
};

type ParseAttempt = {
  mode: Exclude<ParseMode, 'json-repair'>;
  candidate: string;
};

type ParseValidationResult =
  | { ok: true; output: StructuredTemplateOutput }
  | { ok: false; reason: string };

export type FallbackReason = 'none' | 'replay_mode' | 'parse_failure' | 'llm_error';

const DEFAULT_PARAMS: LLMGenerationParams = {
  temperature: 0,
  top_p: 1,
  stream: false,
  timeoutMs: 25000
};

/**
 * Generate an instructional unit using LLM with caching
 * @param options - Generation options
 * @returns Promise resolving to generated unit and metadata
 */
export async function generateUnitFromLLM(options: GenerateUnitOptions): Promise<GenerateUnitResult> {
  const startTime = performance.now();
  const model = options.model || OLLAMA_MODEL;
  const params: LLMGenerationParams = {
    ...DEFAULT_PARAMS,
    ...(options.params || {})
  };

  const payloadForHash = {
    templateId: options.templateId,
    model,
    params,
    bundle: {
      learnerId: options.bundle.learnerId,
      problemId: options.bundle.problemId,
      problemTitle: options.bundle.problemTitle,
      schemaText: options.bundle.schemaText,
      lastErrorSubtypeId: options.bundle.lastErrorSubtypeId,
      hintHistory: options.bundle.hintHistory.map((hint) => ({
        hintLevel: hint.hintLevel,
        hintText: hint.hintText
      })),
      sqlEngageAnchor: options.bundle.sqlEngageAnchor,
      conceptCandidates: options.bundle.conceptCandidates,
      recentInteractionsSummary: options.bundle.recentInteractionsSummary,
      pdfPassages: options.bundle.pdfPassages.map((passage) => ({
        docId: passage.docId,
        chunkId: passage.chunkId,
        page: passage.page,
        text: passage.text
      }))
    }
  };
  const inputHash = createInputHash(payloadForHash);
  const cacheKey = `${options.learnerId}::${options.templateId}::${inputHash}`;

  const cached = storage.getLLMCacheRecord(cacheKey);
  if (cached?.unit) {
    const cachedParseTelemetry = getParseTelemetryFromUnit(cached.unit);
    const cachedFallbackReason = getFallbackReasonFromUnit(cached.unit);
    const mergedIds = Array.from(new Set([
      ...(cached.unit.sourceInteractionIds || []),
      ...options.triggerInteractionIds
    ]));
    const mergedUnit = { ...cached.unit, sourceInteractionIds: mergedIds };
    // Save back the merged provenance to cache
    storage.saveLLMCacheRecord({ ...cached, unit: mergedUnit });

    // Cache hit - return cached unit

    return {
      unit: mergedUnit,
      inputHash,
      cacheKey,
      fromCache: true,
      usedFallback: cachedFallbackReason !== 'none',
      fallbackReason: cachedFallbackReason,
      model,
      params,
      parseTelemetry: {
        ...cachedParseTelemetry,
        cacheHit: true,
        generationTimeMs: Math.round(performance.now() - startTime)
      },
      generationTimeMs: Math.round(performance.now() - startTime)
    };
  }

  const prompt = renderPrompt(options.templateId, stableStringify(options.bundle));

  try {
    const response = await generateWithOllama(prompt, { model, params });
    const llmTimeMs = Math.round(performance.now() - startTime);
    const parsed = parseTemplateJson(response.text);
    
    // Build retrieval metrics for telemetry
    const retrievalMetrics = {
      pdfChunksRetrieved: options.bundle.pdfPassages.length,
      sqlEngageRowsUsed: options.bundle.sqlEngageAnchor ? 1 : 0,
      hintHistoryCount: options.bundle.hintHistory.length
    };
    
    // Generation metrics available in parseTelemetry

    if (!parsed.output) {
      const fallbackReason: FallbackReason = 'parse_failure';
      const fallback = buildFallbackUnit(
        options,
        response.model,
        response.params,
        inputHash,
        fallbackReason,
        parsed.telemetry
      );
      saveCache({
        cacheKey,
        learnerId: options.learnerId,
        templateId: options.templateId,
        inputHash,
        unit: fallback,
        createdAt: Date.now()
      });

      return {
        unit: fallback,
        inputHash,
        cacheKey,
        fromCache: false,
        usedFallback: true,
        fallbackReason,
        model: response.model,
        params: response.params,
        parseTelemetry: parsed.telemetry
      };
    }

    const enrichedTelemetry: TemplateParseTelemetry = {
      ...parsed.telemetry,
      generationTimeMs: Math.round(performance.now() - startTime),
      cacheHit: false,
      retrievalMetrics: {
        pdfChunksRetrieved: options.bundle.pdfPassages.length,
        sqlEngageRowsUsed: options.bundle.sqlEngageAnchor ? 1 : 0,
        hintHistoryCount: options.bundle.hintHistory.length
      }
    };

    const unit = await buildUnitFromStructuredOutput(
      options,
      parsed.output,
      response.model,
      response.params,
      inputHash,
      enrichedTelemetry
    );
    saveCache({
      cacheKey,
      learnerId: options.learnerId,
      templateId: options.templateId,
      inputHash,
      unit,
      createdAt: Date.now()
    });

    return {
      unit,
      inputHash,
      cacheKey,
      fromCache: false,
      usedFallback: false,
      fallbackReason: 'none',
      model: response.model,
      params: response.params,
      parseTelemetry: enrichedTelemetry,
      generationTimeMs: Math.round(performance.now() - startTime)
    };
  } catch (error) {
    const parseTelemetry: TemplateParseTelemetry = {
      status: 'not_attempted',
      attempts: 0,
      rawLength: 0,
      failureReason: (error as Error).message || 'llm_request_failed',
      generationTimeMs: Math.round(performance.now() - startTime),
      cacheHit: false,
      retrievalMetrics: {
        pdfChunksRetrieved: options.bundle.pdfPassages.length,
        sqlEngageRowsUsed: options.bundle.sqlEngageAnchor ? 1 : 0,
        hintHistoryCount: options.bundle.hintHistory.length
      }
    };
    const fallbackReason: FallbackReason = 'llm_error';
    const fallback = buildFallbackUnit(options, model, params, inputHash, fallbackReason, parseTelemetry);
    saveCache({
      cacheKey,
      learnerId: options.learnerId,
      templateId: options.templateId,
      inputHash,
      unit: fallback,
      createdAt: Date.now()
    });

    return {
      unit: fallback,
      inputHash,
      cacheKey,
      fromCache: false,
      usedFallback: true,
      fallbackReason,
      model,
      params,
      parseTelemetry
    };
  }
}

/**
 * Build a retrieval bundle for the current problem context
 * @param options - Bundle construction options
 * @returns Retrieval bundle with all context
 */
export function buildBundleForCurrentProblem(options: {
  learnerId: string;
  problem: SQLProblem;
  interactions: InteractionEvent[];
  triggerInteractionIds?: string[];
  lastErrorSubtypeId?: string;
}) {
  return buildRetrievalBundle({
    learnerId: options.learnerId,
    problem: options.problem,
    interactions: options.interactions,
    triggerInteractionIds: options.triggerInteractionIds,
    lastErrorSubtypeId: options.lastErrorSubtypeId
  });
}

function saveCache(record: LLMCacheRecord) {
  storage.saveLLMCacheRecord(record);
}

function getParseTelemetryFromUnit(unit: InstructionalUnit): TemplateParseTelemetry {
  const provenance = unit.provenance;
  if (!provenance) {
    return {
      status: 'not_attempted',
      attempts: 0,
      rawLength: 0,
      failureReason: 'cache_record_missing_provenance'
    };
  }

  return {
    status: provenance.parserStatus || 'not_attempted',
    mode: provenance.parserMode,
    attempts: typeof provenance.parserAttempts === 'number' ? provenance.parserAttempts : 0,
    rawLength: typeof provenance.parserRawLength === 'number' ? provenance.parserRawLength : 0,
    failureReason: provenance.parserFailureReason
  };
}

function getFallbackReasonFromUnit(unit: InstructionalUnit): FallbackReason {
  const reason = unit.provenance?.fallbackReason;
  if (
    reason === 'none' ||
    reason === 'replay_mode' ||
    reason === 'parse_failure' ||
    reason === 'llm_error'
  ) {
    return reason;
  }
  return 'none';
}

function selectPdfCitations(bundle: RetrievalBundle, sourceIds: string[]): PdfCitation[] {
  const selectedSourceIds = new Set(normalizeRetrievedSourceIds(sourceIds));
  const selectedPassages = bundle.pdfPassages.filter((passage) => selectedSourceIds.has(passage.chunkId));
  const fallbackPassages = selectedPassages.length > 0 ? selectedPassages : bundle.pdfPassages;

  return Array.from(
    fallbackPassages.reduce((acc, passage) => {
      const existing = acc.get(passage.chunkId);
      if (!existing || passage.score > existing.score) {
        acc.set(passage.chunkId, {
          docId: passage.docId,
          chunkId: passage.chunkId,
          page: passage.page,
          score: passage.score
        });
      }
      return acc;
    }, new Map<string, PdfCitation>()).values()
  );
}

function normalizeRetrievedSourceIds(sourceIds: string[]): string[] {
  const unique = Array.from(
    new Set(
      sourceIds
        .map((sourceId) => sourceId?.trim())
        .filter((sourceId): sourceId is string => Boolean(sourceId))
    )
  );

  return unique.sort((a, b) => {
    const group = (value: string) => {
      if (value.startsWith('sql-engage:')) return 0;
      if (value.startsWith('pdf:') || /:p\d+:c\d+$/i.test(value)) return 1;
      return 2;
    };
    const groupDelta = group(a) - group(b);
    if (groupDelta !== 0) return groupDelta;
    // Use stable comparison with index fallback to ensure deterministic ordering
    return a === b ? 0 : a < b ? -1 : 1;
  });
}

async function buildUnitFromStructuredOutput(
  options: GenerateUnitOptions,
  output: StructuredTemplateOutput,
  model: string,
  params: LLMGenerationParams,
  inputHash: string,
  parseTelemetry: TemplateParseTelemetry
): Promise<InstructionalUnit> {
  const retrievedSet = new Set(options.bundle.retrievedSourceIds);
  const sourceIds = output.source_ids
    .filter((sourceId) => {
      const isValid = retrievedSet.has(sourceId);
      if (!isValid) {
        console.warn(`[ContentGenerator] Source ID "${sourceId}" from LLM output not found in retrieved sources. Filtered out.`);
      }
      return isValid;
    });
  const normalizedSourceIds = normalizeRetrievedSourceIds(
    sourceIds.length > 0 ? sourceIds : options.bundle.retrievedSourceIds
  );
  const retrievedPdfCitations = selectPdfCitations(options.bundle, normalizedSourceIds);

  const markdown = [
    output.content_markdown,
    '',
    '## Key Points',
    ...output.key_points.map((point) => `- ${point}`),
    '',
    '## Next Steps',
    ...output.next_steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    `Common pitfall: ${output.common_pitfall || 'Not found in provided sources.'}`
  ].join('\n');

  // Sanitize markdown content before storage to prevent XSS
  const htmlContent = await marked(markdown);
  const content = DOMPurify.sanitize(htmlContent);

  const genericTitle = `Help with ${options.bundle.problemTitle}`;
  const title = output.title?.trim() || genericTitle;

  const unit: InstructionalUnit = {
    id: `unit-${options.templateId}-${inputHash}`,
    sessionId: options.sessionId,
    updatedSessionIds: options.sessionId ? [options.sessionId] : [],
    type: options.templateId === 'explanation.v1' ? 'explanation' : 'summary',
    conceptId: options.bundle.conceptCandidates[0]?.id || 'select-basic',
    conceptIds: options.bundle.conceptCandidates.map(c => c.id),
    title,
    content,
    prerequisites: [],
    addedTimestamp: Date.now(),
    sourceInteractionIds: Array.from(new Set(options.triggerInteractionIds)),
    lastErrorSubtypeId: options.bundle.lastErrorSubtypeId,
    provenance: {
      model,
      params,
      templateId: options.templateId,
      inputHash,
      retrievedSourceIds: normalizedSourceIds,
      retrievedPdfCitations,
      createdAt: Date.now(),
      parserStatus: parseTelemetry.status,
      parserMode: parseTelemetry.mode,
      parserAttempts: parseTelemetry.attempts,
      parserRawLength: parseTelemetry.rawLength,
      parserFailureReason: parseTelemetry.failureReason,
      fallbackReason: 'none'
    },
    retrievalCount: 0
  };
  
  // Calculate and set quality score
  unit.qualityScore = calculateQualityScore(unit);
  
  return unit;
}

function buildFallbackUnit(
  options: GenerateUnitOptions,
  model: string,
  params: LLMGenerationParams,
  inputHash: string,
  fallbackReason: Exclude<FallbackReason, 'none'>,
  parseTelemetry: TemplateParseTelemetry
): InstructionalUnit {
  const anchor = options.bundle.sqlEngageAnchor;
  const concept = options.bundle.conceptCandidates[0];
  const titlePrefix = 'Help with';
  const normalizedSourceIds = normalizeRetrievedSourceIds(options.bundle.retrievedSourceIds);
  const retrievedPdfCitations = selectPdfCitations(options.bundle, normalizedSourceIds);

  const content = [
    `# ${titlePrefix} ${options.bundle.problemTitle}`,
    '',
    `Error subtype: ${options.bundle.lastErrorSubtypeId}`,
    `Concept: ${concept?.name || 'Not found in provided sources.'}`,
    '',
    '## Grounded Sources',
    `- SQL-Engage row: ${anchor?.rowId || 'Not found in provided sources.'}`,
    `- Intended learning outcome: ${anchor?.intended_learning_outcome || 'Not found in provided sources.'}`,
    `- Feedback target: ${anchor?.feedback_target || 'Not found in provided sources.'}`,
    '',
    '## Hint History',
    ...(options.bundle.hintHistory.length > 0
      ? options.bundle.hintHistory.map((hint) => `- [L${hint.hintLevel}] ${hint.hintText}`)
      : ['- Not found in provided sources.']),
    '',
    '## Next Steps',
    '1. Re-run a minimal query and validate each clause incrementally.',
    '2. Apply one fix at a time and re-check the same problem.',
    '3. If schema details are missing, use only the provided schema text.'
  ].join('\n');

  // Sanitize fallback content to prevent XSS (content is built from trusted template + user data)
  // Note: User data comes from SQL-Engage dataset (trusted source) and problem titles (internal)
  const fallbackContent = content;

  const unit: InstructionalUnit = {
    id: `unit-${options.templateId}-${inputHash}`,
    sessionId: options.sessionId,
    updatedSessionIds: options.sessionId ? [options.sessionId] : [],
    type: options.templateId === 'explanation.v1' ? 'explanation' : 'summary',
    conceptId: concept?.id || 'select-basic',
    conceptIds: options.bundle.conceptCandidates.map(c => c.id),
    title: `Help with ${options.bundle.problemTitle}`,
    content: fallbackContent,
    prerequisites: [],
    addedTimestamp: Date.now(),
    sourceInteractionIds: Array.from(new Set(options.triggerInteractionIds)),
    lastErrorSubtypeId: options.bundle.lastErrorSubtypeId,
    provenance: {
      model,
      params,
      templateId: options.templateId,
      inputHash,
      retrievedSourceIds: normalizedSourceIds,
      retrievedPdfCitations,
      createdAt: Date.now(),
      parserStatus: parseTelemetry.status,
      parserMode: parseTelemetry.mode,
      parserAttempts: parseTelemetry.attempts,
      parserRawLength: parseTelemetry.rawLength,
      parserFailureReason: parseTelemetry.failureReason,
      fallbackReason
    },
    retrievalCount: 0
  };
  
  // Calculate and set quality score
  unit.qualityScore = calculateQualityScore(unit);
  
  return unit;
}

/**
 * Parse LLM response into structured template output
 * Attempts multiple parsing strategies (strict JSON, code fence, brace extract)
 * @param raw - Raw LLM response text
 * @returns Parsed output with telemetry
 */
export function parseTemplateJson(raw: string): TemplateParseResult {
  const normalizedRaw = normalizeRawText(raw);
  if (!normalizedRaw) {
    return {
      output: null,
      telemetry: {
        status: 'failure',
        attempts: 0,
        rawLength: 0,
        failureReason: 'empty_response'
      }
    };
  }

  const attempts = collectParseAttempts(normalizedRaw);
  let attemptCount = 0;
  let failureReason = 'json_parse_failed';

  for (const attempt of attempts) {
    attemptCount += 1;
    const strictResult = tryParseStructuredOutput(attempt.candidate);
    if (strictResult.ok) {
      return {
        output: strictResult.output,
        telemetry: {
          status: 'success',
          mode: attempt.mode,
          attempts: attemptCount,
          rawLength: normalizedRaw.length
        }
      };
    }
    failureReason = strictResult.reason;

    const repairedCandidate = repairLikelyJson(attempt.candidate);
    if (repairedCandidate !== attempt.candidate) {
      attemptCount += 1;
      const repairedResult = tryParseStructuredOutput(repairedCandidate);
      if (repairedResult.ok) {
        return {
          output: repairedResult.output,
          telemetry: {
            status: 'success',
            mode: 'json-repair',
            attempts: attemptCount,
            rawLength: normalizedRaw.length
          }
        };
      }
      failureReason = repairedResult.reason;
    }
  }

  return {
    output: null,
    telemetry: {
      status: 'failure',
      attempts: attemptCount,
      rawLength: normalizedRaw.length,
      failureReason
    }
  };
}

function collectParseAttempts(raw: string): ParseAttempt[] {
  const attempts: ParseAttempt[] = [];
  const seen = new Set<string>();

  const pushAttempt = (mode: ParseAttempt['mode'], candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    attempts.push({ mode, candidate: trimmed });
  };

  pushAttempt('strict-json', raw);
  extractCodeFenceCandidates(raw).forEach((candidate) => pushAttempt('code-fence-json', candidate));
  extractBalancedObjectCandidates(raw).forEach((candidate) => pushAttempt('brace-extract', candidate));

  return attempts;
}

function extractCodeFenceCandidates(raw: string): string[] {
  const matches: string[] = [];
  const regex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null = regex.exec(raw);
  while (match) {
    matches.push(match[1]);
    match = regex.exec(raw);
  }
  return matches;
}

function extractBalancedObjectCandidates(raw: string): string[] {
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (ch === '}') {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(raw.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function repairLikelyJson(candidate: string): string {
  return candidate
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, '\'')
    .replace(/,\s*([}\]])/g, '$1');
}

function tryParseStructuredOutput(candidate: string): ParseValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  const root = extractPrimaryObject(parsed);
  if (!root) {
    return { ok: false, reason: 'non_object_payload' };
  }

  const title = normalizeString(readFirstValue(root, ['title', 'heading']));
  const content_markdown = normalizeString(
    readFirstValue(root, ['content_markdown', 'contentMarkdown', 'content'])
  );
  const key_points = recoverArrayField(
    normalizeStringArray(readFirstValue(root, ['key_points', 'keyPoints', 'keypoints'])),
    content_markdown,
    'key_points'
  );
  const next_steps = recoverArrayField(
    normalizeStringArray(readFirstValue(root, ['next_steps', 'nextSteps', 'nextsteps'])),
    content_markdown,
    'next_steps'
  );
  const source_ids = normalizeStringArray(
    readFirstValue(root, ['source_ids', 'sourceIds', 'sources', 'source_id'])
  );
  const common_pitfall = normalizeString(
    readFirstValue(root, ['common_pitfall', 'commonPitfall', 'pitfall'])
  );

  if (!title || !content_markdown || key_points.length === 0 || next_steps.length === 0) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  return {
    ok: true,
    output: {
      title,
      content_markdown,
      key_points,
      common_pitfall,
      next_steps,
      source_ids
    }
  };
}

function recoverArrayField(
  items: string[],
  contentMarkdown: string,
  field: 'key_points' | 'next_steps'
): string[] {
  if (items.length > 0) {
    return items;
  }

  const fromContent = extractListItemsFromMarkdown(contentMarkdown);
  if (fromContent.length > 0) {
    return fromContent.slice(0, 3);
  }

  if (field === 'key_points') {
    return ['Not found in provided sources.'];
  }

  return ['Re-run the query after applying one focused fix.'];
}

function extractListItemsFromMarkdown(markdown: string): string[] {
  if (!markdown) return [];

  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter((line) => line.length > 0)
    .filter((line) => line.length <= 180);
}

function extractPrimaryObject(parsed: unknown): Record<string, unknown> | null {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const objectCandidate = parsed as Record<string, unknown>;
    const nested = readFirstValue(objectCandidate, ['output', 'result', 'data']);
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
    return objectCandidate;
  }

  if (Array.isArray(parsed) && parsed.length === 1) {
    const first = parsed[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return first as Record<string, unknown>;
    }
  }

  return null;
}

function readFirstValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) {
      return source[key];
    }
  }
  return undefined;
}

function normalizeRawText(raw: string): string {
  return raw.replace(/^\uFEFF/, '').trim();
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter(Boolean);
  }
  if (typeof value !== 'string') return [];

  return value
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').replace(/^\s*\d+\.\s*/, '').trim())
    .filter(Boolean);
}
