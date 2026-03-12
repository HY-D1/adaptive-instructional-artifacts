/**
 * Backend Storage Client
 * HTTP client for communicating with the SQL-Adapt backend API
 * Falls back to localStorage on network errors
 */

import type {
  UserProfile,
  InteractionEvent,
  InstructionalUnit,
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
// Learner API
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
// Interactions API
// ============================================================================

export async function logInteraction(event: InteractionEvent): Promise<boolean> {
  const response = await fetchApi<BackendInteraction>('/interactions', {
    method: 'POST',
    body: JSON.stringify({
      learnerId: event.learnerId,
      sessionId: event.sessionId,
      timestamp: new Date(event.timestamp).toISOString(),
      eventType: event.eventType,
      problemId: event.problemId,
      payload: {
        code: event.code,
        error: event.error,
        errorSubtype: event.errorSubtype,
        guidanceRung: event.guidanceRung,
        contentId: event.contentId,
        duration: event.duration,
        metadata: event.metadata,
      },
    }),
  });
  return response.success;
}

export async function logInteractionsBatch(events: InteractionEvent[]): Promise<boolean> {
  if (events.length === 0) return true;
  
  const response = await fetchApi<{ count: number }>('/interactions/batch', {
    method: 'POST',
    body: JSON.stringify({
      events: events.map(event => ({
        learnerId: event.learnerId,
        sessionId: event.sessionId,
        timestamp: new Date(event.timestamp).toISOString(),
        eventType: event.eventType,
        problemId: event.problemId,
        payload: {
          code: event.code,
          error: event.error,
          errorSubtype: event.errorSubtype,
          guidanceRung: event.guidanceRung,
          contentId: event.contentId,
          duration: event.duration,
          metadata: event.metadata,
        },
      })),
    }),
  });
  return response.success;
}

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

  const events: InteractionEvent[] = response.data.data.map(i => ({
    id: i.id,
    learnerId: i.learnerId,
    sessionId: i.sessionId || undefined,
    timestamp: new Date(i.timestamp).getTime(),
    eventType: i.eventType as InteractionEvent['eventType'],
    problemId: i.problemId,
    code: i.payload.code as string | undefined,
    error: i.payload.error as string | undefined,
    errorSubtype: i.payload.errorSubtype as string | undefined,
    guidanceRung: i.payload.guidanceRung as number | undefined,
    contentId: i.payload.contentId as string | undefined,
    duration: i.payload.duration as number | undefined,
    metadata: i.payload.metadata as Record<string, unknown> | undefined,
  }));

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
    interactions: response.data.interactions.map(i => ({
      id: i.id,
      learnerId: i.learnerId,
      sessionId: i.sessionId || undefined,
      timestamp: new Date(i.timestamp).getTime(),
      eventType: i.eventType as InteractionEvent['eventType'],
      problemId: i.problemId,
    })),
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
  createLearner,
  getLearner,
  getAllLearners,
  updateLearner,
  logInteraction,
  logInteractionsBatch,
  getInteractions,
  getTextbook,
  saveTextbookUnit,
  deleteTextbookUnit,
  getSession,
  saveSession,
  clearSession,
  getClassStats,
  getLearnerTrajectory,
};

export default storageClient;
