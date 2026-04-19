import { Router, type Request, type Response } from 'express';
import {
  getInteractionsByUser,
  getInteractionsByUsers,
  getTextbookUnitsByUser,
  getUserById,
  getInteractionAggregatesByUsers,
  getTextbookUnitCountsByUsers,
  getActiveLearnerCountsByUsers,
  getLearnerProfilesByIds,
} from '../db/neon.js';
import {
  getInstructorScopedLearnerIds,
  getOwnedSectionsByInstructor,
  getSectionForLearnerInInstructorScope,
} from '../db/sections.js';
import { requireInstructor } from '../middleware/auth.js';

const router = Router();

// Export limits and defaults
const EXPORT_CONFIG = {
  MAX_INTERACTIONS_PER_LEARNER: 10000,
  DEFAULT_PER_PAGE: 1000,
  MAX_PER_PAGE: 5000,
  ESTIMATED_BYTES_PER_INTERACTION: 500, // Approximate memory per interaction
};

router.use(requireInstructor);

const INSTRUCTOR_ANALYTICS_CONCEPT_TOTAL = 6;

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
        interactionsByType: interactionAggregates.interactionsByType ?? {},
        recentActivity: {
          last24Hours: interactionAggregates.last24Hours ?? 0,
          last7Days: interactionAggregates.last7Days ?? 0,
          last30Days: interactionAggregates.last30Days ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('[instructor/overview]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch instructor overview' });
  }
});

router.get('/analytics/summary', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const instructorId = req.auth!.learnerId;
    const [learnerIds, sections] = await Promise.all([
      getInstructorScopedLearnerIds(instructorId),
      getOwnedSectionsByInstructor(instructorId),
    ]);

    const [interactionAggregates, textbookCounts, activeLearnerCounts, profiles] = await Promise.all([
      getInteractionAggregatesByUsers(learnerIds),
      getTextbookUnitCountsByUsers(learnerIds),
      getActiveLearnerCountsByUsers(learnerIds),
      getLearnerProfilesByIds(learnerIds),
    ]);

    let totalTextbookUnits = 0;
    for (const count of textbookCounts.values()) {
      totalTextbookUnits += count;
    }

    const conceptCoverageTotal = profiles.reduce(
      (sum, profile) => sum + (Array.isArray(profile.conceptsCovered) ? profile.conceptsCovered.length : 0),
      0,
    );
    const averageConceptCoverageCount =
      learnerIds.length > 0 ? conceptCoverageTotal / learnerIds.length : 0;
    const averageConceptCoverage = Math.round(
      learnerIds.length > 0
        ? (averageConceptCoverageCount / INSTRUCTOR_ANALYTICS_CONCEPT_TOTAL) * 100
        : 0,
    );

    console.info('[instructor/analytics/summary]', {
      instructorId,
      learnerCount: learnerIds.length,
      profileCount: profiles.length,
      totalInteractions: interactionAggregates.totalCount,
      durationMs: Date.now() - startedAt,
    });

    res.json({
      success: true,
      data: {
        sections: sections.map((section) => ({
          id: section.id,
          name: section.name,
          studentSignupCode: section.studentSignupCode,
        })),
        totalStudents: learnerIds.length,
        activeToday: activeLearnerCounts.last24Hours,
        avgConceptCoverage: averageConceptCoverage,
        avgConceptCoverageCount: averageConceptCoverageCount,
        totalInteractions: interactionAggregates.totalCount,
        totalTextbookUnits,
        interactionsByType: interactionAggregates.interactionsByType ?? {},
        recentActivity: {
          interactionLast24Hours: interactionAggregates.last24Hours ?? 0,
          interactionLast7Days: interactionAggregates.last7Days ?? 0,
          interactionLast30Days: interactionAggregates.last30Days ?? 0,
          activeLearnersLast24Hours: activeLearnerCounts.last24Hours,
          activeLearnersLast7Days: activeLearnerCounts.last7Days,
          activeLearnersLast30Days: activeLearnerCounts.last30Days,
        },
      },
    });
  } catch (error) {
    console.error('[instructor/analytics/summary]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch instructor analytics summary' });
  }
});

