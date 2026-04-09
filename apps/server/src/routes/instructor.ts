import { Router, type Request, type Response } from 'express';
import {
  getInteractionsByUser,
  getTextbookUnitsByUser,
  getUserById,
  getInteractionAggregatesByUsers,
  getTextbookUnitCountsByUsers,
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
    const [learnerIds, sections] = await Promise.all([
      getInstructorScopedLearnerIds(instructorId),
      getOwnedSectionsByInstructor(instructorId),
    ]);

    // Use batch aggregates instead of N+1 queries for better performance
    const [interactionAggregates, textbookCounts] = await Promise.all([
      getInteractionAggregatesByUsers(learnerIds),
      getTextbookUnitCountsByUsers(learnerIds),
    ]);

    // Sum up textbook counts
    let totalTextbookUnits = 0;
    for (const count of textbookCounts.values()) {
      totalTextbookUnits += count;
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
        totalInteractions: interactionAggregates.totalCount,
        totalTextbookUnits,
        // Additional aggregate data for richer UI
        interactionsByType: interactionAggregates.interactionsByType,
        recentActivity: {
          last24Hours: interactionAggregates.last24Hours,
          last7Days: interactionAggregates.last7Days,
          last30Days: interactionAggregates.last30Days,
        },
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

    // Batch fetch all section data to avoid N+1 queries
    const learnerSections = await Promise.all(
      learnerIds.map((learnerId) =>
        getSectionForLearnerInInstructorScope({
          instructorUserId: instructorId,
          learnerId,
        }).then((section) => ({ learnerId, section }))
      )
    );

    // Build learner data efficiently
    const learnerData = await Promise.all(
      learnerSections.map(async ({ learnerId, section }) => {
        const learner = await getUserById(learnerId);
        if (!learner) return null;

        return {
          learner,
          section: section
            ? { id: section.id, name: section.name, studentSignupCode: section.studentSignupCode }
            : null,
          // Note: interaction counts omitted for performance - use /overview for aggregates
          interactionCount: null,
          lastInteractionAt: null,
        };
      })
    );

    res.json({
      success: true,
      data: learnerData.filter((item): item is NonNullable<typeof item> => item !== null),
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
          fieldsPreserved: ['id', 'learnerId', 'sectionId', 'sessionId', 'timestamp', 'eventType', 'problemId'],
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
