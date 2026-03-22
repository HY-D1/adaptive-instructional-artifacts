/**
 * Sessions API Routes - Neon PostgreSQL Implementation
 * Routes mounted at /api/sessions
 */

import { Router, Request, Response } from 'express';
import * as db from '../db/neon.js';
import { requireOwnership } from '../middleware/auth.js';

const router = Router();

// Verify ownership for all :learnerId routes
router.param('learnerId', requireOwnership);

// ============================================================================
// Active Session Endpoints (Frontend Contract)
// ============================================================================

// GET /api/sessions/:learnerId/active - Get active session
router.get('/:learnerId/active', async (req: Request, res: Response) => {
  try {
    const session = await db.getActiveSession(req.params.learnerId);

    if (!session) {
      res.status(404).json({ success: false, error: 'No active session' });
      return;
    }

    // Return in the format expected by frontend
    res.json({
      success: true,
      data: {
        currentProblemId: session.sessionId,
        currentCode: session.lastCode,
        guidanceState: session.guidanceState,
        hdiState: session.hdiState,
        banditState: session.banditState,
        startTime: session.createdAt ? new Date(session.createdAt).toISOString() : undefined,
        lastActivity: session.updatedAt ? new Date(session.updatedAt).toISOString() : undefined,
        // Include raw session data for compatibility
        sessionId: session.sessionId,
        conditionId: session.conditionId,
        textbookDisabled: session.textbookDisabled,
        adaptiveLadderDisabled: session.adaptiveLadderDisabled,
        immediateExplanationMode: session.immediateExplanationMode,
        staticHintMode: session.staticHintMode,
        escalationPolicy: session.escalationPolicy,
      }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session' });
  }
});

// POST /api/sessions/:learnerId/active - Save active session
router.post('/:learnerId/active', async (req: Request, res: Response) => {
  try {
    const {
      currentProblemId,
      currentCode,
      guidanceState,
      hdiState,
      banditState,
      startTime,
      lastActivity,
      // Also accept direct session fields
      sessionId,
      conditionId,
      textbookDisabled,
      adaptiveLadderDisabled,
      immediateExplanationMode,
      staticHintMode,
      escalationPolicy,
    } = req.body;

    // Map frontend format to backend format
    const actualSessionId = sessionId || currentProblemId || `session-${Date.now()}`;
    const actualConditionId = conditionId || 'default';

    await db.saveSession(req.params.learnerId, actualSessionId, actualConditionId, {
      textbookDisabled: textbookDisabled ?? false,
      adaptiveLadderDisabled: adaptiveLadderDisabled ?? false,
      immediateExplanationMode: immediateExplanationMode ?? false,
      staticHintMode: staticHintMode ?? false,
      escalationPolicy: escalationPolicy ?? 'adaptive',
    });

    const session = await db.getSession(req.params.learnerId, actualSessionId);

    res.json({
      success: true,
      data: {
        currentProblemId: session?.sessionId,
        currentCode,
        guidanceState,
        hdiState,
        banditState,
        startTime: startTime || (session?.createdAt ? new Date(session.createdAt).toISOString() : undefined),
        lastActivity: lastActivity || (session?.updatedAt ? new Date(session.updatedAt).toISOString() : undefined),
      }
    });
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ success: false, error: 'Failed to save session' });
  }
});

// PUT /api/sessions/:learnerId/active - Update active session (alias for POST)
router.put('/:learnerId/active', async (req: Request, res: Response) => {
  // Delegate to POST handler logic
  try {
    const {
      currentProblemId,
      currentCode,
      guidanceState,
      hdiState,
      banditState,
      startTime,
      lastActivity,
      sessionId,
      conditionId,
      textbookDisabled,
      adaptiveLadderDisabled,
      immediateExplanationMode,
      staticHintMode,
      escalationPolicy,
    } = req.body;

    const actualSessionId = sessionId || currentProblemId || `session-${Date.now()}`;
    const actualConditionId = conditionId || 'default';

    await db.saveSession(req.params.learnerId, actualSessionId, actualConditionId, {
      textbookDisabled: textbookDisabled ?? false,
      adaptiveLadderDisabled: adaptiveLadderDisabled ?? false,
      immediateExplanationMode: immediateExplanationMode ?? false,
      staticHintMode: staticHintMode ?? false,
      escalationPolicy: escalationPolicy ?? 'adaptive',
    });

    const session = await db.getSession(req.params.learnerId, actualSessionId);

    res.json({
      success: true,
      data: {
        currentProblemId: session?.sessionId,
        currentCode,
        guidanceState,
        hdiState,
        banditState,
        startTime: startTime || (session?.createdAt ? new Date(session.createdAt).toISOString() : undefined),
        lastActivity: lastActivity || (session?.updatedAt ? new Date(session.updatedAt).toISOString() : undefined),
      }
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ success: false, error: 'Failed to update session' });
  }
});

// DELETE /api/sessions/:learnerId/active - Clear active session
router.delete('/:learnerId/active', async (req: Request, res: Response) => {
  try {
    // Get the active session first to find the sessionId
    const activeSession = await db.getActiveSession(req.params.learnerId);

    if (!activeSession) {
      res.status(404).json({ success: false, error: 'No active session' });
      return;
    }

    const cleared = await db.clearSession(req.params.learnerId, activeSession.sessionId);

    if (!cleared) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    res.json({ success: true, cleared: true });
  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({ success: false, error: 'Failed to clear session' });
  }
});

export { router as neonSessionsRouter };
