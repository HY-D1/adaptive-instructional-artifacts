/**
 * Research API Routes
 * Instructor/researcher endpoints for data export and analysis
 * Returns full InteractionEvents for research replay
 */

import { Router } from 'express';
import {
  getUserById,
  getInteractionsByUser,
  getTextbookUnitsByUser,
  getAllUsers,
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
    let totalInteractions = 0;
    let totalTextbookUnits = 0;
    const interactionsByType: Record<string, number> = {};
    const now = Date.now();
    let last24Hours = 0;
    let last7Days = 0;
    let last30Days = 0;

    for (const learner of learners) {
      const interactionsResult = await getInteractionsByUser(learner.id, { limit: 5000 });
      const interactions = interactionsResult.interactions;
      const units = await getTextbookUnitsByUser(learner.id);
      totalInteractions += interactionsResult.total;
      totalTextbookUnits += units.length;
      for (const interaction of interactions) {
        interactionsByType[interaction.eventType] = (interactionsByType[interaction.eventType] || 0) + 1;
      }
      for (const interaction of interactions) {
        const ts = new Date(interaction.timestamp).getTime();
        if (now - ts <= 24 * 60 * 60 * 1000) last24Hours++;
        if (now - ts <= 7 * 24 * 60 * 60 * 1000) last7Days++;
        if (now - ts <= 30 * 24 * 60 * 60 * 1000) last30Days++;
      }
    }

    const response: ApiResponse<ClassStats> = {
      success: true,
      data: {
        totalLearners: learners.length,
        totalInteractions,
        interactionsByType: interactionsByType as ClassStats['interactionsByType'],
        totalTextbookUnits,
        averageUnitsPerLearner: learners.length > 0 ? totalTextbookUnits / learners.length : 0,
        recentActivity: {
          last24Hours,
          last7Days,
          last30Days,
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
      hdiStats?: { average: number; readings: number; lastLevel?: string };
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
    if (averageHdi !== undefined) {
      const lastHdi = interactions.find(i => i.hdiLevel !== undefined);
      trajectory.hdiStats = {
        average: Math.round(averageHdi * 100) / 100,
        readings: hdiReadings.length,
        lastLevel: lastHdi?.hdiLevel,
      };
    }

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

    let filteredInteractions = [] as Interaction[];
    for (const learner of learners) {
      const learnerInteractions = (await getInteractionsByUser(learner.id, { limit: 100000 })).interactions;
      filteredInteractions.push(...learnerInteractions);
    }
    if (learnerIds && learnerIds.length > 0) {
      filteredInteractions = filteredInteractions.filter((i) => learnerIds.includes(i.learnerId));
    }
    if (eventTypes && eventTypes.length > 0) {
      filteredInteractions = filteredInteractions.filter(i => eventTypes.includes(i.eventType));
    }
    if (startDate) {
      const startTs = new Date(startDate).getTime();
      filteredInteractions = filteredInteractions.filter((i) => new Date(i.timestamp).getTime() >= startTs);
    }
    if (endDate) {
      const endTs = new Date(endDate).getTime();
      filteredInteractions = filteredInteractions.filter((i) => new Date(i.timestamp).getTime() <= endTs);
    }

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
        textbookUnitCount: allTextbookUnits.reduce((sum, l) => sum + l.units.length, 0),
        escalationEventCount: escalationEvents.length,
        hdiReadingCount: hdiEvents.length,
        banditEventCount: banditEvents.length,
        fieldsPreserved: [
          'id', 'learnerId', 'sectionId', 'sessionId', 'timestamp', 'eventType', 'problemId',
          'problemSetId', 'problemNumber', 'code', 'error', 'errorSubtypeId',
          'executionTimeMs', 'rung', 'fromRung', 'toRung', 'trigger', 'conceptIds',
          'hdi', 'hdiLevel', 'hdiComponents', 'scheduleId', 'promptId', 'response',
          'isCorrect', 'unitId', 'action', 'sourceInteractionIds', 'retrievedSourceIds',
          'payload', 'metadata', 'createdAt'
        ],
      },
      learners,
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

router.get('/learners', async (req, res) => {
  try {
    const instructorUserId = req.auth!.learnerId;
    const scopedLearnerIds = await getScopedLearnerIdsForInstructor(instructorUserId);
    const learners = (await getAllUsers()).filter((learner) => scopedLearnerIds.has(learner.id));
    
    const learnersWithStats = await Promise.all(
      learners.map(async (learner) => {
        const interactions = (await getInteractionsByUser(learner.id, { limit: 10000 })).interactions;
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

function convertInteractionsToCsv(interactions: Interaction[]): string {
  const headers = [
    'id',
    'learnerId',
    'sessionId',
    'timestamp',
    'eventType',
    'problemId',
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
    'conceptIds',
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
    escapeCsv(JSON.stringify(i.conceptIds || [])),
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
