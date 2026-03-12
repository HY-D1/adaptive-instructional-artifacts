/**
 * Backend Storage Client
 * HTTP client for communicating with the SQL-Adapt backend API
 * Falls back to localStorage on network errors
 */

import type {
  UserProfile,
  InteractionEvent,
  InstructionalUnit,
  LearnerProfile,
  ConceptCoverageEvidence,
} from '@/app/types';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true' || !!import.meta.env.VITE_API_URL;

// ============================================================================
// Types
// ============================================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface BackendLearner {
  id: string;
  name: string;
  role: 'student' | 'instructor';
  createdAt: string;
  updatedAt: string;
}

interface BackendInteraction {
  id: string;
  learnerId: string;
  sessionId: string | null;
  timestamp: string;
  eventType: string;
  problemId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface BackendUnit {
  id: string;
  learnerId: string;
  unitId: string;
  type: 'hint' | 'explanation' | 'example' | 'summary';
  conceptIds: string[];
  title: string;
  content: string;
  contentFormat: 'markdown' | 'html';
  sourceInteractionIds: string[];
  status: 'primary' | 'alternative' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface BackendLearnerProfile {
  id: string;
  name: string;
  conceptsCovered: string[];
  conceptCoverageEvidence: Record<string, ConceptCoverageEvidence>;
  errorHistory: Record<string, number>;
  interactionCount: number;
  currentStrategy: string;
  preferences: {
    escalationThreshold: number;
    aggregationDelay: number;
  };
  createdAt: number;
  lastActive: number;
}

interface SessionData {
  currentProblemId?: string;
  currentCode?: string;
  guidanceState?: Record<string, unknown>;
  hdiState?: Record<string, unknown>;
  banditState?: Record<string, unknown>;
  startTime?: string;
  lastActivity?: string;
}

// ============================================================================
// HTTP Client
// ============================================================================

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        message: errorData.message,
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: 'Network error',
      message: error instanceof Error ? error.message : 'Failed to connect to backend',
    };
  }
}

// ============================================================================
// Feature Detection
// ============================================================================

export function isBackendAvailable(): boolean {
  return USE_BACKEND;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL.replace('/api', '')}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Learner API (Basic Info)
// ============================================================================

export async function createLearner(profile: UserProfile): Promise<boolean> {
  const response = await fetchApi<BackendLearner>('/learners', {
    method: 'POST',
    body: JSON.stringify({
      id: profile.id,
      name: profile.name,
      role: profile.role,
    }),
  });
  return response.success;
}

export async function getLearner(id: string): Promise<UserProfile | null> {
  const response = await fetchApi<BackendLearner>(`/learners/${id}`);
  if (!response.success || !response.data) return null;
  
  return {
    id: response.data.id,
    name: response.data.name,
    role: response.data.role,
    createdAt: new Date(response.data.createdAt).getTime(),
  };
}

export async function getAllLearners(): Promise<UserProfile[]> {
  const response = await fetchApi<BackendLearner[]>('/learners');
  if (!response.success || !response.data) return [];
  
  return response.data.map(l => ({
    id: l.id,
    name: l.name,
    role: l.role,
    createdAt: new Date(l.createdAt).getTime(),
  }));
}

