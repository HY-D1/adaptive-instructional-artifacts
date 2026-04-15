// Core data models for the adaptive SQL learning system

export type LearningInterfaceMode = 'student' | 'instructor';

// Week 4: Role-based access control
export type UserRole = 'student' | 'instructor';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  createdAt: number;
}
export type HelpEventType = 'hint_view' | 'explanation_view';
export type ConceptViewSource = 'problem' | 'hint' | 'textbook';

// Week 3 D8: Guidance Ladder event types for replay reconstruction
export type GuidanceRequestType = 'hint' | 'explanation' | 'textbook';
export type RungLevel = 1 | 2 | 3;
export type GuidanceEscalationTrigger = 
  | 'learner_request' 
  | 'rung_exhausted' 
  | 'repeated_error' 
  | 'time_stuck' 
  | 'hint_reopened' 
  | 'auto_escalation_eligible';
export type TextbookUnitAction = 'created' | 'updated';
export type TextbookUnitStatus = 'primary' | 'alternative' | 'archived';

export type LLMProvider = 'ollama' | 'groq';

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
    | 'coverage_change'
    // Week 3 D8: Guidance Ladder events for replay reconstruction
    | 'guidance_request'
    | 'guidance_view'
    | 'guidance_escalate'
    | 'textbook_unit_upsert'
    | 'concept_view'
    | 'session_end'
    | 'textbook_unit_shown'
    | 'source_view'
    // Week 3 Feature: Ask My Textbook chat
    | 'chat_interaction'
    // Background concept extraction
    | 'concept_extraction'
    // Week 5: Escalation Profiles (Component 7)
    | 'profile_assigned'
    | 'escalation_triggered'
    | 'profile_adjusted'
    // Week 6: Experimental condition tracking
    | 'condition_assigned'
    // Week 5: Multi-Armed Bandit (Component 8)
    | 'bandit_arm_selected'
    | 'bandit_reward_observed'
    | 'bandit_updated'
    // Week 5: HDI - Hint Dependency Index (Component 9)
    | 'hdi_calculated'
    | 'hdi_trajectory_updated'
    | 'dependency_intervention_triggered'
    // Component 10: Knowledge Consolidation (Reinforcement)
    | 'reinforcement_scheduled'
    | 'reinforcement_prompt_shown'
    | 'reinforcement_response'
    // WS12: Hint helpfulness feedback (HintWise UX refinement)
    | 'hint_helpfulness_rating'
    // Knowledge-Structure Adaptive Features
    | 'prerequisite_violation_detected'
    | 'mastery_updated'
    | 'reflection_quality_assessed'
    | 'learning_path_recommended';
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
  problemSetId?: string;
  problemNumber?: number;
  executionTimeMs?: number;
  retrievedSourceIds?: string[];
  retrievedChunks?: RetrievedChunkInfo[];
  triggerInteractionIds?: string[];
  evidenceInteractionIds?: string[];
  sourceInteractionIds?: string[];
  inputs?: Record<string, string | number | boolean | null>;
  outputs?: Record<string, string | number | boolean | null | string[]>;
  conceptIds?: string[];
  conceptId?: string;
  source?: ConceptViewSource;
  totalTime?: number;
  problemsAttempted?: number;
  problemsSolved?: number;
  // Week 3 D8: Guidance Ladder event metadata fields
  // guidance_request fields
  requestType?: GuidanceRequestType;
  currentRung?: RungLevel;
  // guidance_view fields
  rung?: RungLevel;
  grounded?: boolean;
  contentLength?: number;
  // guidance_escalate fields
  fromRung?: RungLevel;
  toRung?: RungLevel;
  trigger?: GuidanceEscalationTrigger;
  // evidence is stored in inputs/outputs
  // textbook_unit_upsert fields
  unitId?: string;
  action?: TextbookUnitAction;
  dedupeKey?: string;
  revisionCount?: number;
  // source_view fields
  passageCount?: number;
  expanded?: boolean;
  // chat_interaction fields (Week 3 Feature: Ask My Textbook)
  chatMessage?: string;
  chatResponse?: string;
  chatQuickChip?: string;
  savedToNotes?: boolean;
  textbookUnitsRetrieved?: string[]; // IDs of units used for grounding
  // Week 5: Escalation Profiles (Component 7)
  profileId?: string;
  assignmentStrategy?: 'static' | 'diagnostic' | 'bandit';
  previousThresholds?: { escalate: number; aggregate: number };
  newThresholds?: { escalate: number; aggregate: number };
  // Week 5: Multi-Armed Bandit (Component 8)
  selectedArm?: string;
  selectionMethod?: 'thompson_sampling' | 'epsilon_greedy';
  armStatsAtSelection?: Record<string, { mean: number; pulls: number }>;
  reward?: {
    total: number;
    components: {
      independentSuccess: number;
      errorReduction: number;
      delayedRetention: number;
      dependencyPenalty: number;
      timeEfficiency: number;
    };
  };
  newAlpha?: number;
  newBeta?: number;
  // Week 5: HDI - Hint Dependency Index (Component 9)
  hdi?: number;
  hdiLevel?: 'low' | 'medium' | 'high';
  hdiComponents?: {
    hpa: number;
    aed: number;
    er: number;
    reae: number;
    iwh: number;
  };
  trend?: 'increasing' | 'stable' | 'decreasing';
  slope?: number;
  interventionType?: 'forced_independent' | 'profile_switch' | 'reflective_prompt';
  // Component 10: Knowledge Consolidation
  scheduleId?: string;
  promptId?: string;
  promptType?: 'mcq' | 'sql_completion' | 'concept_explanation';
  response?: string;
  isCorrect?: boolean;
  scheduledTime?: number;
  shownTime?: number;
  // Delayed reinforcement outcome fields (Week 6 experiment pipeline)
  /** Whether the learner answered the reinforcement prompt correctly */
  reinforcementCorrect?: boolean;
  /** Response latency in milliseconds */
  reinforcementLatencyMs?: number;
  /** Source unit ID that triggered this reinforcement prompt */
  sourceUnitId?: string;
  /** Source concept ID (corpus-stable) for the reinforced unit */
  sourceConceptId?: string;
  /** Delay bucket: immediate (same session), 3d, 7d, or 14d */
  delayBucket?: 'immediate' | '3d' | '7d' | '14d' | '21d';
  
  // Week 6: Experimental condition tracking
  conditionId?: string;
  // Stable corpus concept key from helper-export (e.g. "dbms-ramakrishnan-3rd-edition/joins")
  corpusConceptId?: string;
  // RESEARCH-4: Canonical study-facing fields (explicit names for analysis)
  // These mirror existing internal fields but use the names required by the study plan.
  learnerProfileId?: string;        // canonical: assigned escalation profile (mirrors profileId)
  escalationTriggerReason?: string; // canonical: why escalation fired (e.g. 'threshold_met')
  errorCountAtEscalation?: number;  // canonical: error count at moment of escalation
  timeToEscalation?: number;        // canonical: ms from first problem interaction to escalation event
  strategyAssigned?: string;        // canonical: instructional policy/arm assigned (e.g. 'conservative')
  strategyUpdated?: string;         // canonical: arm/strategy updated after reward observation
  rewardValue?: number;             // canonical: total reward signal 0–1 (mirrors reward.total)
  // Additional metadata for logging/debugging
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  // LLM telemetry metadata (Workstream 5)
  llmProvider?: 'ollama' | 'groq';
  llmModel?: string;
  llmPurpose?: string;
  llmLatencyMs?: number;
  llmInputTokens?: number;
  llmOutputTokens?: number;
  llmReasoningEffort?: 'low' | 'medium' | 'high';
  llmFallbackReason?: string;
  llmCacheHit?: boolean;
  // WS12: Hint helpfulness feedback fields
  hintIndex?: number;
  helpfulnessRating?: 'helpful' | 'not_helpful';
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
  solvedProblemIds: Set<string>; // Problem IDs that the learner has successfully solved
  interactionCount: number;
  currentStrategy: 'hint-only' | 'adaptive-low' | 'adaptive-medium' | 'adaptive-high';
  preferences: {
    escalationThreshold: number; // Number of failed attempts before escalation
    aggregationDelay: number; // Time before aggregating into textbook
  };
  createdAt?: number;
  lastActive?: number;
};

