/**
 * SQL-Adapt Backend API Types
 * Mirrors the frontend types for consistency
 */

// ============================================================================
// Learner Types
// ============================================================================

export type UserRole = 'student' | 'instructor';

export interface Learner {
  id: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearnerRequest {
  name: string;
  role: UserRole;
}

export interface UpdateLearnerRequest {
  name?: string;
  role?: UserRole;
}

// ============================================================================
// Learner Profile Types (Full Rich Profile)
// ============================================================================

/**
 * Learner preferences for personalization
 */
export interface LearnerPreferences {
  escalationThreshold: number;
  aggregationDelay: number;
  autoTextbookEnabled?: boolean;
  notificationsEnabled?: boolean;
  theme?: 'light' | 'dark' | 'system';
}

/**
 * Concept coverage evidence for a single concept
 * Tracks how the learner has interacted with this concept
 */
export interface ConceptCoverageEvidence {
  conceptId: string;
  score: number; // 0-100 cumulative score
  confidence: 'low' | 'medium' | 'high';
  lastUpdated: number;
  evidenceCounts: {
    successfulExecution: number;
    hintViewed: number;
    explanationViewed: number;
    errorEncountered: number;
    notesAdded: number;
  };
  streakCorrect: number;
  streakIncorrect: number;
}

/**
 * Concept coverage map - tracks which concepts learner has encountered
 */
export interface ConceptCoverage {
  concepts: string[];
  mastered: string[];
  struggling: string[];
  lastUpdated: number;
}

/**
 * Error history entry with metadata
 */
export interface ErrorHistoryEntry {
  count: number;
  lastOccurred: number;
  firstOccurred: number;
  conceptIds: string[];
}

/**
 * Full learner profile with concept coverage, evidence, and learning state
 * Stored in learner_profiles table with both structured columns and JSON extensibility
 */
export interface LearnerProfile {
  id: string;
  name: string;
  conceptsCovered: string[]; // Set serialized as array
  conceptCoverageEvidence: Record<string, ConceptCoverageEvidence>; // Map serialized as object
  errorHistory: Record<string, number>; // Map serialized as object (subtype -> count)
  interactionCount: number;
  currentStrategy: string;
  preferences: LearnerPreferences;
  createdAt: number;
  lastActive: number;
  // Extended profile data (stored in profile_data JSON column)
  extendedData?: Record<string, unknown>;
}

/**
 * Request to create/update a full learner profile
 */
export interface SaveLearnerProfileRequest {
  name?: string;
  conceptsCovered?: string[];
  conceptCoverageEvidence?: Record<string, ConceptCoverageEvidence>;
  errorHistory?: Record<string, number>;
  interactionCount?: number;
  currentStrategy?: string;
  preferences?: LearnerPreferences;
  lastActive?: number;
  extendedData?: Record<string, unknown>;
}

/**
 * Request to update profile from a single event
 */
export interface UpdateProfileFromEventRequest {
  event: CreateInteractionRequest;
}

/**
 * Profile update event - partial update for event-driven profile changes
 */
export interface ProfileUpdateEvent {
  learnerId: string;
  eventType: 'error' | 'success' | 'hint_request' | 'explanation_view' | 'notes_added';
  timestamp: number;
  problemId: string;
  conceptIds?: string[];
  errorSubtypeId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Database row for learner_profiles table
 */
export interface LearnerProfileRow {
  learner_id: string;
  profile_json: string;
  concept_coverage: string;
  concept_evidence: string;
  error_history: string;
  interaction_count: number;
  strategy: string;
  preferences: string;
  last_activity_at: string | null;
  profile_data: string;
  updated_at: string;
}

// ============================================================================
// Interaction/Event Types
// ============================================================================

export type EventType = 
  | 'code_change'
  | 'execution'
  | 'error'
  | 'hint_request'
  | 'hint_view'
  | 'explanation_view'
  | 'guidance_request'
  | 'guidance_view'
  | 'guidance_escalate'
  | 'textbook_unit_upsert'
  | 'concept_view'
  | 'source_view'
  | 'chat_interaction'
  | 'profile_assigned'
  | 'escalation_triggered'
  | 'profile_adjusted'
  | 'bandit_arm_selected'
  | 'bandit_reward_observed'
  | 'bandit_updated'
  | 'hdi_calculated'
  | 'hdi_trajectory_updated'
  | 'dependency_intervention_triggered';

/**
 * HDI (Hint Dependency Index) Components
 */
export interface HDIComponents {
  hpa: number;   // Hints Per Attempt
  aed: number;   // Average Escalation Depth
  er: number;    // Explanation Rate
  reae: number;  // Repeated Error After Explanation
  iwh: number;   // Improvement Without Hint
}

/**
 * Retrieved chunk info for source grounding
 */
export interface RetrievedChunkInfo {
  docId: string;
  page?: number;
  chunkId?: string;
  score?: number;
  snippet?: string;
}

/**
 * Bandit reward components
 */
export interface BanditReward {
  total: number;
  components: {
    independentSuccess: number;
    errorReduction: number;
    delayedRetention: number;
    dependencyPenalty: number;
    timeEfficiency: number;
  };
}

/**
 * Full InteractionEvent - Lossless logging for research replay
 * Mirrors the frontend InteractionEvent exactly
 */
export interface Interaction {
  id: string;
  learnerId: string;
  sectionId?: string | null;
  sessionId: string | null;
  timestamp: string;
  eventType: EventType;
  problemId: string;
  problemSetId?: string;
  problemNumber?: number;
  
