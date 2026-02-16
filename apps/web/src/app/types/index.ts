// Core data models for the adaptive SQL learning system

export type LearningInterfaceMode = 'student' | 'instructor';
export type HelpEventType = 'hint_view' | 'explanation_view';

export type ConceptNode = {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  examples: string[];
};

export type ErrorSubtype = {
  id: string;
  pattern: RegExp;
  conceptIds: string[];
  severity: 'low' | 'medium' | 'high';
  description: string;
};

export type HintTemplate = {
  id: string;
  conceptId: string;
  errorSubtypeId: string;
  hintLevel: 1 | 2 | 3; // Progressive hint levels
  content: string;
  nextAction: 'stay' | 'escalate' | 'aggregate';
};

export type RetrievedChunkInfo = {
  docId: string;
  page?: number;
  chunkId?: string;
  score?: number;
  snippet?: string;
};

export type InteractionEvent = {
  id: string;
  sessionId?: string;
  learnerId: string;
  timestamp: number;
  eventType:
    | 'code_change'
    | 'execution'
    | 'error'
    | 'hint_request'
    | HelpEventType
    | 'llm_generate'
    | 'pdf_index_rebuilt'
    | 'pdf_index_uploaded'
    | 'textbook_add'
    | 'textbook_update'
    | 'coverage_change';
  problemId: string;
  code?: string;
  error?: string;
  errorSubtypeId?: string;
  hintId?: string;
  explanationId?: string;
  hintText?: string;
  hintLevel?: 1 | 2 | 3;
  helpRequestIndex?: number;
  sqlEngageSubtype?: string;
  sqlEngageRowId?: string;
  policyVersion?: string;
  timeSpent?: number;
  successful?: boolean;
  ruleFired?: string;
  templateId?: string;
  inputHash?: string;
  model?: string;
  noteId?: string;
  noteTitle?: string;
  noteContent?: string;
  retrievedSourceIds?: string[];
  retrievedChunks?: RetrievedChunkInfo[];
  triggerInteractionIds?: string[];
  evidenceInteractionIds?: string[];
  inputs?: Record<string, string | number | boolean | null>;
  outputs?: Record<string, string | number | boolean | null>;
  conceptIds?: string[];
};

export type ConceptCoverageEvidence = {
  conceptId: string;
  score: number; // 0-100 cumulative score
  confidence: 'low' | 'medium' | 'high'; // based on evidence quality and quantity
  lastUpdated: number;
  evidenceCounts: {
    successfulExecution: number;
    hintViewed: number;
    explanationViewed: number;
    errorEncountered: number;
    notesAdded: number;
  };
  streakCorrect: number; // consecutive successful executions
  streakIncorrect: number; // consecutive errors
};

export type LearnerProfile = {
  id: string;
  name: string;
  conceptsCovered: Set<string>;
  conceptCoverageEvidence: Map<string, ConceptCoverageEvidence>; // conceptId -> evidence
  errorHistory: Map<string, number>; // errorSubtypeId -> count
  interactionCount: number;
  currentStrategy: 'hint-only' | 'adaptive-low' | 'adaptive-medium' | 'adaptive-high';
  preferences: {
    escalationThreshold: number; // Number of failed attempts before escalation
    aggregationDelay: number; // Time before aggregating into textbook
  };
};

export type LLMGenerationParams = {
  temperature: number;
  top_p: number;
  stream: boolean;
  timeoutMs: number;
};

export type PdfCitation = {
  docId: string;
  chunkId: string;
  page: number;
  score: number;
};

export type PdfSourceDoc = {
  docId: string;
  filename: string;
  sha256: string;
  pageCount: number;
};

export type PdfIndexProvenance = {
  indexId: string;
  schemaVersion: string;
  embeddingModelId: string;
  chunkerVersion: string;
  docCount: number;
  chunkCount: number;
};

export type UnitProvenance = {
  model: string;
  params: LLMGenerationParams;
  templateId: string;
  inputHash: string;
  retrievedSourceIds: string[];
  retrievedPdfCitations?: PdfCitation[];
  createdAt: number;
  parserStatus?: 'success' | 'failure' | 'not_attempted';
  parserMode?: 'strict-json' | 'code-fence-json' | 'brace-extract' | 'json-repair';
  parserAttempts?: number;
  parserRawLength?: number;
  parserFailureReason?: string;
  fallbackReason?: 'none' | 'replay_mode' | 'parse_failure' | 'llm_error';
};

export type InstructionalUnit = {
  id: string;
  sessionId?: string;
  updatedSessionIds?: string[];
  type: 'hint' | 'explanation' | 'example' | 'summary';
  conceptId: string;
  conceptIds?: string[]; // Multi-concept support for notes
  title: string;
  content: string;
  prerequisites: string[];
  addedTimestamp: number;
  updatedTimestamp?: number; // Set when the unit is updated (preserves original creation time)
  sourceInteractionIds: string[]; // IDs of interactions that triggered this
  sourceInteractions?: string[]; // Legacy compatibility
  provenance?: UnitProvenance;
  lastErrorSubtypeId?: string;
};

export type SaveTextbookUnitResult = {
  action: 'created' | 'updated';
  unit: InstructionalUnit;
  success?: boolean;
  quotaExceeded?: boolean;
};

export type LLMCacheRecord = {
  cacheKey: string;
  learnerId: string;
  templateId: string;
  inputHash: string;
  unit: InstructionalUnit;
  createdAt: number;
};

export type PdfIndexChunk = {
  chunkId: string;
  docId: string;
  page: number;
  text: string;
  embedding?: number[];
};

export type PdfIndexDocument = {
  indexId: string;
  sourceName: string;
  createdAt: string;
  schemaVersion: string;
  chunkerVersion: string;
  embeddingModelId: string;
  sourceDocs: PdfSourceDoc[];
  docCount: number;
  chunkCount: number;
  chunks: PdfIndexChunk[];
};

export type AdaptiveDecision = {
  timestamp: number;
  learnerId: string;
  context: {
    errorCount: number;
    retryCount: number;
    timeSpent: number;
    currentHintLevel: number;
    recentErrors: string[];
  };
  decision: 'show_hint' | 'show_explanation' | 'add_to_textbook';
  ruleFired?: string;
  reasoning: string;
  instructionalUnitId?: string;
};

export type NextHintSelection = {
  hintText: string;
  sqlEngageSubtype: string;
  sqlEngageRowId: string;
  hintLevel: 1 | 2 | 3;
  policyVersion: string;
  shouldEscalate: boolean;
};

export type SQLProblem = {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  concepts: string[];
  schema: string; // SQL schema for the problem
  expectedQuery: string;
  expectedResult?: any[];
  gradingMode?: 'result' | 'exec-only';
  hints?: string[];
};

export type ExperimentCondition = {
  id: string;
  name: string;
  strategy: 'hint-only' | 'adaptive-low' | 'adaptive-medium' | 'adaptive-high';
  description: string;
  parameters: {
    escalationThreshold?: number;
    hintDelay?: number;
    autoAggregation?: boolean;
  };
};
