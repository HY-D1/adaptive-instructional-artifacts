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

export interface Interaction {
  id: string;
  learnerId: string;
  sessionId: string | null;
  timestamp: string;
  eventType: EventType;
  problemId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CreateInteractionRequest {
  learnerId: string;
  sessionId?: string;
  timestamp: string;
  eventType: EventType;
  problemId: string;
  payload?: Record<string, unknown>;
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