  // Code/Error fields
  code?: string;
  error?: string;
  errorSubtypeId?: string;
  executionTimeMs?: number;
  
  // Hint/Explanation fields
  hintId?: string;
  explanationId?: string;
  hintText?: string;
  hintLevel?: number;
  helpRequestIndex?: number;
  sqlEngageSubtype?: string;
  sqlEngageRowId?: string;
  
  // Policy/Execution fields
  policyVersion?: string;
  timeSpent?: number;
  successful?: boolean;
  ruleFired?: string;
  templateId?: string;
  inputHash?: string;
  model?: string;
  
  // Textbook fields
  noteId?: string;
  noteTitle?: string;
  noteContent?: string;
  
  // Source/Retrieval fields
  retrievedSourceIds?: string[];
  retrievedChunks?: RetrievedChunkInfo[];
  triggerInteractionIds?: string[];
  evidenceInteractionIds?: string[];
  sourceInteractionIds?: string[];
  
  // I/O fields
  inputs?: Record<string, string | number | boolean | null>;
  outputs?: Record<string, string | number | boolean | null | string[]>;
  
  // Concept fields
  conceptId?: string;
  conceptIds?: string[];
  
  // Escalation fields (CRITICAL for replay)
  requestType?: 'hint' | 'explanation' | 'textbook';
  currentRung?: number;
  rung?: number;
  grounded?: boolean;
  contentLength?: number;
  fromRung?: number;
  toRung?: number;
  trigger?: string;
  
  // Textbook Unit fields
  unitId?: string;
  action?: 'created' | 'updated';
  dedupeKey?: string;
  revisionCount?: number;
  
  // Source view fields
  passageCount?: number;
  expanded?: boolean;
  
  // Chat fields
  chatMessage?: string;
  chatResponse?: string;
  chatQuickChip?: string;
  savedToNotes?: boolean;
  textbookUnitsRetrieved?: string[];
  
  // Escalation Profile fields (Week 5)
  profileId?: string;
  assignmentStrategy?: 'static' | 'diagnostic' | 'bandit';
  previousThresholds?: { escalate: number; aggregate: number };
  newThresholds?: { escalate: number; aggregate: number };
  
  // Bandit fields (Week 5)
  selectedArm?: string;
  selectionMethod?: 'thompson_sampling' | 'epsilon_greedy';
  armStatsAtSelection?: Record<string, { mean: number; pulls: number }>;
  reward?: BanditReward;
  newAlpha?: number;
  newBeta?: number;
  
