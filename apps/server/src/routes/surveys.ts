import { Router, Request, Response } from 'express';
import * as db from '../db/neon.js';
import { verifySurveyCompletionToken } from '../lib/survey-links.js';
import { strictRateLimiter } from '../middleware/rate-limit.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function isSurveyInstance(value: unknown): value is db.SurveyInstance {
  return value === 'pre' || value === 'post';
}

export function buildSurveyAppRedirect(path: string): string {
  const base = process.env.WEB_APP_BASE_URL?.trim();
  if (!base) {
    throw new Error('WEB_APP_BASE_URL is not configured; refusing survey redirect');
  }
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

function redirectToSurveyApp(res: Response, path: string): void {
  try {
    res.redirect(buildSurveyAppRedirect(path));
  } catch (error) {
    console.error('[surveys/redirect]', error instanceof Error ? error.message : String(error));
    res.status(500).json({ success: false, error: 'Survey completion redirect is not configured' });
  }
}

export async function getSurveyInvitationsForViewer(
  userId: string,
  role: 'student' | 'instructor',
): Promise<db.SurveyInvitation[]> {
  let invitations = await db.getSurveyInvitations(userId);
  if (role !== 'student' || invitations.some((invitation) => invitation.instance === 'pre')) {
    return invitations;
  }

  await db.ensureSurveyInvitation(userId, 'pre');
  invitations = await db.getSurveyInvitations(userId);
  return invitations;
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const invitations = await getSurveyInvitationsForViewer(req.auth!.learnerId, req.auth!.role);
    res.json({ success: true, data: invitations });
  } catch (error) {
    console.error('[surveys/list]', error);
    res.status(500).json({ success: false, error: 'Failed to load survey invitations' });
  }
});

router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const preSurvey = (await getSurveyInvitationsForViewer(req.auth!.learnerId, req.auth!.role))
      .find((invitation) => invitation.instance === 'pre');
    res.json({
      success: true,
      data: {
        completed: preSurvey?.status === 'completed',
        username: preSurvey?.username ?? null,
      },
    });
  } catch (error) {
    console.error('[surveys/status]', error);
    res.status(500).json({ success: false, error: 'Failed to load pre-survey status' });
  }
});

router.post('/:instance', requireAuth, async (req: Request, res: Response) => {
  if (!isSurveyInstance(req.params.instance)) {
    res.status(400).json({ success: false, error: 'Invalid survey instance' });
    return;
  }

  try {
    const invitation = await db.ensureSurveyInvitation(req.auth!.learnerId, req.params.instance);
    res.json({ success: true, data: invitation });
  } catch (error) {
    console.error('[surveys/create]', error);
    res.status(500).json({ success: false, error: 'Failed to create survey invitation' });
  }
});

router.get('/complete', strictRateLimiter, async (req: Request, res: Response) => {
  const instance = req.query.instance;
  const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';
  const token = typeof req.query.completion_token === 'string'
    ? req.query.completion_token
    : '';
  const responseId = typeof req.query.ResponseID === 'string'
    ? req.query.ResponseID.trim()
    : '';

  if (!isSurveyInstance(instance) || !username || !responseId) {
    redirectToSurveyApp(res, '/pre-survey-required?reason=survey-link-invalid');
    return;
  }
  const verified = verifySurveyCompletionToken(token, instance);
  if (!verified || verified.username !== username) {
    redirectToSurveyApp(res, '/pre-survey-required?reason=survey-link-expired');
    return;
  }
  try {
    const invitation = await db.completeSurveyInvitation(
      verified.username,
      instance,
      verified.invitationNonce,
      responseId,
    );
    if (!invitation) {
      redirectToSurveyApp(res, '/pre-survey-required?reason=survey-link-invalid');
      return;
    }
    redirectToSurveyApp(res, '/practice');
  } catch (error) {
    console.error('[surveys/complete]', error);
    redirectToSurveyApp(res, '/pre-survey-required?reason=survey-link-unavailable');
  }
});

export { router as surveysRouter };