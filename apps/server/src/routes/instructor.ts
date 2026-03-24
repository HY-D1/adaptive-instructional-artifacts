import { Router, type Request, type Response } from 'express';
import {
  getInteractionsByUser,
  getTextbookUnitsByUser,
  getUserById,
} from '../db/neon.js';
import {
  getInstructorScopedLearnerIds,
  getOwnedSectionsByInstructor,
  getSectionForLearnerInInstructorScope,
} from '../db/sections.js';
import { requireInstructor } from '../middleware/auth.js';

const router = Router();

router.use(requireInstructor);

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const instructorId = req.auth!.learnerId;
    const learnerIds = await getInstructorScopedLearnerIds(instructorId);
    const sections = await getOwnedSectionsByInstructor(instructorId);

    let totalInteractions = 0;
    let totalTextbookUnits = 0;

    for (const learnerId of learnerIds) {
      const [interactions, units] = await Promise.all([
        getInteractionsByUser(learnerId, { limit: 5000 }),
        getTextbookUnitsByUser(learnerId),
      ]);
      totalInteractions += interactions.total;
      totalTextbookUnits += units.length;
    }

    res.json({
      success: true,
      data: {
        sections: sections.map((section) => ({
          id: section.id,
          name: section.name,
          studentSignupCode: section.studentSignupCode,
        })),
        learnerCount: learnerIds.length,
        totalInteractions,
        totalTextbookUnits,
      },
    });
  } catch (error) {
    console.error('[instructor/overview]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch instructor overview' });
  }
});

router.get('/learners', async (req: Request, res: Response) => {
  try {
    const instructorId = req.auth!.learnerId;
    const learnerIds = await getInstructorScopedLearnerIds(instructorId);
    const learners = await Promise.all(
      learnerIds.map(async (learnerId) => {
        const [learner, section, interactions] = await Promise.all([
          getUserById(learnerId),
          getSectionForLearnerInInstructorScope({
            instructorUserId: instructorId,
            learnerId,
          }),
          getInteractionsByUser(learnerId, { limit: 1000 }),
        ]);
        return {
          learner,
          section: section
            ? { id: section.id, name: section.name, studentSignupCode: section.studentSignupCode }
            : null,
          interactionCount: interactions.total,
          lastInteractionAt: interactions.interactions[0]?.timestamp ?? null,
        };
      })
    );

    res.json({
      success: true,
      data: learners.filter((item) => item.learner !== null),
    });
  } catch (error) {
    console.error('[instructor/learners]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch instructor learners' });
  }
});

router.get('/learner/:id', async (req: Request, res: Response) => {
  try {
    const instructorId = req.auth!.learnerId;
    const learnerId = req.params.id;
    const section = await getSectionForLearnerInInstructorScope({
      instructorUserId: instructorId,
      learnerId,
    });
    if (!section) {
      res.status(403).json({ success: false, error: 'Access denied: learner not in your section' });
      return;
    }

    const [learner, interactions, textbookUnits] = await Promise.all([
      getUserById(learnerId),
      getInteractionsByUser(learnerId, { limit: 5000 }),
      getTextbookUnitsByUser(learnerId),
    ]);

    if (!learner) {
      res.status(404).json({ success: false, error: 'Learner not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        learner,
        section: { id: section.id, name: section.name, studentSignupCode: section.studentSignupCode },
        interactions: interactions.interactions,
        textbookUnits,
      },
    });
  } catch (error) {
    console.error('[instructor/learner]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch learner detail' });
  }
});

router.get('/export', async (req: Request, res: Response) => {
  try {
    const instructorId = req.auth!.learnerId;
    const learnerIds = await getInstructorScopedLearnerIds(instructorId);
    const sections = await getOwnedSectionsByInstructor(instructorId);

    const learners = await Promise.all(learnerIds.map((id) => getUserById(id)));
    const interactionsByLearner = await Promise.all(
      learnerIds.map(async (learnerId) => ({
        learnerId,
        interactions: (await getInteractionsByUser(learnerId, { limit: 100000 })).interactions,
      }))
    );
    const textbookByLearner = await Promise.all(
      learnerIds.map(async (learnerId) => ({
        learnerId,
        units: await getTextbookUnitsByUser(learnerId),
      }))
    );

    const interactions = interactionsByLearner.flatMap((item) => item.interactions);

    res.json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        exportMetadata: {
          actorRole: req.auth!.role,
          actorId: instructorId,
          sectionIds: sections.map((section) => section.id),
          sectionNames: sections.map((section) => section.name),
        },
        summary: {
          learnerCount: learnerIds.length,
          interactionCount: interactions.length,
          textbookUnitCount: textbookByLearner.reduce((acc, item) => acc + item.units.length, 0),
        },
        learners: learners.filter(Boolean),
        interactions,
        textbookUnits: textbookByLearner,
      },
    });
  } catch (error) {
    console.error('[instructor/export]', error);
    res.status(500).json({ success: false, error: 'Failed to export instructor scoped data' });
  }
});

export { router as instructorRouter };