router.get('/analytics/interactions', async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const instructorId = req.auth!.learnerId;
    const scopedLearnerIds = await getInstructorScopedLearnerIds(instructorId);
    const requestedLearnerId =
      typeof req.query.learnerId === 'string' && req.query.learnerId.trim().length > 0
        ? req.query.learnerId.trim()
        : null;

    if (requestedLearnerId && !scopedLearnerIds.includes(requestedLearnerId)) {
      res.status(403).json({ success: false, error: 'Access denied: learner not in your section' });
      return;
    }

    const targetLearnerIds = requestedLearnerId ? [requestedLearnerId] : scopedLearnerIds;
    const limit = Math.min(5000, Math.max(1, parseInt((req.query.limit as string) || '1000', 10)));
    const offset = Math.max(0, parseInt((req.query.offset as string) || '0', 10));
    const startDate =
      typeof req.query.start === 'string' && req.query.start.trim().length > 0
        ? new Date(req.query.start).toISOString()
        : undefined;
    const endDate =
      typeof req.query.end === 'string' && req.query.end.trim().length > 0
        ? new Date(req.query.end).toISOString()
        : undefined;

    const result = await getInteractionsByUsers(targetLearnerIds, {
      sessionId: req.query.sessionId as string | undefined,
      eventType: req.query.eventType as string | undefined,
      problemId: req.query.problemId as string | undefined,
      startDate,
      endDate,
      limit,
      offset,
    });

    console.info('[instructor/analytics/interactions]', {
      instructorId,
      requestedLearnerId,
      scopedLearnerCount: targetLearnerIds.length,
      returned: result.interactions.length,
      total: result.total,
      offset,
      limit,
      durationMs: Date.now() - startedAt,
    });

    res.json({
      success: true,
      data: result.interactions,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.interactions.length < result.total,
      },
    });
  } catch (error) {
    console.error('[instructor/analytics/interactions]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch instructor analytics interactions' });
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
          interactionCount: 0,
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
  const startedAt = Date.now();
  try {
    const instructorId = req.auth!.learnerId;
    const learnerIds = await getInstructorScopedLearnerIds(instructorId);
    const sections = await getOwnedSectionsByInstructor(instructorId);

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(
      EXPORT_CONFIG.MAX_PER_PAGE,
      Math.max(1, parseInt(req.query.perPage as string) || EXPORT_CONFIG.DEFAULT_PER_PAGE)
    );
    const useStreaming = req.query.stream === 'true';

    // Calculate pagination for learners
    const startLearnerIndex = (page - 1) * perPage;
    const endLearnerIndex = startLearnerIndex + perPage;
    const paginatedLearnerIds = learnerIds.slice(startLearnerIndex, endLearnerIndex);
    const hasMoreLearners = endLearnerIndex < learnerIds.length;

    // 2. Memory safeguard - estimate payload size before querying
    const estimatedTotalInteractions = paginatedLearnerIds.length * EXPORT_CONFIG.MAX_INTERACTIONS_PER_LEARNER;
    const estimatedBytes = estimatedTotalInteractions * EXPORT_CONFIG.ESTIMATED_BYTES_PER_INTERACTION;
    const MAX_ESTIMATED_BYTES = 100 * 1024 * 1024; // 100MB threshold

    if (estimatedBytes > MAX_ESTIMATED_BYTES && !useStreaming) {
      res.status(413).json({
        success: false,
        error: 'Export request too large. Use streaming mode or reduce pagination size.',
        code: 'PAYLOAD_TOO_LARGE',
        details: {
          estimatedSizeMB: Math.round(estimatedBytes / (1024 * 1024)),
          suggestion: 'Add ?stream=true for large exports',
        },
      });
      return;
    }

    // Fetch learners with pagination
    const learners = (await Promise.all(paginatedLearnerIds.map((id) => getUserById(id)))).filter(
      Boolean
    );

    // 3. Fetch interactions with reduced limit (10000 instead of 100000)
    const interactionsByLearner = await Promise.all(
      paginatedLearnerIds.map(async (learnerId) => {
        const result = await getInteractionsByUser(learnerId, {
          limit: EXPORT_CONFIG.MAX_INTERACTIONS_PER_LEARNER,
        });
        // hasMore is true if we got exactly the limit but total says there's more
        const hasMore = result.interactions.length >= EXPORT_CONFIG.MAX_INTERACTIONS_PER_LEARNER &&
                        result.total > result.interactions.length;
        return {
          learnerId,
          interactions: result.interactions,
          hasMore,
          totalAvailable: result.total,
        };
      })
    );

    // Check if any learner hit the interaction limit
    const learnersWithLimitReached = interactionsByLearner
      .filter((item) => item.hasMore)
      .map((item) => item.learnerId);

    const textbookByLearner = await Promise.all(
      paginatedLearnerIds.map(async (learnerId) => ({
        learnerId,
        units: await getTextbookUnitsByUser(learnerId),
      }))
    );

    const interactions = interactionsByLearner.flatMap((item) => item.interactions);

    // Build warnings if limits were reached
    const warnings: string[] = [];
    if (learnersWithLimitReached.length > 0) {
      warnings.push(
        `Interaction limit (${EXPORT_CONFIG.MAX_INTERACTIONS_PER_LEARNER}) reached for ${learnersWithLimitReached.length} learner(s). Data may be incomplete.`
      );
    }

    console.info('[instructor/export]', {
      instructorId,
      totalLearnersInScope: learnerIds.length,
      returnedLearners: learners.length,
      interactionCount: interactions.length,
      page,
      perPage,
      hasMoreLearners,
      durationMs: Date.now() - startedAt,
    });

    // Streaming response for large exports
    if (useStreaming) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('X-Export-Page', page.toString());
      res.setHeader('X-Export-Per-Page', perPage.toString());
      res.setHeader('X-Export-Has-More', hasMoreLearners.toString());

      // Stream metadata
      res.write(
        JSON.stringify({
          type: 'metadata',
          exportedAt: new Date().toISOString(),
          exportMetadata: {
            actorRole: req.auth!.role,
            actorId: instructorId,
            sectionIds: sections.map((section) => section.id),
            sectionNames: sections.map((section) => section.name),
          },
          pagination: {
            page,
            perPage,
            hasMore: hasMoreLearners,
            totalLearners: learnerIds.length,
            returnedLearners: learners.length,
          },
          warnings: warnings.length > 0 ? warnings : undefined,
        }) + '\n'
      );

      // Stream summary
      res.write(
        JSON.stringify({
          type: 'summary',
          learnerCount: learners.length,
          interactionCount: interactions.length,
          textbookUnitCount: textbookByLearner.reduce((acc, item) => acc + item.units.length, 0),
          fieldsPreserved: ['id', 'learnerId', 'sectionId', 'sessionId', 'timestamp', 'eventType', 'problemId'],
        }) + '\n'
      );

      // Stream learners
      for (const learner of learners) {
        res.write(JSON.stringify({ type: 'learner', data: learner }) + '\n');
      }

      // Stream interactions in batches
      for (const item of interactionsByLearner) {
        for (const interaction of item.interactions) {
          res.write(JSON.stringify({ type: 'interaction', data: interaction }) + '\n');
        }
      }

      // Stream textbook units
      for (const item of textbookByLearner) {
        res.write(JSON.stringify({ type: 'textbookUnit', learnerId: item.learnerId, data: item.units }) + '\n');
      }

      // End marker
      res.write(JSON.stringify({ type: 'end' }) + '\n');
      res.end();
      return;
    }

    // Standard JSON response
    const response: {
      success: boolean;
      data: {
        exportedAt: string;
        exportMetadata: {
          actorRole: string;
          actorId: string;
          sectionIds: string[];
          sectionNames: string[];
        };
        pagination: {
          page: number;
          perPage: number;
          hasMore: boolean;
          totalLearners: number;
          returnedLearners: number;
        };
        summary: {
          learnerCount: number;
          interactionCount: number;
          textbookUnitCount: number;
          fieldsPreserved: string[];
        };
        learners: (typeof learners)[number][];
        interactions: typeof interactions;
        textbookUnits: typeof textbookByLearner;
      };
      warnings?: string[];
    } = {
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        exportMetadata: {
          actorRole: req.auth!.role,
          actorId: instructorId,
          sectionIds: sections.map((section) => section.id),
          sectionNames: sections.map((section) => section.name),
        },
        pagination: {
          page,
          perPage,
          hasMore: hasMoreLearners,
          totalLearners: learnerIds.length,
          returnedLearners: learners.length,
        },
        summary: {
          learnerCount: learners.length,
          interactionCount: interactions.length,
          textbookUnitCount: textbookByLearner.reduce((acc, item) => acc + item.units.length, 0),
          fieldsPreserved: ['id', 'learnerId', 'sectionId', 'sessionId', 'timestamp', 'eventType', 'problemId'],
        },
        learners,
        interactions,
        textbookUnits: textbookByLearner,
      },
    };

    if (warnings.length > 0) {
      response.warnings = warnings;
    }

    res.json(response);
  } catch (error) {
    console.error('[instructor/export]', error);
    res.status(500).json({ success: false, error: 'Failed to export instructor scoped data' });
  }
});

export { router as instructorRouter };
