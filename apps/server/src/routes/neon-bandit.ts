import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as db from '../db/neon.js';
import {
  banditReadRateLimiter,
  banditRewardRateLimiter,
} from '../middleware/rate-limit.js';

const router = Router();
const rewardSchema = z.object({
  eventId: z.string().min(1),
  selectionEventId: z.string().min(1),
  armId: z.enum(['aggressive', 'conservative', 'explanation-first', 'adaptive']),
  reward: z.number().min(0).max(1),
  assignmentStrategy: z.literal('bandit'),
});

router.get('/state', banditReadRateLimiter, async (req: Request, res: Response) => {
  if (req.auth?.role !== 'student') {
    res.status(403).json({ success: false, error: 'Adaptive bandit is student-only' });
    return;
  }
  const assignment = await db.getStudentConditionAssignment(req.auth.learnerId);
  if (assignment?.conditionId !== 'adaptive') {
    res.status(403).json({ success: false, error: 'Adaptive bandit is unavailable for this condition' });
    return;
  }
  res.json({ success: true, data: await db.getSharedBanditState() });
});

router.post('/reward', banditRewardRateLimiter, async (req: Request, res: Response) => {
  if (req.auth?.role !== 'student') {
    res.status(403).json({ success: false, error: 'Adaptive bandit is student-only' });
    return;
  }
  const parsed = rewardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid bandit reward' });
    return;
  }
  const assignment = await db.getStudentConditionAssignment(req.auth.learnerId);
  if (assignment?.conditionId !== 'adaptive') {
    res.status(403).json({ success: false, error: 'Adaptive bandit is unavailable for this condition' });
    return;
  }
  const result = await db.recordSharedBanditReward({
    ...parsed.data,
    studentId: req.auth.learnerId,
    conditionId: assignment.conditionId,
  });
  res.json({ success: true, data: result });
});

export { router as neonBanditRouter };