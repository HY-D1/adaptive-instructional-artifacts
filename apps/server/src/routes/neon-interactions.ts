/**
 * Interactions API Routes - Neon PostgreSQL Implementation
 */

import { Router, Request, Response } from 'express';
import * as db from '../db/neon.js';
import {
  getSectionForLearnerInInstructorScope,
  getSectionForStudent,
} from '../db/sections.js';

const router = Router();

type NeonInteractionEventInput = Record<string, any>;

// ============================================================================
// Research Event Validation (RESEARCH-4)
// ============================================================================

interface ValidationResult {
  valid: boolean;
  missing: string[];
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export interface BatchValidationError {
  eventId: string;
  eventType: string;
  missingFields: string[];
}

export interface BatchValidationResult {
  valid: boolean;
  failedIds: string[];
  errors: BatchValidationError[];
}

export function validateResearchEvent(event: NeonInteractionEventInput): ValidationResult {
  const missing: string[] = [];
  
  switch (event.eventType) {
    case 'hint_view':
      if (!event.hintId?.trim()) missing.push('hintId');
      if (!event.hintText?.trim()) missing.push('hintText');
      if (![1, 2, 3].includes(event.hintLevel)) missing.push('hintLevel');
      if (!event.templateId?.trim()) missing.push('templateId');
      if (!event.sqlEngageSubtype?.trim()) missing.push('sqlEngageSubtype');
      if (!event.sqlEngageRowId?.trim()) missing.push('sqlEngageRowId');
      if (!event.policyVersion?.trim()) missing.push('policyVersion');
      if (typeof event.helpRequestIndex !== 'number' || event.helpRequestIndex < 1) {
        missing.push('helpRequestIndex');
      }
      break;
      
    case 'concept_view':
      if (!event.conceptId?.trim()) missing.push('conceptId');
      if (!event.source?.trim()) missing.push('source');
      break;
      
    case 'session_end':
      if (!hasText(event.sessionId)) missing.push('sessionId');
      if (typeof event.totalTime !== 'number') missing.push('totalTime');
      if (typeof event.problemsAttempted !== 'number') missing.push('problemsAttempted');
      if (typeof event.problemsSolved !== 'number') missing.push('problemsSolved');
      break;

    case 'textbook_add':
    case 'textbook_update':
      if (!hasText(event.noteId)) missing.push('noteId');
      if (!hasText(event.noteContent)) missing.push('noteContent');
      if (!hasText(event.templateId)) missing.push('templateId');
      if (!hasText(event.policyVersion)) missing.push('policyVersion');
      break;

    case 'chat_interaction':
      if (!hasText(event.chatMessage)) missing.push('chatMessage');
      if (!hasText(event.chatResponse)) missing.push('chatResponse');
      if (hasItems(event.textbookUnitsRetrieved) && !hasItems(event.retrievedSourceIds)) {
        missing.push('retrievedSourceIds');
      }
      break;
  }
  
  return { valid: missing.length === 0, missing };
}

export function validateResearchBatchForWrite(events: NeonInteractionEventInput[]): BatchValidationResult {
  const errors: BatchValidationError[] = [];

  for (const event of events) {
    const validation = validateResearchEvent(event);
    if (!validation.valid) {
      errors.push({
        eventId: typeof event.id === 'string' ? event.id : '',
        eventType: typeof event.eventType === 'string' ? event.eventType : 'unknown',
        missingFields: validation.missing,
      });
    }
  }

  return {
    valid: errors.length === 0,
    failedIds: errors.map((error) => error.eventId).filter(Boolean),
    errors,
  };
}

// ============================================================================
// Auth helpers
// ============================================================================

/**
 * Returns the canonical learnerId to use for this request.
 * When authenticated: always uses the JWT-authenticated learnerId (prevents spoofing).
 * When not authenticated (legacy/local mode): uses the body-supplied learnerId.
 */
class AccessError extends Error {
  status: number;
  targetLearnerId?: string;
  targetSectionId?: string | null;
  constructor(
    status: number,
    message: string,
    context?: { targetLearnerId?: string; targetSectionId?: string | null }
  ) {
    super(message);
    this.status = status;
    this.targetLearnerId = context?.targetLearnerId;
    this.targetSectionId = context?.targetSectionId;
  }
}

type AccessMode = 'read' | 'write';

interface ScopedTarget {
  learnerId: string;
  sectionId: string | null;
}

function routeLabel(req: Request): string {
  return `${req.method} ${req.baseUrl}${req.path}`;
}

function logAuthzFailure(req: Request, error: AccessError): void {
  console.warn('[authz/interactions]', {
    route: routeLabel(req),
    actorRole: req.auth?.role ?? 'anonymous',
    actorId: req.auth?.learnerId ?? null,
    targetLearnerId: error.targetLearnerId ?? null,
    targetSectionId: error.targetSectionId ?? null,
    status: error.status,
    reason: error.message,
  });
}

function logInteractionWrite(req: Request, target: ScopedTarget): void {
  console.info('[interaction/write]', {
    route: routeLabel(req),
    actorRole: req.auth?.role ?? 'anonymous',
    actorId: req.auth?.learnerId ?? null,
    targetLearnerId: target.learnerId,
    targetSectionId: target.sectionId,
  });
}

export function buildNeonInteractionPayload(event: NeonInteractionEventInput): Record<string, unknown> {
  // Extract payload - frontend sends nested payload, direct API calls send flat structure
  // RESEARCH-3B: Explicitly extract bandit/escalation fields for proper column mapping
  const basePayload = event.payload || {
    sessionId: event.sessionId,
    code: event.code,
    error: event.error,
    successful: event.successful,
    hintText: event.hintText,
    hintLevel: event.hintLevel,
    // Escalation Profile fields (RESEARCH-3B)
    profileId: event.profileId,
    assignmentStrategy: event.assignmentStrategy,
    previousThresholds: event.previousThresholds,
    newThresholds: event.newThresholds,
    // Bandit fields (RESEARCH-3B)
    selectedArm: event.selectedArm,
    selectionMethod: event.selectionMethod,
    armStatsAtSelection: event.armStatsAtSelection,
    reward: event.reward,
    newAlpha: event.newAlpha,
    newBeta: event.newBeta,
    // HDI fields (RESEARCH-3B)
    hdi: event.hdi,
    hdiLevel: event.hdiLevel,
    hdiComponents: event.hdiComponents,
    trend: event.trend,
    slope: event.slope,
    interventionType: event.interventionType,
    // Trigger reason for escalation
    trigger: event.trigger,
    // Include other common fields
    ...event,
  };
  // RESEARCH-4: Always merge canonical study fields from event top-level into payload.
  // This ensures they reach the DB columns regardless of whether event.payload was set.
  return {
    ...basePayload,
    id: event.id ?? basePayload.id,
    sessionId: event.sessionId ?? basePayload.sessionId,
    hintId: event.hintId ?? basePayload.hintId,
    conceptId: event.conceptId ?? basePayload.conceptId,
    source: event.source ?? basePayload.source,
    totalTime: event.totalTime ?? basePayload.totalTime,
    problemsAttempted: event.problemsAttempted ?? basePayload.problemsAttempted,
    problemsSolved: event.problemsSolved ?? basePayload.problemsSolved,
    selectedArm: event.selectedArm ?? basePayload.selectedArm,
    learnerProfileId: event.learnerProfileId ?? basePayload.learnerProfileId,
    escalationTriggerReason: event.escalationTriggerReason ?? basePayload.escalationTriggerReason,
    errorCountAtEscalation: event.errorCountAtEscalation ?? basePayload.errorCountAtEscalation,
    timeToEscalation: event.timeToEscalation ?? basePayload.timeToEscalation,
    strategyAssigned: event.strategyAssigned ?? basePayload.strategyAssigned,
    strategyUpdated: event.strategyUpdated ?? basePayload.strategyUpdated,
    rewardValue: event.rewardValue ?? basePayload.rewardValue,
  };
}

async function resolveScopedTarget(
  req: Request,
  requestedLearnerId: string | undefined,
  mode: AccessMode
): Promise<ScopedTarget> {
  const auth = req.auth;
  if (!auth) {
    if (!requestedLearnerId) {
      throw new AccessError(400, 'Missing learnerId');
    }
    return { learnerId: requestedLearnerId, sectionId: null };
  }

  if (auth.role === 'student') {
    if (requestedLearnerId && requestedLearnerId !== auth.learnerId) {
      throw new AccessError(403, 'Access denied: not your data', {
        targetLearnerId: requestedLearnerId,
      });
    }
    const section = await getSectionForStudent(auth.learnerId);
    return { learnerId: auth.learnerId, sectionId: section?.id ?? null };
  }

  if (!requestedLearnerId) {
    if (mode === 'write') {
      throw new AccessError(400, 'learnerId is required for instructor writes');
    }
    return { learnerId: auth.learnerId, sectionId: null };
  }

  if (requestedLearnerId === auth.learnerId) {
    return { learnerId: requestedLearnerId, sectionId: null };
  }

  const scopedSection = await getSectionForLearnerInInstructorScope({
    instructorUserId: auth.learnerId,
    learnerId: requestedLearnerId,
  });
  if (!scopedSection) {
    throw new AccessError(403, 'Access denied: learner not in your section', {
      targetLearnerId: requestedLearnerId,
    });
  }
  return { learnerId: requestedLearnerId, sectionId: scopedSection.id };
}

// ============================================================================
// Event Logging
// ============================================================================

// POST /api/interactions - Log single interaction
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    if (!event.learnerId || !event.eventType || !event.problemId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: learnerId, eventType, problemId',
      });
      return;
    }

    const scopedTarget = await resolveScopedTarget(req, event.learnerId, 'write');
    event.learnerId = scopedTarget.learnerId;
    event.sectionId = scopedTarget.sectionId;

    const id = event.id || `${event.eventType}-${scopedTarget.learnerId}-${Date.now()}`;

    // RESEARCH-3: Validate research-critical events in production
    if (process.env.NODE_ENV === 'production') {
      const validation = validateResearchEvent(event);
      if (!validation.valid) {
        console.warn('[telemetry_validation_error]', {
          eventType: event.eventType,
          missingFields: validation.missing,
          eventId: id,
          route: 'single',
        });
        // Return 400 to reject invalid research events
        res.status(400).json({
          success: false,
          error: 'Invalid research-critical event',
          missingFields: validation.missing,
        });
        return;
      }
    }

    const payload = buildNeonInteractionPayload(event);

    const interaction = await db.createInteraction({
      id,
      learnerId: event.learnerId,
      sectionId: scopedTarget.sectionId,
      timestamp: event.timestamp || new Date().toISOString(),
      eventType: event.eventType,
      problemId: event.problemId,
      payload,
    });
    
    // RESEARCH-4: Link textbook retrievals if present (single route parity with batch)
    if (event.textbookUnitsRetrieved && Array.isArray(event.textbookUnitsRetrieved)) {
      try {
        await db.linkTextbookRetrievals(id, event.textbookUnitsRetrieved);
      } catch (err) {
        console.warn('[neon-interactions] Failed to link retrievals:', err);
        // Don't fail the entire request for retrieval linking issues
      }
    }
    
    logInteractionWrite(req, scopedTarget);

    res.status(201).json({ success: true, data: interaction });
  } catch (error) {
    if (error instanceof AccessError) {
      logAuthzFailure(req, error);
      res.status(error.status).json({ success: false, error: error.message });
      return;
    }
    console.error('Error logging interaction:', error);
    res.status(500).json({ success: false, error: 'Failed to log interaction' });
  }
});