  // HDI/CSI fields
  hdi?: number;
  hdiLevel?: 'low' | 'medium' | 'high';
  hdiComponents?: HDIComponents;
  trend?: 'increasing' | 'stable' | 'decreasing';
  slope?: number;
  interventionType?: 'forced_independent' | 'profile_switch' | 'reflective_prompt';
  
  // Reinforcement fields
  scheduleId?: string;
  promptId?: string;
  promptType?: 'mcq' | 'sql_completion' | 'concept_explanation';
  response?: string;
  isCorrect?: boolean;
  scheduledTime?: number;
  shownTime?: number;
  
  // RESEARCH-4: Canonical study-facing fields
  learnerProfileId?: string;        // canonical: assigned escalation profile (mirrors profileId)
  escalationTriggerReason?: string; // canonical: reason escalation fired
  errorCountAtEscalation?: number;  // canonical: error count at moment of escalation
  timeToEscalation?: number;        // canonical: ms from first problem interaction to escalation
  strategyAssigned?: string;        // canonical: instructional policy/arm assigned
  strategyUpdated?: string;         // canonical: arm/strategy updated after reward observation
  rewardValue?: number;             // canonical: total reward signal 0–1

  // Legacy payload for extensibility/backward compatibility
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;

  createdAt: string;
}

/**
 * CreateInteractionRequest - All fields optional for flexibility
 * Required fields: learnerId, timestamp, eventType, problemId
 */
export interface CreateInteractionRequest {
  learnerId: string;
  sectionId?: string | null;
  sessionId?: string;
  timestamp: string;
  eventType: EventType;
  problemId: string;
  problemSetId?: string;
  problemNumber?: number;
  
  // Code/Error fields
  code?: string;
  error?: string;
  errorSubtypeId?: string;
  executionTimeMs?: number;
  
  // Hint/Explanation fields
  hintId?: string;
  explanationId?: string;
  hintText?: string;
  hintLevel?: number;
  helpRequestIndex?: number;
  sqlEngageSubtype?: string;
  sqlEngageRowId?: string;
  
  // Policy/Execution fields
  policyVersion?: string;
  timeSpent?: number;
  successful?: boolean;
  ruleFired?: string;
  templateId?: string;
  inputHash?: string;
  model?: string;
  
  // Textbook fields
  noteId?: string;
  noteTitle?: string;
  noteContent?: string;
  
  // Source/Retrieval fields
  retrievedSourceIds?: string[];
  retrievedChunks?: RetrievedChunkInfo[];
  triggerInteractionIds?: string[];
  evidenceInteractionIds?: string[];
  sourceInteractionIds?: string[];
  
  // I/O fields
  inputs?: Record<string, string | number | boolean | null>;
  outputs?: Record<string, string | number | boolean | null | string[]>;
  
  // Concept fields
  conceptId?: string;
  conceptIds?: string[];
  
  // Escalation fields (CRITICAL for replay)
  requestType?: 'hint' | 'explanation' | 'textbook';
  currentRung?: number;
  rung?: number;
  grounded?: boolean;
  contentLength?: number;
  fromRung?: number;
  toRung?: number;
  trigger?: string;
  
  // Textbook Unit fields
  unitId?: string;
  action?: 'created' | 'updated';
  dedupeKey?: string;
  revisionCount?: number;
  
  // Source view fields
  passageCount?: number;
  expanded?: boolean;
  
  // Chat fields
  chatMessage?: string;
  chatResponse?: string;
  chatQuickChip?: string;
  savedToNotes?: boolean;
  textbookUnitsRetrieved?: string[];
  
  // Escalation Profile fields (Week 5)
  profileId?: string;
  assignmentStrategy?: 'static' | 'diagnostic' | 'bandit';
  previousThresholds?: { escalate: number; aggregate: number };
  newThresholds?: { escalate: number; aggregate: number };
  
