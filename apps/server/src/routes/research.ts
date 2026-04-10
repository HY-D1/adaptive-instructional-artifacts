/**
 * Research API Routes
 * Instructor/researcher endpoints for data export and analysis
 * Returns full InteractionEvents for research replay
 */

import { Router } from 'express';
import {
  getAuthEvents,
  getUserById,
  getInteractionsByUser,
  getTextbookUnitsByUser,
  getAllUsers,
  getInteractionAggregatesByUsers,
  getTextbookUnitCountsByUsers,
} from '../db/neon.js';
import type {
  ApiResponse,
  ClassStats,
  LearnerTrajectory,
  EventType,
  Interaction,
} from '../types.js';
import { getInstructorScopedLearnerIds, getOwnedSectionsByInstructor } from '../db/sections.js';

const router = Router();

export const RESEARCH_EXPORT_FIELDS_PRESERVED = [
  'id', 'learnerId', 'sectionId', 'sessionId', 'timestamp', 'eventType', 'problemId',
  'problemSetId', 'problemNumber', 'code', 'error', 'errorSubtypeId', 'hintId',
  'executionTimeMs', 'rung', 'fromRung', 'toRung', 'trigger', 'conceptId',
  'conceptIds', 'source', 'totalTime', 'problemsAttempted', 'problemsSolved',
  'hdi', 'hdiLevel', 'hdiComponents', 'scheduleId', 'promptId', 'response',
  'isCorrect', 'unitId', 'action', 'sourceInteractionIds', 'retrievedSourceIds',
  'payload', 'metadata', 'createdAt'
];

async function getScopedLearnerIdsForInstructor(instructorUserId: string): Promise<Set<string>> {
  const ids = await getInstructorScopedLearnerIds(instructorUserId);
  return new Set(ids);
}

// ============================================================================
// GET /api/research/aggregates - Class-level statistics
// ============================================================================

