/**
 * Interactions API Routes - Neon PostgreSQL Implementation
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as db from '../db/neon.js';
import {
  getSectionForLearnerInInstructorScope,
  getSectionForStudent,
} from '../db/sections.js';
import {
  validateResearchEvent,
  validateResearchBatchForWrite,
  type BatchValidationError,
  type BatchValidationResult,
} from '../db/index.js';
import type { EventType } from '../types.js';

const router = Router();

// Zod schema for interaction event validation (BUG-007)
const interactionEventSchema = z.object({
  learnerId: z.string(),
  eventType: z.string(),
  problemId: z.string(),
  id: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().optional(),
  code: z.string().max(50000).optional(),
  error: z.string().max(5000).optional(),
  hintText: z.string().max(10000).optional(),
  hintLevel: z.number().optional(),
  hintId: z.string().optional(),
  conceptId: z.string().optional(),
  source: z.string().optional(),
  totalTime: z.number().optional(),
  problemsAttempted: z.number().optional(),
  problemsSolved: z.number().optional(),
  successful: z.boolean().optional(),
  // Escalation Profile fields
  profileId: z.string().optional(),
  assignmentStrategy: z.string().optional(),
  previousThresholds: z.record(z.any()).optional(),
  newThresholds: z.record(z.any()).optional(),
  // Bandit fields
  selectedArm: z.string().optional(),
  selectionMethod: z.string().optional(),
  armStatsAtSelection: z.record(z.any()).optional(),
  reward: z.number().optional(),
  newAlpha: z.number().optional(),
  newBeta: z.number().optional(),
  // HDI fields
  hdi: z.number().optional(),
  hdiLevel: z.string().optional(),
  hdiComponents: z.record(z.any()).optional(),
  trend: z.string().optional(),
  slope: z.number().optional(),
  interventionType: z.string().optional(),
  trigger: z.string().optional(),
  escalationTriggerReason: z.string().optional(),
  errorCountAtEscalation: z.number().optional(),
  timeToEscalation: z.number().optional(),
  strategyAssigned: z.string().optional(),
  strategyUpdated: z.boolean().optional(),
  rewardValue: z.number().optional(),
  learnerProfileId: z.string().optional(),
  payload: z.record(z.any()).optional(),
  textbookUnitsRetrieved: z.array(z.string()).optional(),
}).strict(); // Rejects unknown fields

type NeonInteractionEventInput = z.infer<typeof interactionEventSchema>;

// Re-export for backward compatibility
export { validateResearchEvent, validateResearchBatchForWrite };
export type { BatchValidationError, BatchValidationResult };

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

type ProblemProgressUpdate = {
  solved?: boolean;
  incrementAttempts?: boolean;
  incrementHints?: boolean;
  lastCode?: string;
};

function buildProblemProgressUpdate(event: NeonInteractionEventInput): ProblemProgressUpdate | null {
  switch (event.eventType) {
    case 'execution':
      return {
        solved: event.successful === true,
        incrementAttempts: true,
        lastCode: typeof event.code === 'string' ? event.code : undefined,
      };
    case 'error':
      return {
        incrementAttempts: true,
        lastCode: typeof event.code === 'string' ? event.code : undefined,
      };
    case 'hint_view':
      return {
        incrementHints: true,
      };
    default:
      return null;
  }
}

async function persistProblemProgressIfNeeded(
  learnerId: string,
  problemId: string,
  event: NeonInteractionEventInput,
): Promise<void> {
  const progressUpdate = buildProblemProgressUpdate(event);
  if (!progressUpdate) {
    return;
  }

  await db.updateProblemProgress(learnerId, problemId, progressUpdate);
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

    const schemaValidation = interactionEventSchema.safeParse(event);
    if (!schemaValidation.success) {
      res.status(400).json({
        success: false,
        error: 'Schema validation failed',
        issues: schemaValidation.error.issues.map((issue) => issue.message),
      });
      return;
    }

    const validatedEvent = schemaValidation.data as NeonInteractionEventInput & { sectionId?: string | null };

    const scopedTarget = await resolveScopedTarget(req, validatedEvent.learnerId, 'write');
    validatedEvent.learnerId = scopedTarget.learnerId;
    validatedEvent.sectionId = scopedTarget.sectionId;

    const id = validatedEvent.id || `${validatedEvent.eventType}-${scopedTarget.learnerId}-${Date.now()}`;

    // RESEARCH-3: Validate research-critical events in production
    if (process.env.NODE_ENV === 'production') {
      const validation = validateResearchEvent(validatedEvent);
      if (!validation.valid) {
        console.warn('[telemetry_validation_error]', {
          eventType: validatedEvent.eventType,
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

    const payload = buildNeonInteractionPayload(validatedEvent);

    const interaction = await db.createInteraction({
      id,
      learnerId: validatedEvent.learnerId,
      sectionId: scopedTarget.sectionId,
      timestamp: validatedEvent.timestamp || new Date().toISOString(),
      eventType: validatedEvent.eventType as EventType,
      problemId: validatedEvent.problemId,
      payload,
    });

    await persistProblemProgressIfNeeded(validatedEvent.learnerId, validatedEvent.problemId, validatedEvent);
    
    // RESEARCH-4: Link textbook retrievals if present (single route parity with batch)
    if (validatedEvent.textbookUnitsRetrieved && Array.isArray(validatedEvent.textbookUnitsRetrieved)) {
      try {
        await db.linkTextbookRetrievals(id, validatedEvent.textbookUnitsRetrieved);
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

    // BUG-002: Enforce batch size limit
    if (events.length > 500) {
      res.status(400).json({
        success: false,
        error: 'Batch size exceeds maximum of 500 events',
      });
      return;
    }

    // BUG-007: Validate each event against schema
    const schemaValidationErrors: Array<{ index: number; eventId: string; issues: string[] }> = [];
    for (let i = 0; i < events.length; i++) {
      const result = interactionEventSchema.safeParse(events[i]);
      if (!result.success) {
        schemaValidationErrors.push({
          index: i,
          eventId: events[i]?.id || `index-${i}`,
          issues: result.error.issues.map(issue => issue.message),
        });
      }
    }
    if (schemaValidationErrors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Schema validation failed for one or more events',
        schemaErrors: schemaValidationErrors,
      });
      return;
    }

    // RESEARCH-4: Validate basic required fields for each event (parity with single route)
    const invalidEvents: Array<{ index: number; eventId: string; reason: string }> = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event.learnerId || !event.eventType || !event.problemId) {
        invalidEvents.push({
          index: i,
          eventId: event.id || `index-${i}`,
          reason: 'Missing required fields: learnerId, eventType, or problemId',
        });
      }
    }
    if (invalidEvents.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid events in batch',
        invalidEvents,
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
    const failedEvents: Array<{ index: number; eventId: string; error: string }> = [];
    
    // Process each event, tracking partial failures
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      try {
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

        // Persist problem progress - log but don't fail if this fails
        try {
          await persistProblemProgressIfNeeded(scopedTarget.learnerId, event.problemId, event);
        } catch (progressErr) {
          console.warn('[neon-interactions] Failed to persist problem progress:', progressErr);
        }
        
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
      } catch (eventError) {
        const errorMessage = eventError instanceof Error ? eventError.message : 'Unknown error';
        console.error(`[neon-interactions] Failed to process event ${i}:`, eventError);
        failedEvents.push({
          index: i,
          eventId: event.id || `index-${i}`,
          error: errorMessage,
        });
      }
    }

    // RESEARCH-2: Return confirmed IDs for client-side verification
    // If all events failed, return 500. If partial success, return 207 Multi-Status
    if (results.length === 0 && failedEvents.length > 0) {
      res.status(500).json({
        success: false,
        error: 'All events failed to process',
        failedEvents,
      });
      return;
    }

    if (failedEvents.length > 0) {
      res.status(207).json({
        success: true,
        partial: true,
        data: {
          count: results.length,
          confirmedIds,
        },
        failedEvents,
      });
      return;
    }

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
