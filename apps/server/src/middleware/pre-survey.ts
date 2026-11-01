import type { NextFunction, Request, Response } from 'express';
import { getSurveyInvitations } from '../db/neon.js';

export async function requirePreSurveyCompleted(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.auth?.role !== 'student') {
    next();
    return;
  }

  try {
    const preSurvey = (await getSurveyInvitations(req.auth.learnerId))
      .find((invitation) => invitation.instance === 'pre');
    if (preSurvey?.status === 'completed') {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      code: 'PRE_SURVEY_REQUIRED',
      error: 'Complete the pre-activity survey before continuing',
    });
  } catch (error) {
    console.error('[pre-survey/gate]', error);
    res.status(500).json({ success: false, error: 'Unable to verify pre-survey status' });
  }
}