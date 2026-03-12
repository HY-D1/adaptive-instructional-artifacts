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
 * Full learner profile with concept coverage, evidence, and learning state
 * This is stored as JSON in the learner_profiles table
 */
export interface LearnerProfile {
  id: string;
  name: string;
  conceptsCovered: string[]; // Set serialized as array
  conceptCoverageEvidence: Record<string, ConceptCoverageEvidence>; // Map serialized as object
  errorHistory: Record<string, number>; // Map serialized as object
  interactionCount: number;
  currentStrategy: string;
  preferences: {
    escalationThreshold: number;
    aggregationDelay: number;
  };
  createdAt: number;
  lastActive: number;
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
  preferences?: {
    escalationThreshold: number;
    aggregationDelay: number;
  };
  lastActive?: number;
}

/**
 * Request to update profile from a single event
 */
export interface UpdateProfileFromEventRequest {
  event: CreateInteractionRequest;
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
 * Full InteractionEvent - Lossless logging for research replay
 * Mirrors the frontend InteractionEvent exactly
 */
export interface Interaction {
  id: string;
  learnerId: string;
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
  
  // Escalation fields (CRITICAL for replay)
  rung?: number;
  fromRung?: number;
  toRung?: number;
  trigger?: string;
  
  // Concept fields
  conceptIds?: string[];
  
  // HDI/CSI fields
  hdi?: number;
  hdiLevel?: 'low' | 'medium' | 'high';
  hdiComponents?: HDIComponents;
  
  // Reinforcement fields
  scheduleId?: string;
  promptId?: string;
  response?: string;
  isCorrect?: boolean;
  
  // Provenance fields
  unitId?: string;
  action?: string;
  sourceInteractionIds?: string[];
  retrievedSourceIds?: string[];
  
  // Legacy payload for extensibility/backward compatibility
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  
  createdAt: string;
}

/**
 * CreateInteractionRequest - All fields optional for flexibility
 * Required fields: learnerId, timestamp, eventType
 */
export interface CreateInteractionRequest {
  learnerId: string;
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
  
  // Escalation fields (CRITICAL for replay)
  rung?: number;
  fromRung?: number;
  toRung?: number;
  trigger?: string;
  
  // Concept fields
  conceptIds?: string[];
  
  // HDI/CSI fields
  hdi?: number;
  hdiLevel?: 'low' | 'medium' | 'high';
  hdiComponents?: HDIComponents;
  
  // Reinforcement fields
  scheduleId?: string;
  promptId?: string;
  response?: string;
  isCorrect?: boolean;
  
  // Provenance fields
  unitId?: string;
  action?: string;
  sourceInteractionIds?: string[];
  retrievedSourceIds?: string[];
  
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

export interface SessionData {
  currentProblemId?: string;
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