export type CoverageStats = {
  totalConcepts: number;
  coveredCount: number;
  coveragePercentage: number;
  byConfidence: Record<'low' | 'medium' | 'high', number>;
  averageScore: number;
  // Enhanced coverage metrics
  scoreDistribution: {
    '0-25': number;
    '26-50': number;
    '51-75': number;
    '76-100': number;
  };
  totalEvidenceCount: number;
  evidenceBreakdown: {
    successfulExecution: number;
    notesAdded: number;
    explanationViewed: number;
    hintViewed: number;
    errorEncountered: number;
  };
};

export type LLMGenerationParams = {
  temperature: number;
  top_p: number;
  stream: boolean;
  timeoutMs: number;
  max_tokens?: number;
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
  // Provider/model information (Workstream 11)
  provider: 'ollama' | 'groq';
  model: string;
  generationMode?: 'cheap_mode' | 'quality_mode';
  sourceMix: string[];
  fallbackReason?: string;

  // Original fields
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
  fallbackReasonLegacy?: 'none' | 'replay_mode' | 'parse_failure' | 'llm_error';
};

export type InstructionalUnit = {
  id: string;
  sessionId?: string;
  problemId?: string;
  updatedSessionIds?: string[];
  type: 'hint' | 'explanation' | 'example' | 'summary';
  /** Primary concept ID - the main concept this unit addresses */
  conceptId: string;
  /** Related concept IDs - additional concepts connected to this unit (e.g., for cross-concept notes) */
  conceptIds?: string[];
  title: string;
  content: string;
  /** Format of content: 'markdown' (canonical) or 'html' (legacy). Defaults to 'markdown' if not set. */
  contentFormat?: 'markdown' | 'html';
  prerequisites: string[];
  addedTimestamp: number;
  updatedTimestamp?: number; // Set when the unit is updated (preserves original creation time)
  sourceInteractionIds: string[]; // IDs of interactions that triggered this
  /**
   * @deprecated Use sourceInteractionIds instead. Kept for backward compatibility with legacy data.
   * This field may be removed in a future version.
   */
  sourceInteractions?: string[];
  provenance?: UnitProvenance;
  lastErrorSubtypeId?: string;
  // Week 3 D6: Enhanced unit schema fields
  summary?: string; // Brief overview (for rung 3 reflective notes)
  commonMistakes?: string[]; // List of typical errors
  minimalExample?: string; // Minimal SQL example
  sourceRefIds?: string[]; // Cited source references (doc:chunk:page format)
  createdFromInteractionIds?: string[]; // Provenance: which interactions created this
  revisionCount?: number; // How many times this unit has been updated
  updateHistory?: Array<{
    timestamp: number;
    reason: string;
    addedInteractionIds: string[];
  }>; // History of updates with reasons
  // Quality score for "best explanation" selection (0-1 scale)
  qualityScore?: number;
  // Usage metrics for quality calculation
  retrievalCount?: number; // How many times this unit was retrieved
  // Week 3 Feature: Explanation Competition/Selection System
  status?: TextbookUnitStatus; // 'primary' = best explanation, 'alternative' = similar quality, 'archived' = superseded
  archivedReason?: 'superseded' | 'user_deleted' | 'quality_threshold'; // Why archived
  archivedAt?: number; // Timestamp when archived
  archivedByUnitId?: string; // ID of unit that superseded this one
  // Proactive unit creation flag
  autoCreated?: boolean; // True if unit was automatically created by trace analyzer
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

// Uploaded PDF file metadata for persistence
export type UploadedPdfFile = {
  docId: string;
  filename: string;
  pageCount: number;
  uploadedAt: number;
  chunkCount: number;
};

export type UploadedPdfList = {
  files: UploadedPdfFile[];
  lastUpdated: number;
};

export type RemoteCorpusDocument = {
  docId: string;
  title: string;
  filename: string;
  sha256: string;
  pageCount: number;
  parserBackend: string;
  pipelineVersion: string;
  runId: string | null;
  unitCount: number;
  chunkCount: number;
  createdAt: string;
};

export type RemoteCorpusUnit = {
  unitId: string;
  docId: string;
  conceptId: string | null;
  title: string;
  summary: string;
  contentMarkdown: string;
  difficulty: string | null;
  pageStart: number;
  pageEnd: number;
  runId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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
  templateId?: string;
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
export type ConceptRegistrySourceRef = {
  docId: string;
  chunkId: string;
  page: number;
  passageId?: string;
};

export type ConceptRegistryEntry = {
  conceptId: string;
  title: string;
  oneLineDefinition: string;
  sourceRefs: ConceptRegistrySourceRef[];
  tags: string[];
  status: 'verified' | 'unverified';
};

export type ConceptRegistry = {
  schemaVersion: string;
  lastUpdated: string;
  totalConcepts: number;
  verifiedCount: number;
  unverifiedCount: number;
  concepts: ConceptRegistryEntry[];
};

// Week 3 D3: Alignment Map types
export type AlignmentMapEntry = {
  sqlEngageSubtype: string;
  frequencyRank: number;
  frequencyCount: number;
  textbookConceptIds: string[];
  confidence: 'high' | 'medium' | 'low';
  status: 'verified' | 'unverified';
  notes: string;
  excludedFromAutoEscalation: boolean;
};

export type AlignmentMapSummary = {
  top15Coverage: string;
  autoEscalationEligible: number;
  autoEscalationExcluded: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
};

export type AlignmentMap = {
  schemaVersion: string;
  lastUpdated: string;
  description: string;
  totalMappings: number;
  verifiedMappings: number;
  unverifiedMappings: number;
  mappings: AlignmentMapEntry[];
  summary: AlignmentMapSummary;
};

// Trace Analyzer types for continuous background concept extraction

// Event-driven analysis types
export type InteractionEventType = InteractionEvent['eventType'];

export type EventSubscriptionCallback = (event: InteractionEvent) => void;

export type EventSubscription = {
  id: string;
  eventTypes: InteractionEventType[];
  callback: EventSubscriptionCallback;
};

export type AnalysisTriggerReason = 
  | 'error_cluster' 
  | 'help_request' 
  | 'breakthrough' 
  | 'scheduled' 
  | 'manual';

export type ImmediateAnalysisOptions = {
  reason: AnalysisTriggerReason;
  debounceMs?: number;
  force?: boolean;
  metadata?: Record<string, unknown>;
};

export type PatternType = 'error_subtype' | 'concept_struggle' | 'success_streak';

export type PatternMatch = {
  type: PatternType;
  key: string; // e.g., error subtype name
  frequency: number;
  confidence: 'high' | 'medium' | 'low';
  interactions: string[]; // IDs of matching interactions
  conceptIds: string[];
  firstSeen: number;
  lastSeen: number;
};

export type ConceptGap = {
  conceptId: string;
  relatedSubtypes: string[];
  interactionCount: number;
  interactionIds: string[];
  priority: 'high' | 'medium' | 'low';
};

export type UnitRecommendation = {
  id: string;
  type: 'pattern_based' | 'concept_gap' | 'mastery_reinforcement';
  conceptIds: string[];
  priority: 'high' | 'medium' | 'low';
  reason: string;
  sourcePattern?: PatternMatch;
  sourceGap?: ConceptGap;
  suggestedTemplate: 'explanation.v1' | 'notebook_unit.v1';
  estimatedImpact: number;
};

export type AnalysisResult = {
  timestamp: number;
  learnerId?: string;
  patterns: PatternMatch[];
  conceptGaps: ConceptGap[];
  recommendations: UnitRecommendation[];
  summary: {
    totalInteractionsAnalyzed: number;
    errorCount: number;
    uniqueErrorSubtypes: number;
    patternsDetected: number;
    conceptGapsFound: number;
    recommendationsGenerated: number;
    highPriorityRecommendations: number;
  };
  // Proactive unit creation results (populated when auto-creation is enabled)
  autoCreation?: AutoCreationResult;
};

// Result of proactive unit creation from trace analysis
export type AutoCreationResult = {
  unitsCreated: AutoCreatedUnitInfo[];
  unitsUpdated: AutoCreatedUnitInfo[];
  skipped: AutoCreationSkipInfo[];
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
};

// Information about an auto-created unit
export type AutoCreatedUnitInfo = {
  unitId: string;
  conceptId: string;
  title: string;
  reason: string;
  qualityScore: number;
  timestamp: number;
};

// Information about why a unit creation was skipped
export type AutoCreationSkipInfo = {
  conceptId: string;
  reason: 'existing_unit' | 'quality_threshold_not_met' | 'generation_failed' | 'pattern_not_strong';
  details: string;
};

// Week 5: Escalation Profile Types (Component 7)
export type ProfileId = 'fast-escalator' | 'slow-escalator' | 'adaptive-escalator';

// Week 5: HDI Level classification (Component 9)
export type HDILevel = 'low' | 'medium' | 'high';

// Week 5: HDI Trend direction (Component 9)
export type HDITrend = 'increasing' | 'stable' | 'decreasing';

// Week 5: HDI Component metrics (Component 9)
export interface HDIComponents {
  hpa: number;  // Hints Per Attempt
  aed: number;  // Average Escalation Depth
  er: number;   // Explanation Rate
  reae: number; // Repeated Error After Explanation
  iwh: number;  // Improvement Without Hint
}

// Week 6: Session Configuration for Experimental Control
export interface SessionConfig {
  sessionId: string;
  learnerId: string;

  // Experimental toggles
  textbookDisabled: boolean;
  adaptiveLadderDisabled: boolean;
  immediateExplanationMode: boolean;
  staticHintMode: boolean;

  // Policy assignment
  escalationPolicy: 'aggressive' | 'conservative' | 'explanation_first' | 'adaptive' | 'no_hints';

  // Randomization
  conditionId: string; // For A/B test group assignment

  // LLM Generation mode (Workstream 8)
  generationMode?: 'cheap_mode' | 'quality_mode';

  createdAt: number;
}

// Component 10: Knowledge Consolidation Types
export interface ReinforcementSchedule {
  id: string;
  unitId: string;
  learnerId: string;
  conceptId: string;
  createdAt: number;
  scheduledPrompts: ScheduledPrompt[];
}

export interface ScheduledPrompt {
  id: string;
  delayDays: number;
  promptType: 'mcq' | 'sql_completion' | 'concept_explanation';
  status: 'pending' | 'shown' | 'completed' | 'dismissed';
  scheduledTime: number;
  shownTime?: number;
  completedTime?: number;
}
