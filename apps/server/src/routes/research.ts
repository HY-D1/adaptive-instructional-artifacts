/**
 * Research API Routes
 * Instructor/researcher endpoints for data export and analysis
 * Returns full InteractionEvents for research replay
 */

import { Router } from 'express';
import {
  getAuthEventsByLearnerIds,
  getUserById,
  getInteractionsByUser,
  getTextbookUnitsByUser,
  getUsersByIds,
  getInteractionAggregatesByUsers,
  getTextbookUnitCountsByUsers,
} from '../db/neon.js';
import { pseudonymizeLearner, rekeyEmailHash, toCsvCell } from '../lib/research-export.js';
import type {
  ApiResponse,
  ClassStats,
  LearnerTrajectory,
  EventType,
  Interaction,
} from '../types.js';
import {
  getInstructorScopedLearnerIds,
  getOwnedSectionsByInstructor,
  getProductionSections,
} from '../db/sections.js';
import { clientErrorMessage } from '../lib/client-error.js';

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

export async function getProductionSectionIds(): Promise<Set<string>> {
  const sections = await getProductionSections();
  return new Set(sections.map((section) => section.id));
}

// ============================================================================
// GET /api/research/aggregates - Class-level statistics
// ============================================================================

router.get('/aggregates', async (req, res) => {
  try {
    const instructorUserId = req.auth!.learnerId;
    const scopedLearnerIds = await getScopedLearnerIdsForInstructor(instructorUserId);
    const learners = await getUsersByIds([...scopedLearnerIds]);

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
      message: clientErrorMessage(error),
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

    const TRAJECTORY_LIMIT = 10000;
    const trajectoryResult = await getInteractionsByUser(id, { limit: TRAJECTORY_LIMIT });
    const interactions = trajectoryResult.interactions;
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
      truncated?: boolean;
      totalInteractionsAvailable?: number;
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
      truncated: trajectoryResult.total > interactions.length,
      totalInteractionsAvailable: trajectoryResult.total,
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
      message: clientErrorMessage(error),
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// GET /api/research/export - Dataset export (per-learner cap; see summary.truncated)
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

    const includeNames = req.query.includeNames === 'true';

    // Learners in the instructor's scope (filtered if learnerIds provided)
    let learners = await getUsersByIds([...scopedLearnerIds]);
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

    // Fetch interactions with SQL-level filtering; keep totals so truncation is reported
    const perLearner = await Promise.all(
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
          const interactions = merged.filter(i => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
          });
          return {
            learnerId: learner.id,
            interactions,
            total: results.reduce((sum, r) => sum + r.total, 0),
          };
        }

        // No event type filter - fetch all interactions with date filter
        const result = await getInteractionsByUser(learner.id, {
          ...dateFilterOptions,
          limit: INTERACTIONS_PER_LEARNER,
        });
        return { learnerId: learner.id, interactions: result.interactions, total: result.total };
      })
    );
    const interactionsByLearner = perLearner.map((item) => item.interactions);
    const truncatedLearners = perLearner
      .filter((item) => item.total > item.interactions.length)
      .map((item) => ({ learnerId: item.learnerId, returned: item.interactions.length, total: item.total }));

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
    const authEvents = (await getAuthEventsByLearnerIds(learners.map((learner) => learner.id)))
      .map((event) => ({ ...event, emailHash: rekeyEmailHash(event.emailHash) }));

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
        interactionLimitPerLearner: INTERACTIONS_PER_LEARNER,
        truncated: truncatedLearners.length > 0,
        truncatedLearners,
        pseudonymized: !includeNames,
      },
      learners: learners.map((learner) => pseudonymizeLearner(learner, includeNames)),
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
      message: clientErrorMessage(error),
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
    const learners = await getUsersByIds([...scopedLearnerIds]);

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
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch learners',
      message: clientErrorMessage(error),
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

  const jsonDefaults: Record<string, string> = {
    conceptIds: '[]',
    hdiComponents: '{}',
    sourceInteractionIds: '[]',
    retrievedSourceIds: '[]',
    payload: '{}',
    metadata: '{}',
  };

  const rows = interactions.map((interaction) => {
    const record = interaction as unknown as Record<string, unknown>;
    return headers.map((header) => toCsvCell(record[header], jsonDefaults[header] ?? ''));
  });

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export { router as researchRouter };