  // Bandit fields (Week 5)
  selectedArm?: string;
  selectionMethod?: 'thompson_sampling' | 'epsilon_greedy';
  armStatsAtSelection?: Record<string, { mean: number; pulls: number }>;
  reward?: BanditReward;
  newAlpha?: number;
  newBeta?: number;
  
  // HDI/CSI fields
  hdi?: number;
  hdiLevel?: 'low' | 'medium' | 'high';
  hdiComponents?: HDIComponents;
  trend?: 'increasing' | 'stable' | 'decreasing';
  slope?: number;
  interventionType?: 'forced_independent' | 'profile_switch' | 'reflective_prompt';
  
  // Reinforcement fields
  scheduleId?: string;
  promptId?: string;
  promptType?: 'mcq' | 'sql_completion' | 'concept_explanation';
  response?: string;
  isCorrect?: boolean;
  scheduledTime?: number;
  shownTime?: number;
  
  // RESEARCH-4: Canonical study-facing fields
  learnerProfileId?: string;
  escalationTriggerReason?: string;
  errorCountAtEscalation?: number;
  timeToEscalation?: number;
  strategyAssigned?: string;
  strategyUpdated?: string;
  rewardValue?: number;

  // Legacy payload for extensibility
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface BatchInteractionRequest {
  events: CreateInteractionRequest[];
}

export interface InteractionQueryParams {
  learnerId?: string;
  sessionId?: string;
  eventType?: EventType;
  problemId?: string;
  start?: string; // ISO date string
  end?: string;   // ISO date string
  limit?: string;
  offset?: string;
}

// ============================================================================
// Textbook Types
// ============================================================================

export type UnitType = 'hint' | 'explanation' | 'example' | 'summary';
export type UnitStatus = 'primary' | 'alternative' | 'archived';

export interface InstructionalUnit {
  id: string;
  learnerId: string;
  unitId: string;
  type: UnitType;
  conceptIds: string[];
  title: string;
  content: string;
  contentFormat: 'markdown' | 'html';
  sourceInteractionIds: string[];
  status: UnitStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnitRequest {
  unitId: string;
  type: UnitType;
  conceptIds?: string[];
  title: string;
  content: string;
  contentFormat?: 'markdown' | 'html';
  sourceInteractionIds?: string[];
  status?: UnitStatus;
}

export interface UpdateUnitRequest {
  type?: UnitType;
  conceptIds?: string[];
  title?: string;
  content?: string;
  contentFormat?: 'markdown' | 'html';
  sourceInteractionIds?: string[];
  status?: UnitStatus;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: string;
  learnerId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type SessionEscalationPolicy =
  | 'aggressive'
  | 'conservative'
  | 'explanation_first'
  | 'adaptive'
  | 'no_hints';

export interface SessionData {
  sessionId?: string;
  currentProblemId?: string;
  sectionId?: string | null;
  conditionId?: string;
  textbookDisabled?: boolean;
  adaptiveLadderDisabled?: boolean;
  immediateExplanationMode?: boolean;
  staticHintMode?: boolean;
  escalationPolicy?: SessionEscalationPolicy;
  currentCode?: string;
  guidanceState?: Record<string, unknown>;
  hdiState?: Record<string, unknown>;
  banditState?: Record<string, unknown>;
  startTime?: string;
  lastActivity?: string;
}

// ============================================================================
// Research/Aggregate Types
// ============================================================================

export interface ClassStats {
  totalLearners: number;
  totalInteractions: number;
  interactionsByType: Record<EventType, number>;
  totalTextbookUnits: number;
  averageUnitsPerLearner: number;
  recentActivity: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}

export interface LearnerTrajectory {
  learner: Learner;
  interactions: Interaction[];
  textbookUnits: InstructionalUnit[];
  summary: {
    totalInteractions: number;
    problemsAttempted: string[];
    hintsRequested: number;
    explanationsViewed: number;
    textbookUnitsCreated: number;
    sessionCount: number;
  };
}

export interface ResearchExportOptions {
  format: 'json' | 'csv';
  startDate?: string;
  endDate?: string;
  learnerIds?: string[];
  eventTypes?: EventType[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