// POST /api/interactions/batch - Log multiple interactions
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      res.status(400).json({
        success: false,
        error: 'Request body must contain an events array',
      });
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      const batchValidation = validateResearchBatchForWrite(events);
      if (!batchValidation.valid) {
        console.warn('[telemetry_validation_error]', {
          route: 'batch',
          failedIds: batchValidation.failedIds,
          errors: batchValidation.errors,
        });
        res.status(400).json({
          success: false,
          error: 'Invalid research-critical event batch',
          failedIds: batchValidation.failedIds,
          errors: batchValidation.errors,
        });
        return;
      }
    }

    const results = [];
    const confirmedIds: string[] = [];
    
    for (const event of events) {
      const scopedTarget = await resolveScopedTarget(req, event.learnerId, 'write');
      event.learnerId = scopedTarget.learnerId;
      event.sectionId = scopedTarget.sectionId;
      const id = event.id || `${event.eventType}-${scopedTarget.learnerId}-${Date.now()}`;
      
      const payload = buildNeonInteractionPayload(event);
      const interaction = await db.createInteraction({
        id,
        learnerId: scopedTarget.learnerId,
        sectionId: scopedTarget.sectionId,
        timestamp: event.timestamp || new Date().toISOString(),
        eventType: event.eventType,
        problemId: event.problemId,
        payload,
      });
      
      // RESEARCH-5: Link textbook retrievals if present
      if (event.textbookUnitsRetrieved && Array.isArray(event.textbookUnitsRetrieved)) {
        try {
          await db.linkTextbookRetrievals(id, event.textbookUnitsRetrieved);
        } catch (err) {
          console.warn('[neon-interactions] Failed to link retrievals:', err);
          // Don't fail the entire request for retrieval linking issues
        }
      }
      
      logInteractionWrite(req, scopedTarget);
      results.push(interaction);
      confirmedIds.push(id);
    }

    // RESEARCH-2: Return confirmed IDs for client-side verification
    res.status(201).json({ 
      success: true, 
      data: { 
        count: results.length,
        confirmedIds,
      } 
    });
  } catch (error) {
    if (error instanceof AccessError) {
      logAuthzFailure(req, error);
      res.status(error.status).json({ success: false, error: error.message });
      return;
    }
    console.error('Error logging interactions batch:', error);
    res.status(500).json({ success: false, error: 'Failed to log interactions' });
  }
});