router.get('/aggregates', async (req, res) => {
  try {
    const instructorUserId = req.auth!.learnerId;
    const scopedLearnerIds = await getScopedLearnerIdsForInstructor(instructorUserId);
    const learners = (await getAllUsers()).filter((learner) => scopedLearnerIds.has(learner.id));
    
    // Use single aggregated queries instead of N+1 loops
    const learnerIds = learners.map(l => l.id);
    const [aggregates, unitCounts] = await Promise.all([
      getInteractionAggregatesByUsers(learnerIds),
      getTextbookUnitCountsByUsers(learnerIds),
    ]);

    // Sum up textbook unit counts across all learners
    let totalTextbookUnits = 0;
    for (const count of unitCounts.values()) {
      totalTextbookUnits += count;
    }

    const response: ApiResponse<ClassStats> = {
      success: true,
      data: {
        totalLearners: learners.length,
        totalInteractions: aggregates.totalCount,
        interactionsByType: (aggregates.interactionsByType as ClassStats['interactionsByType']) ?? {},
        totalTextbookUnits,
        averageUnitsPerLearner: learners.length > 0 ? totalTextbookUnits / learners.length : 0,
        recentActivity: {
          last24Hours: aggregates.last24Hours ?? 0,
          last7Days: aggregates.last7Days ?? 0,
          last30Days: aggregates.last30Days ?? 0,
        },
      },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch aggregates',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// GET /api/research/learner/:id/trajectory - Single learner timeline
// ============================================================================

router.get('/learner/:id/trajectory', async (req, res) => {
  try {
    const instructorUserId = req.auth!.learnerId;
    const scopedLearnerIds = await getScopedLearnerIdsForInstructor(instructorUserId);
    const { id } = req.params;
    if (!scopedLearnerIds.has(id)) {
      console.warn('[authz/research]', {
        route: `${req.method} ${req.baseUrl}${req.path}`,
        actorRole: req.auth?.role ?? 'unknown',
        actorId: instructorUserId,
        targetLearnerId: id,
        targetSectionId: null,
        reason: 'learner not in instructor scope',
      });
      res.status(403).json({ success: false, error: 'Access denied: learner not in your section' });
      return;
    }
    const learner = await getUserById(id);

    if (!learner) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Learner not found',
      };
      res.status(404).json(response);
      return;
    }

    const interactions = (await getInteractionsByUser(id, { limit: 10000 })).interactions;
    const textbookUnits = await getTextbookUnitsByUser(id);

    // Calculate summary stats
    const uniqueProblems = new Set(interactions.map(i => i.problemId));
    const hintsRequested = interactions.filter(i => i.eventType === 'hint_request').length;
    const explanationsViewed = interactions.filter(i => i.eventType === 'explanation_view').length;
    const escalations = interactions.filter(i => i.eventType === 'guidance_escalate').length;
    const uniqueSessions = new Set(interactions.map(i => i.sessionId).filter(Boolean));
    
    // Calculate HDI stats if available
    const hdiReadings = interactions
      .filter(i => i.hdi !== undefined)
      .map(i => i.hdi as number);
    const averageHdi = hdiReadings.length > 0 
      ? hdiReadings.reduce((a, b) => a + b, 0) / hdiReadings.length 
      : undefined;

    const trajectory: LearnerTrajectory & { 
      hdiStats?: { average: number | null; readings: number; lastLevel?: string | null };
      escalationCount?: number;
    } = {
      learner,
      interactions,
      textbookUnits,
      summary: {
        totalInteractions: interactions.length,
        problemsAttempted: Array.from(uniqueProblems),
        hintsRequested,
        explanationsViewed,
        textbookUnitsCreated: textbookUnits.length,
        sessionCount: uniqueSessions.size,
      },
      escalationCount: escalations,
    };
    
    // Add HDI stats if available
    const lastHdi = interactions.find(i => i.hdiLevel !== undefined);
    trajectory.hdiStats = {
      average: averageHdi !== undefined ? Math.round(averageHdi * 100) / 100 : null,
      readings: hdiReadings.length,
      lastLevel: lastHdi?.hdiLevel ?? null,
    };

    const response: ApiResponse<typeof trajectory> = {
      success: true,
      data: trajectory,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch learner trajectory',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// GET /api/research/export - Full dataset export (lossless)
// ============================================================================

router.get('/export', async (req, res) => {
  try {
    const instructorUserId = req.auth!.learnerId;
    const scopedLearnerIds = await getScopedLearnerIdsForInstructor(instructorUserId);
    const ownedSections = await getOwnedSectionsByInstructor(instructorUserId);
    const format = (req.query.format as string) || 'json';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const learnerIds = req.query.learnerIds ? (req.query.learnerIds as string).split(',') : undefined;
    const eventTypes = req.query.eventTypes ? (req.query.eventTypes as string).split(',') as EventType[] : undefined;

    // Get all learners (filtered if learnerIds provided)
    let learners = await getAllUsers();
    learners = learners.filter((l) => scopedLearnerIds.has(l.id));
    if (learnerIds && learnerIds.length > 0) {
      learners = learners.filter(l => learnerIds.includes(l.id));
    }

    // SAFETY: Limit the number of learners processed to prevent memory exhaustion
    const MAX_LEARNERS_FOR_SUMMARY = 100;
    if (learners.length > MAX_LEARNERS_FOR_SUMMARY) {
      res.status(400).json({
        success: false,
        error: `Too many learners (${learners.length}) for summary. Maximum: ${MAX_LEARNERS_FOR_SUMMARY}. Use filters or the export endpoint with pagination.`,
        code: 'LEARNER_LIMIT_EXCEEDED',
      });
      return;
    }

    // Use SQL-level filtering for interactions instead of loading all then filtering in JS
    // This prevents memory exhaustion with large datasets
    const INTERACTIONS_PER_LEARNER = 10000; // Reduced from 100000 for memory safety
    
    // Build date filter options for SQL
    const dateFilterOptions: { startDate?: string; endDate?: string } = {};
    if (startDate) dateFilterOptions.startDate = new Date(startDate).toISOString();
    if (endDate) dateFilterOptions.endDate = new Date(endDate).toISOString();

    // Fetch interactions with SQL-level filtering
    const interactionsByLearner = await Promise.all(
      learners.map(async (learner) => {
        // If eventTypes are specified, we need to fetch for each type separately
        // because the API supports multiple event types (OR logic)
        if (eventTypes && eventTypes.length > 0) {
          const results = await Promise.all(
            eventTypes.map(eventType =>
              getInteractionsByUser(learner.id, {
                ...dateFilterOptions,
                eventType,
                limit: INTERACTIONS_PER_LEARNER,
              })
            )
          );
          // Merge and deduplicate by interaction id
          const merged = results.flatMap(r => r.interactions);
          const seen = new Set<string>();
          return merged.filter(i => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
          });
        }
        
        // No event type filter - fetch all interactions with date filter
        return getInteractionsByUser(learner.id, {
          ...dateFilterOptions,
          limit: INTERACTIONS_PER_LEARNER,
        }).then(r => r.interactions);
      })
    );

    let filteredInteractions = interactionsByLearner.flat();

    // Get all textbook units for these learners
    const allTextbookUnits: { learnerId: string; units: Awaited<ReturnType<typeof getTextbookUnitsByUser>> }[] = [];
    for (const learner of learners) {
      const units = await getTextbookUnitsByUser(learner.id);
      allTextbookUnits.push({ learnerId: learner.id, units });
    }

    // Calculate summary statistics
    const escalationEvents = filteredInteractions.filter(i => i.eventType === 'guidance_escalate');
    const hdiEvents = filteredInteractions.filter(i => i.hdi !== undefined);
    const banditEvents = filteredInteractions.filter(i => 
      ['bandit_arm_selected', 'bandit_reward_observed', 'bandit_updated'].includes(i.eventType)
    );
    const authEvents = (await getAuthEvents()).filter((event) =>
      event.learnerId !== null && scopedLearnerIds.has(event.learnerId)
    );

    const exportData = {
      exportedAt: new Date().toISOString(),
      filters: {
        startDate,
        endDate,
        learnerIds,
        eventTypes,
      },
      exportMetadata: {
        actorRole: req.auth!.role,
        actorId: instructorUserId,
        sectionIds: ownedSections.map((section) => section.id),
        sectionNames: ownedSections.map((section) => section.name),
      },
      summary: {
        learnerCount: learners.length,
        interactionCount: filteredInteractions.length,
        authEventCount: authEvents.length,
        textbookUnitCount: allTextbookUnits.reduce((sum, l) => sum + l.units.length, 0),
        escalationEventCount: escalationEvents.length,
        hdiReadingCount: hdiEvents.length,
        banditEventCount: banditEvents.length,
        fieldsPreserved: RESEARCH_EXPORT_FIELDS_PRESERVED,
      },
      learners,
      authEvents,
      interactions: filteredInteractions, // Full events preserved
      textbookUnits: allTextbookUnits,
    };

    if (format === 'csv') {
      // Export interactions as CSV with all fields
      const interactionsCsv = convertInteractionsToCsv(filteredInteractions);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="sql-adapt-export-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(interactionsCsv);
      return;
    }

    // Default JSON format
    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to export data',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// GET /api/research/learners - List all learners with summary stats
// ============================================================================

// Default and maximum limits for pagination
const DEFAULT_LEARNERS_PER_PAGE = 50;
const MAX_LEARNERS_PER_PAGE = 200;

router.get('/learners', async (req, res) => {
  try {
    const instructorUserId = req.auth!.learnerId;
    const scopedLearnerIds = await getScopedLearnerIdsForInstructor(instructorUserId);
    let learners = (await getAllUsers()).filter((learner) => scopedLearnerIds.has(learner.id));

    // Pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(
      MAX_LEARNERS_PER_PAGE,
      Math.max(1, parseInt(req.query.perPage as string) || DEFAULT_LEARNERS_PER_PAGE)
    );

    // Apply pagination at the learner level
    const totalLearners = learners.length;
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedLearners = learners.slice(startIndex, endIndex);
    const hasMore = endIndex < totalLearners;
    
    // Reduced limit for individual learner stats to prevent memory issues
    // These are summary stats, not full exports
    const INTERACTIONS_LIMIT = 1000;

    const learnersWithStats = await Promise.all(
      paginatedLearners.map(async (learner) => {
        const interactions = (await getInteractionsByUser(learner.id, { limit: INTERACTIONS_LIMIT })).interactions;
        const textbookUnits = await getTextbookUnitsByUser(learner.id);
        const uniqueProblems = new Set(interactions.map(i => i.problemId));
        
        // Get escalation and HDI stats
        const escalationCount = interactions.filter(i => i.eventType === 'guidance_escalate').length;
        const hdiReadings = interactions.filter(i => i.hdi !== undefined);
        const lastHdi = hdiReadings.length > 0 ? hdiReadings[0] : undefined;
        
        return {
          ...learner,
          stats: {
            totalInteractions: interactions.length,
            problemsAttempted: uniqueProblems.size,
            textbookUnitsCreated: textbookUnits.length,
            escalationCount,
            hdiReadingCount: hdiReadings.length,
            lastHdiLevel: lastHdi?.hdiLevel,
            lastActivity: interactions.length > 0 ? interactions[0].timestamp : null,
          },
        };
      })
    );

    // Add pagination metadata to response
    const responseData = {
      success: true,
      data: learnersWithStats,
      pagination: {
        page,
        perPage,
        total: totalLearners,
        hasMore,
      },
    };

    res.json(responseData);
    return;

    const response: ApiResponse<typeof learnersWithStats> = {
      success: true,
      data: learnersWithStats,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch learners',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

export function convertInteractionsToCsv(interactions: Interaction[]): string {
  const headers = [
    'id',
    'learnerId',
    'sessionId',
    'timestamp',
    'eventType',
    'problemId',
    'hintId',
    'problemSetId',
    'problemNumber',
    'code',
    'error',
    'errorSubtypeId',
    'executionTimeMs',
    'rung',
    'fromRung',
    'toRung',
    'trigger',
    'conceptId',
    'conceptIds',
    'source',
    'totalTime',
    'problemsAttempted',
    'problemsSolved',
    'hdi',
    'hdiLevel',
    'hdiComponents',
    'scheduleId',
    'promptId',
    'response',
    'isCorrect',
    'unitId',
    'action',
    'sourceInteractionIds',
    'retrievedSourceIds',
    'payload',
    'metadata',
    'createdAt',
  ];

  const escapeCsv = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const rows = interactions.map(i => [
    i.id,
    i.learnerId,
    i.sessionId || '',
    i.timestamp,
    i.eventType,
    i.problemId,
    i.hintId || '',
    i.problemSetId || '',
    i.problemNumber?.toString() || '',
    escapeCsv(i.code || ''),
    escapeCsv(i.error || ''),
    i.errorSubtypeId || '',
    i.executionTimeMs?.toString() || '',
    i.rung?.toString() || '',
    i.fromRung?.toString() || '',
    i.toRung?.toString() || '',
    i.trigger || '',
    i.conceptId || '',
    escapeCsv(JSON.stringify(i.conceptIds || [])),
    i.source || '',
    i.totalTime?.toString() || '',
    i.problemsAttempted?.toString() || '',
    i.problemsSolved?.toString() || '',
    i.hdi?.toString() || '',
    i.hdiLevel || '',
    escapeCsv(JSON.stringify(i.hdiComponents || {})),
    i.scheduleId || '',
    i.promptId || '',
    escapeCsv(i.response || ''),
    i.isCorrect?.toString() || '',
    i.unitId || '',
    i.action || '',
    escapeCsv(JSON.stringify(i.sourceInteractionIds || [])),
    escapeCsv(JSON.stringify(i.retrievedSourceIds || [])),
    escapeCsv(JSON.stringify(i.payload || {})),
    escapeCsv(JSON.stringify(i.metadata || {})),
    i.createdAt,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export { router as researchRouter };
