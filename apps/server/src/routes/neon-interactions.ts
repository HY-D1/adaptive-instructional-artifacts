/**
 * Interactions API Routes - Neon PostgreSQL Implementation
 */

import { Router, Request, Response } from 'express';
import * as db from '../db/neon.js';
import { getSectionForLearnerInInstructorScope } from '../db/sections.js';

const router = Router();

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
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function resolveWritableLearnerId(req: Request, bodyLearnerId?: string): Promise<string> {
  const auth = req.auth;
  if (!auth) {
    if (!bodyLearnerId) throw new AccessError(400, 'Missing learnerId');
    return bodyLearnerId;
  }

  if (auth.role === 'student') {
    return auth.learnerId;
  }

  if (!bodyLearnerId) {
    throw new AccessError(400, 'learnerId is required for instructor writes');
  }
  if (bodyLearnerId === auth.learnerId) {
    return bodyLearnerId;
  }

  const scopedSection = await getSectionForLearnerInInstructorScope({
    instructorUserId: auth.learnerId,
    learnerId: bodyLearnerId,
  });
  if (!scopedSection) {
    throw new AccessError(403, 'Access denied: learner not in your section');
  }
  return bodyLearnerId;
}

async function assertReadableLearnerId(req: Request, learnerId: string): Promise<string> {
  const auth = req.auth;
  if (!auth) {
    return learnerId;
  }

  if (auth.role === 'student') {
    return auth.learnerId;
  }
  if (learnerId === auth.learnerId) {
    return learnerId;
  }

  const scopedSection = await getSectionForLearnerInInstructorScope({
    instructorUserId: auth.learnerId,
    learnerId,
  });
  if (!scopedSection) {
    throw new AccessError(403, 'Access denied: learner not in your section');
  }
  return learnerId;
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

    const canonicalLearnerId = await resolveWritableLearnerId(req, event.learnerId);
    event.learnerId = canonicalLearnerId;

    const id = event.id || `${event.eventType}-${canonicalLearnerId}-${Date.now()}`;

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
    const payload = {
      ...basePayload,
      selectedArm: event.selectedArm ?? basePayload.selectedArm,
      learnerProfileId: event.learnerProfileId ?? basePayload.learnerProfileId,
      escalationTriggerReason: event.escalationTriggerReason ?? basePayload.escalationTriggerReason,
      errorCountAtEscalation: event.errorCountAtEscalation ?? basePayload.errorCountAtEscalation,
      timeToEscalation: event.timeToEscalation ?? basePayload.timeToEscalation,
      strategyAssigned: event.strategyAssigned ?? basePayload.strategyAssigned,
      strategyUpdated: event.strategyUpdated ?? basePayload.strategyUpdated,
      rewardValue: event.rewardValue ?? basePayload.rewardValue,
    };

    const interaction = await db.createInteraction({
      id,
      learnerId: event.learnerId,
      timestamp: event.timestamp || new Date().toISOString(),
      eventType: event.eventType,
      problemId: event.problemId,
      payload,
    });

    res.status(201).json({ success: true, data: interaction });
  } catch (error) {
    if (error instanceof AccessError) {
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

    const results = [];
    for (const event of events) {
      const canonicalLearnerId = await resolveWritableLearnerId(req, event.learnerId);
      event.learnerId = canonicalLearnerId;
      const id = event.id || `${event.eventType}-${canonicalLearnerId}-${Date.now()}`;
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
      // RESEARCH-4: Always merge canonical study fields
      const payload = {
        ...basePayload,
        selectedArm: event.selectedArm ?? basePayload.selectedArm,
        learnerProfileId: event.learnerProfileId ?? basePayload.learnerProfileId,
        escalationTriggerReason: event.escalationTriggerReason ?? basePayload.escalationTriggerReason,
        errorCountAtEscalation: event.errorCountAtEscalation ?? basePayload.errorCountAtEscalation,
        timeToEscalation: event.timeToEscalation ?? basePayload.timeToEscalation,
        strategyAssigned: event.strategyAssigned ?? basePayload.strategyAssigned,
        strategyUpdated: event.strategyUpdated ?? basePayload.strategyUpdated,
        rewardValue: event.rewardValue ?? basePayload.rewardValue,
      };
      const interaction = await db.createInteraction({
        id,
        learnerId: canonicalLearnerId,
        timestamp: event.timestamp || new Date().toISOString(),
        eventType: event.eventType,
        problemId: event.problemId,
        payload,
      });
      results.push(interaction);
    }

    res.status(201).json({ success: true, data: { count: results.length } });
  } catch (error) {
    if (error instanceof AccessError) {
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
    const auth = req.auth;

    if (!auth && !learnerId) {
      res.status(400).json({
        success: false,
        error: 'learnerId query parameter is required',
      });
      return;
    }

    const requestedLearnerId = typeof learnerId === 'string' ? learnerId : undefined;
    if (auth?.role === 'student' && requestedLearnerId && requestedLearnerId !== auth.learnerId) {
      res.status(403).json({
        success: false,
        error: 'Access denied: not your data',
      });
      return;
    }
    const effectiveLearnerId = auth?.role === 'student'
      ? auth.learnerId
      : (requestedLearnerId || auth?.learnerId);

    if (!effectiveLearnerId) {
      res.status(400).json({
        success: false,
        error: 'learnerId query parameter is required',
      });
      return;
    }

    const scopedLearnerId = await assertReadableLearnerId(req, effectiveLearnerId);

    const result = await db.getInteractionsByUser(scopedLearnerId, {
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

    await assertReadableLearnerId(req, interaction.learnerId);

    res.json({ success: true, data: interaction });
  } catch (error) {
    if (error instanceof AccessError) {
      res.status(error.status).json({ success: false, error: error.message });
      return;
    }
    console.error('Error fetching interaction:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch interaction' });
  }
});

export { router as neonInteractionsRouter };
