/**
 * Sessions API Routes - Neon PostgreSQL Implementation
 * Routes mounted at /api/sessions
 */

import { Router, Request, Response } from 'express';
import * as db from '../db/neon.js';
import { requireOwnership } from '../middleware/auth.js';
import type { SessionData } from '../types.js';

const router = Router();

function routeLabel(req: Request): string {
  return `${req.method} ${req.baseUrl}${req.path}`;
}

function logSessionWrite(req: Request, learnerId: string, sectionId: string | null): void {
  console.info('[session/write]', {
    route: routeLabel(req),
    actorRole: req.auth?.role ?? 'anonymous',
    actorId: req.auth?.learnerId ?? null,
    targetLearnerId: learnerId,
    targetSectionId: sectionId,
  });
}

type PersistedSession = Awaited<ReturnType<typeof db.getActiveSession>>;
type SessionWriteBody = SessionData;

function toIsoString(value: number | string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function buildSessionResponse(session: PersistedSession) {
  return {
    currentProblemId: session?.currentProblemId ?? session?.sessionId,
    sectionId: session?.sectionId ?? null,
    currentCode: session?.lastCode,
    guidanceState: session?.guidanceState,
    hdiState: session?.hdiState,
    banditState: session?.banditState,
    startTime: toIsoString(session?.createdAt),
    lastActivity: toIsoString(session?.lastActivity) ?? toIsoString(session?.updatedAt),
    sessionId: session?.sessionId,
    conditionId: session?.conditionId,
    textbookDisabled: session?.textbookDisabled,
    adaptiveLadderDisabled: session?.adaptiveLadderDisabled,
    immediateExplanationMode: session?.immediateExplanationMode,
    staticHintMode: session?.staticHintMode,
    escalationPolicy: session?.escalationPolicy,
  };
}

function hasSessionMutationPayload(body: SessionWriteBody): boolean {
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

function resolveSessionWriteBody(
  learnerId: string,
  body: SessionWriteBody,
  activeSession: PersistedSession,
) {
  return {
    actualSessionId:
      body.sessionId ||
      activeSession?.sessionId ||
      `session-${learnerId}-${Date.now()}`,
    actualConditionId:
      body.conditionId ??
      activeSession?.conditionId ??
      'default',
    mergedSessionData: {
      sectionId: body.sectionId ?? activeSession?.sectionId ?? null,
      currentProblemId: body.currentProblemId ?? activeSession?.currentProblemId ?? null,
      textbookDisabled: body.textbookDisabled ?? activeSession?.textbookDisabled,
      adaptiveLadderDisabled:
        body.adaptiveLadderDisabled ?? activeSession?.adaptiveLadderDisabled,
      immediateExplanationMode:
        body.immediateExplanationMode ?? activeSession?.immediateExplanationMode,
      staticHintMode: body.staticHintMode ?? activeSession?.staticHintMode,
      escalationPolicy: body.escalationPolicy ?? activeSession?.escalationPolicy,
      currentCode: body.currentCode ?? activeSession?.lastCode,
      guidanceState: body.guidanceState ?? activeSession?.guidanceState,
      hdiState: body.hdiState ?? activeSession?.hdiState,
      banditState: body.banditState ?? activeSession?.banditState,
      lastActivity: body.lastActivity,
    } satisfies SessionData,
  };
}

// Verify ownership for all :learnerId routes
router.param('learnerId', requireOwnership);

// ============================================================================
// Active Session Endpoints (Frontend Contract)
// ============================================================================

// GET /api/sessions/:learnerId/active - Get active session
router.get('/:learnerId/active', async (req: Request, res: Response) => {
  try {
    const session = await db.getActiveSession(req.params.learnerId);

    // Return 200 with null data when no active session exists.
    // This is expected for learners without a current session
    // and avoids browser console noise from 404 errors during hydration.
    if (!session) {
      res.json({ success: true, data: null });
      return;
    }

    // Return in the format expected by frontend
    res.json({
      success: true,
      data: buildSessionResponse(session),
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session' });
  }
});

// POST /api/sessions/:learnerId/active - Save active session
router.post('/:learnerId/active', async (req: Request, res: Response) => {
  try {
    const body = req.body as SessionWriteBody;

    // Treat heartbeat-only writes as read-through when an active session exists.
    // This prevents session bootstrapping calls from replacing resumable state
    // with an empty session that has null currentCode.
    if (!hasSessionMutationPayload(body)) {
      const activeSession = await db.getActiveSession(req.params.learnerId);
      if (activeSession) {
        res.json({
          success: true,
          data: buildSessionResponse(activeSession),
        });
        return;
      }
    }

    const activeSession = await db.getActiveSession(req.params.learnerId);
    const { actualSessionId, actualConditionId, mergedSessionData } = resolveSessionWriteBody(
      req.params.learnerId,
      body,
      activeSession,
    );

    await db.saveSession(req.params.learnerId, actualSessionId, actualConditionId, {
      ...mergedSessionData,
    });

    const session = await db.getSession(req.params.learnerId, actualSessionId);

    res.json({
      success: true,
      data: buildSessionResponse(session),
    });
    logSessionWrite(req, req.params.learnerId, session?.sectionId ?? null);
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ success: false, error: 'Failed to save session' });
  }
});

// PUT /api/sessions/:learnerId/active - Update active session (alias for POST)
router.put('/:learnerId/active', async (req: Request, res: Response) => {
  // Delegate to POST handler logic
  try {
    const body = req.body as SessionWriteBody;

    if (!hasSessionMutationPayload(body)) {
      const activeSession = await db.getActiveSession(req.params.learnerId);
      if (activeSession) {
        res.json({
          success: true,
          data: buildSessionResponse(activeSession),
        });
        return;
      }
    }

    const activeSession = await db.getActiveSession(req.params.learnerId);
    const { actualSessionId, actualConditionId, mergedSessionData } = resolveSessionWriteBody(
      req.params.learnerId,
      body,
      activeSession,
    );

    await db.saveSession(req.params.learnerId, actualSessionId, actualConditionId, {
      ...mergedSessionData,
    });

    const session = await db.getSession(req.params.learnerId, actualSessionId);

    res.json({
      success: true,
      data: buildSessionResponse(session),
    });
    logSessionWrite(req, req.params.learnerId, session?.sectionId ?? null);
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