export async function updateLearner(
  id: string,
  updates: Partial<Pick<UserProfile, 'name' | 'role'>>
): Promise<boolean> {
  const response = await fetchApi<BackendLearner>(`/learners/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return response.success;
}

// ============================================================================
// Learner Profile API (Full Rich Profiles)
// ============================================================================

/**
 * Get a learner's full profile with concept coverage, evidence, etc.
 */
export async function getProfile(learnerId: string): Promise<LearnerProfile | null> {
  const response = await fetchApi<BackendLearnerProfile>(`/learners/${learnerId}/profile`);
  if (!response.success || !response.data) return null;
  
  const data = response.data;
  return {
    id: data.id,
    name: data.name,
    conceptsCovered: new Set(data.conceptsCovered),
    conceptCoverageEvidence: new Map(Object.entries(data.conceptCoverageEvidence)),
    errorHistory: new Map(Object.entries(data.errorHistory)),
    interactionCount: data.interactionCount,
    currentStrategy: data.currentStrategy as LearnerProfile['currentStrategy'],
    preferences: data.preferences,
    createdAt: data.createdAt,
    lastActive: data.lastActive,
  };
}

/**
 * Save a learner's full profile
 */
export async function saveProfile(profile: LearnerProfile): Promise<boolean> {
  const response = await fetchApi<BackendLearnerProfile>(`/learners/${profile.id}/profile`, {
    method: 'PUT',
    body: JSON.stringify({
      name: profile.name,
      conceptsCovered: Array.from(profile.conceptsCovered),
      conceptCoverageEvidence: Object.fromEntries(profile.conceptCoverageEvidence),
      errorHistory: Object.fromEntries(profile.errorHistory),
      interactionCount: profile.interactionCount,
      currentStrategy: profile.currentStrategy,
      preferences: profile.preferences,
      lastActive: profile.lastActive,
    }),
  });
  return response.success;
}

/**
 * Get all learner profiles (for instructor dashboard)
 */
export async function getAllProfiles(): Promise<LearnerProfile[]> {
  const response = await fetchApi<BackendLearnerProfile[]>('/learners/profiles');
  if (!response.success || !response.data) return [];
  
  return response.data.map(data => ({
    id: data.id,
    name: data.name,
    conceptsCovered: new Set(data.conceptsCovered),
    conceptCoverageEvidence: new Map(Object.entries(data.conceptCoverageEvidence)),
    errorHistory: new Map(Object.entries(data.errorHistory)),
    interactionCount: data.interactionCount,
    currentStrategy: data.currentStrategy as LearnerProfile['currentStrategy'],
    preferences: data.preferences,
    createdAt: data.createdAt,
    lastActive: data.lastActive,
  }));
}

/**
 * Update profile from a single event (server-side derivation)
 */
export async function updateProfileFromEvent(
  learnerId: string,
  event: InteractionEvent
): Promise<LearnerProfile | null> {
  const response = await fetchApi<BackendLearnerProfile>(`/learners/${learnerId}/profile/events`, {
    method: 'POST',
    body: JSON.stringify({
      event: {
        learnerId: event.learnerId,
        sessionId: event.sessionId,
        timestamp: new Date(event.timestamp).toISOString(),
        eventType: event.eventType,
        problemId: event.problemId,
        problemSetId: event.problemSetId,
        problemNumber: event.problemNumber,
        code: event.code,
        error: event.error,
        errorSubtypeId: event.errorSubtypeId,
        conceptIds: event.conceptIds,
        metadata: {
          successful: event.successful,
          ...event.metadata,
        },
      },
    }),
  });
  
  if (!response.success || !response.data) return null;
  
  const data = response.data;
  return {
    id: data.id,
    name: data.name,
    conceptsCovered: new Set(data.conceptsCovered),
    conceptCoverageEvidence: new Map(Object.entries(data.conceptCoverageEvidence)),
    errorHistory: new Map(Object.entries(data.errorHistory)),
    interactionCount: data.interactionCount,
    currentStrategy: data.currentStrategy as LearnerProfile['currentStrategy'],
    preferences: data.preferences,
    createdAt: data.createdAt,
    lastActive: data.lastActive,
  };
}

// ============================================================================
// Interactions API - Lossless Logging (Full Event Schema)
// ============================================================================

/**
 * Convert frontend InteractionEvent to backend format
 * Preserves ALL fields for research replay
 */
function convertToBackendInteraction(event: InteractionEvent): Partial<BackendInteraction> {
  return {
    // Required fields
    learnerId: event.learnerId,
    sessionId: event.sessionId,
    timestamp: new Date(event.timestamp).toISOString(),
    eventType: event.eventType,
    problemId: event.problemId,
    
    // Problem context
    problemSetId: event.problemSetId,
    problemNumber: event.problemNumber,
    
    // Code/Error fields
    code: event.code,
    error: event.error,
    errorSubtypeId: event.errorSubtypeId,
    executionTimeMs: event.executionTimeMs,
    
    // Escalation fields (CRITICAL for replay)
    rung: event.rung,
    fromRung: event.fromRung,
    toRung: event.toRung,
    trigger: event.trigger,
    
    // Concept fields
    conceptIds: event.conceptIds,
    
    // HDI/CSI fields
    hdi: event.hdi,
    hdiLevel: event.hdiLevel,
    hdiComponents: event.hdiComponents,
    
    // Reinforcement fields
    scheduleId: event.scheduleId,
    promptId: event.promptId,
    response: event.response,
    isCorrect: event.isCorrect,
    
    // Provenance fields
    unitId: event.unitId,
    action: event.action,
    sourceInteractionIds: event.sourceInteractionIds,
    retrievedSourceIds: event.retrievedSourceIds,
    
    // Legacy payload for extensibility
    payload: event.payload,
    metadata: event.metadata,
  };
}

/**
 * Log a single interaction event (lossless)
 * Sends complete InteractionEvent to backend
 */
export async function logInteraction(event: InteractionEvent): Promise<boolean> {
  const backendEvent = convertToBackendInteraction(event);
  
  const response = await fetchApi<BackendInteraction>('/interactions', {
    method: 'POST',
    body: JSON.stringify(backendEvent),
  });
  return response.success;
}

/**
 * Log multiple interaction events in batch (lossless)
 * Sends complete InteractionEvents to backend
 */
export async function logInteractionsBatch(events: InteractionEvent[]): Promise<boolean> {
  if (events.length === 0) return true;
  
  const backendEvents = events.map(convertToBackendInteraction);
  
  const response = await fetchApi<{ count: number }>('/interactions/batch', {
    method: 'POST',
    body: JSON.stringify({ events: backendEvents }),
  });
  return response.success;
}

/**
 * Convert backend interaction to frontend InteractionEvent
 */
function convertToFrontendEvent(i: BackendInteraction): InteractionEvent {
  return {
    id: i.id,
    learnerId: i.learnerId,
    sessionId: i.sessionId || undefined,
    timestamp: new Date(i.timestamp).getTime(),
    eventType: i.eventType as InteractionEvent['eventType'],
    problemId: i.problemId,
    problemSetId: i.problemSetId,
    problemNumber: i.problemNumber,
    code: i.code,
    error: i.error,
    errorSubtypeId: i.errorSubtypeId,
    executionTimeMs: i.executionTimeMs,
    rung: i.rung,
    fromRung: i.fromRung,
    toRung: i.toRung,
    trigger: i.trigger,
    conceptIds: i.conceptIds,
    hdi: i.hdi,
    hdiLevel: i.hdiLevel,
    hdiComponents: i.hdiComponents,
    scheduleId: i.scheduleId,
    promptId: i.promptId,
    response: i.response,
    isCorrect: i.isCorrect,
    unitId: i.unitId,
    action: i.action,
    sourceInteractionIds: i.sourceInteractionIds,
    retrievedSourceIds: i.retrievedSourceIds,
    payload: i.payload,
    metadata: i.metadata,
  };
}

/**
 * Get interactions for a learner (returns full events)
 */
export async function getInteractions(
  learnerId?: string,
  options?: {
    start?: Date;
    end?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<{ events: InteractionEvent[]; total: number }> {
  const params = new URLSearchParams();
  if (learnerId) params.set('learnerId', learnerId);
  if (options?.start) params.set('start', options.start.toISOString());
  if (options?.end) params.set('end', options.end.toISOString());
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());

  const response = await fetchApi<PaginatedResponse<BackendInteraction>>(
    `/interactions?${params.toString()}`
  );
  
  if (!response.success || !response.data) {
    return { events: [], total: 0 };
  }

  const events: InteractionEvent[] = response.data.data.map(convertToFrontendEvent);

  return { events, total: response.data.pagination.total };
}

// ============================================================================
// Textbook API
// ============================================================================

export async function getTextbook(learnerId: string): Promise<InstructionalUnit[]> {
  const response = await fetchApi<BackendUnit[]>(`/textbooks/${learnerId}`);
  if (!response.success || !response.data) return [];

  return response.data.map(u => ({
    id: u.unitId,
    type: u.type,
    conceptId: u.conceptIds[0] || '',
    conceptIds: u.conceptIds,
    title: u.title,
    content: u.content,
    contentFormat: u.contentFormat,
    sourceInteractionIds: u.sourceInteractionIds,
    provenance: undefined,
    status: u.status,
  }));
}

export async function saveTextbookUnit(
  learnerId: string,
  unit: InstructionalUnit
): Promise<boolean> {
  const response = await fetchApi<BackendUnit>(`/textbooks/${learnerId}/units`, {
    method: 'POST',
    body: JSON.stringify({
      unitId: unit.id,
      type: unit.type,
      conceptIds: unit.conceptIds || [unit.conceptId],
      title: unit.title,
      content: unit.content,
      contentFormat: unit.contentFormat || 'markdown',
      sourceInteractionIds: unit.sourceInteractionIds,
      status: unit.status || 'primary',
    }),
  });
  return response.success;
}

export async function deleteTextbookUnit(
  learnerId: string,
  unitId: string
): Promise<boolean> {
  const response = await fetchApi<{ learnerId: string; unitId: string }>(
    `/textbooks/${learnerId}/units/${unitId}`,
    { method: 'DELETE' }
  );
  return response.success;
}

// ============================================================================
// Session API
// ============================================================================

export async function getSession(learnerId: string): Promise<SessionData | null> {
  const response = await fetchApi<{ data: SessionData }>(`/sessions/${learnerId}/active`);
  if (!response.success) return null;
  return response.data?.data || null;
}

export async function saveSession(
  learnerId: string,
  data: SessionData
): Promise<boolean> {
  const response = await fetchApi<{ data: SessionData }>(`/sessions/${learnerId}/active`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.success;
}

export async function clearSession(learnerId: string): Promise<boolean> {
  const response = await fetchApi<{ cleared: boolean }>(
    `/sessions/${learnerId}/active`,
    { method: 'DELETE' }
  );
  return response.success;
}

// ============================================================================
// Research API
// ============================================================================

export async function getClassStats(): Promise<{
  totalLearners: number;
  totalInteractions: number;
  totalTextbookUnits: number;
} | null> {
  const response = await fetchApi<{
    totalLearners: number;
    totalInteractions: number;
    totalTextbookUnits: number;
  }>('/research/aggregates');
  
  if (!response.success || !response.data) return null;
  return response.data;
}

export async function getLearnerTrajectory(learnerId: string): Promise<{
  interactions: InteractionEvent[];
  textbookUnits: InstructionalUnit[];
} | null> {
  const response = await fetchApi<{
    interactions: BackendInteraction[];
    textbookUnits: BackendUnit[];
  }>(`/research/learner/${learnerId}/trajectory`);
  
  if (!response.success || !response.data) return null;

  return {
    interactions: response.data.interactions.map(convertToFrontendEvent),
    textbookUnits: response.data.textbookUnits.map(u => ({
      id: u.unitId,
      type: u.type,
      conceptId: u.conceptIds[0] || '',
      conceptIds: u.conceptIds,
      title: u.title,
      content: u.content,
      sourceInteractionIds: u.sourceInteractionIds,
      status: u.status,
    })),
  };
}

// ============================================================================
// Export
// ============================================================================

export const storageClient = {
  isBackendAvailable,
  checkBackendHealth,
  // Learner basic operations
  createLearner,
  getLearner,
  getAllLearners,
  updateLearner,
  // Full profile operations
  getProfile,
  saveProfile,
  getAllProfiles,
  updateProfileFromEvent,
  // Interactions
  logInteraction,
  logInteractionsBatch,
  getInteractions,
  // Textbook
  getTextbook,
  saveTextbookUnit,
  deleteTextbookUnit,
  // Session
  getSession,
  saveSession,
  clearSession,
  // Research
  getClassStats,
  getLearnerTrajectory,
};

export default storageClient;
