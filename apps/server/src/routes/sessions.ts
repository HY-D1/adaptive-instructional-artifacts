/**
 * Sessions API Routes
 * Active session management for learners
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  getActiveSession,
  saveActiveSession,
  clearActiveSession,
} from '../db/index.js';
import type { ApiResponse, Session, SessionData } from '../types.js';

const router = Router();

// Validation schema for session data
const sessionDataSchema = z.object({
  sessionId: z.string().optional(),
  sectionId: z.string().optional(),
  conditionId: z.string().optional(),
  currentProblemId: z.string().optional(),
  currentCode: z.string().optional(),
  guidanceState: z.record(z.unknown()).optional(),
  hdiState: z.record(z.unknown()).optional(),
  banditState: z.record(z.unknown()).optional(),
  textbookDisabled: z.boolean().optional(),
  adaptiveLadderDisabled: z.boolean().optional(),
  immediateExplanationMode: z.boolean().optional(),
  staticHintMode: z.boolean().optional(),
  escalationPolicy: z.custom<import('../types.js').SessionEscalationPolicy>().optional(),
  startTime: z.string().datetime().optional(),
  lastActivity: z.string().datetime().optional(),
});

// Check if session payload has mutation data (parity with neon-sessions.ts)
function hasSessionMutationPayload(body: SessionData): boolean {
  return (
    body.currentProblemId !== undefined ||
    body.currentCode !== undefined ||
    body.guidanceState !== undefined ||
    body.hdiState !== undefined ||
    body.banditState !== undefined ||
    body.conditionId !== undefined ||
    body.textbookDisabled !== undefined ||
    body.adaptiveLadderDisabled !== undefined ||
    body.immediateExplanationMode !== undefined ||
    body.staticHintMode !== undefined ||
    body.escalationPolicy !== undefined
  );
}

// ============================================================================
// GET /api/sessions/:learnerId/active - Get active session
// ============================================================================

router.get('/:learnerId/active', async (req, res) => {
  try {
    const { learnerId } = req.params;
    const session = await getActiveSession(learnerId);

    if (!session) {
      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'No active session found',
      };
      res.json(response);
      return;
    }

    const response: ApiResponse<Session> = {
      success: true,
      data: session,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch session',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/sessions/:learnerId/active - Save active session
// ============================================================================

router.post('/:learnerId/active', async (req, res) => {
  try {
    const { learnerId } = req.params;
    const parseResult = sessionDataSchema.safeParse(req.body);

    if (!parseResult.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: parseResult.error.message,
      };
      res.status(400).json(response);
      return;
    }

    const data: SessionData = parseResult.data;

    // Treat heartbeat-only writes as read-through when an active session exists.
    // This prevents session bootstrapping calls from replacing resumable state
    // with an empty session that has null currentCode. (parity with neon-sessions.ts)
    if (!hasSessionMutationPayload(data)) {
      const existingSession = await getActiveSession(learnerId);
      if (existingSession) {
        const response: ApiResponse<Session> = {
          success: true,
          data: existingSession as Session,
        };
        res.json(response);
        return;
      }
    }

    const session = await saveActiveSession(learnerId, data);

    const response: ApiResponse<Session> = {
      success: true,
      data: session,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to save session',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// PUT /api/sessions/:learnerId/active - Update active session (alias for POST)
// ============================================================================

router.put('/:learnerId/active', async (req, res) => {
  try {
    const { learnerId } = req.params;
    const parseResult = sessionDataSchema.safeParse(req.body);

    if (!parseResult.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: parseResult.error.message,
      };
      res.status(400).json(response);
      return;
    }

    const data: SessionData = parseResult.data;

    // Treat heartbeat-only writes as read-through when an active session exists.
    // This prevents session bootstrapping calls from replacing resumable state
    // with an empty session that has null currentCode. (parity with neon-sessions.ts)
    if (!hasSessionMutationPayload(data)) {
      const existingSession = await getActiveSession(learnerId);
      if (existingSession) {
        const response: ApiResponse<Session> = {
          success: true,
          data: existingSession as Session,
        };
        res.json(response);
        return;
      }
    }

    const session = await saveActiveSession(learnerId, data);

    const response: ApiResponse<Session> = {
      success: true,
      data: session,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update session',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// DELETE /api/sessions/:learnerId/active - Clear active session
// ============================================================================

router.delete('/:learnerId/active', async (req, res) => {
  try {
    const { learnerId } = req.params;
    const cleared = await clearActiveSession(learnerId);

    const response: ApiResponse<{ cleared: boolean }> = {
      success: true,
      data: { cleared },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to clear session',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export { router as sessionsRouter };