// GET /api/interactions - Query interactions
router.get('/', async (req: Request, res: Response) => {
  try {
    const { learnerId, sessionId, eventType, problemId, limit, offset } = req.query;

    const requestedLearnerId = typeof learnerId === 'string' ? learnerId : undefined;
    const scopedTarget = await resolveScopedTarget(req, requestedLearnerId, 'read');

    const result = await db.getInteractionsByUser(scopedTarget.learnerId, {
      sessionId: sessionId as string | undefined,
      eventType: eventType as string | undefined,
      problemId: problemId as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({
      success: true,
      data: result.interactions,
      pagination: {
        total: result.total,
        limit: limit ? parseInt(limit as string, 10) : result.interactions.length,
        offset: offset ? parseInt(offset as string, 10) : 0,
        hasMore: result.interactions.length < result.total,
      },
    });
  } catch (error) {
    if (error instanceof AccessError) {
      logAuthzFailure(req, error);
      res.status(error.status).json({ success: false, error: error.message });
      return;
    }
    console.error('Error fetching interactions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch interactions' });
  }
});

// GET /api/interactions/:id - Get specific interaction
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const interaction = await db.getInteractionById(req.params.id);

    if (!interaction) {
      res.status(404).json({ success: false, error: 'Interaction not found' });
      return;
    }

    await resolveScopedTarget(req, interaction.learnerId, 'read');

    res.json({ success: true, data: interaction });
  } catch (error) {
    if (error instanceof AccessError) {
      logAuthzFailure(req, error);
      res.status(error.status).json({ success: false, error: error.message });
      return;
    }
    console.error('Error fetching interaction:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch interaction' });
  }
});

export { router as neonInteractionsRouter };
