/**
 * Research API Routes
 * Instructor/researcher endpoints for data export and analysis
 */

import { Router } from 'express';
import {
  getClassStats,
  getLearnerById,
  getInteractionsByLearner,
  getTextbookByLearner,
  getAllLearners,
  queryInteractions,
} from '../db/index.js';
import type {
  ApiResponse,
  ClassStats,
  LearnerTrajectory,
  EventType,
  Interaction,
} from '../types.js';

const router = Router();

// ============================================================================
// GET /api/research/aggregates - Class-level statistics
// ============================================================================

router.get('/aggregates', async (_req, res) => {
  try {
    const stats = await getClassStats();

    const response: ApiResponse<ClassStats> = {
      success: true,
      data: {
        totalLearners: stats.totalLearners,
        totalInteractions: stats.totalInteractions,
        interactionsByType: stats.interactionsByType,
        totalTextbookUnits: stats.totalTextbookUnits,
        averageUnitsPerLearner: stats.averageUnitsPerLearner,
        recentActivity: stats.recentActivity,
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
    const { id } = req.params;
    const learner = await getLearnerById(id);

    if (!learner) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Learner not found',
      };
      res.status(404).json(response);
      return;
    }

    const interactions = await getInteractionsByLearner(id);
    const textbookUnits = await getTextbookByLearner(id);

    // Calculate summary stats
    const uniqueProblems = new Set(interactions.map(i => i.problemId));
    const hintsRequested = interactions.filter(i => i.eventType === 'hint_request').length;
    const explanationsViewed = interactions.filter(i => i.eventType === 'explanation_view').length;
    const uniqueSessions = new Set(interactions.map(i => i.sessionId).filter(Boolean));

    const trajectory: LearnerTrajectory = {
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
    };

    const response: ApiResponse<LearnerTrajectory> = {
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
// GET /api/research/export - Full dataset export
// ============================================================================

router.get('/export', async (req, res) => {
  try {
    const format = (req.query.format as string) || 'json';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const learnerIds = req.query.learnerIds ? (req.query.learnerIds as string).split(',') : undefined;
    const eventTypes = req.query.eventTypes ? (req.query.eventTypes as string).split(',') as EventType[] : undefined;

    // Get all learners (filtered if learnerIds provided)
    let learners = await getAllLearners();
    if (learnerIds && learnerIds.length > 0) {
      learners = learners.filter(l => learnerIds.includes(l.id));
    }

    // Get interactions with filters
    const { interactions } = await queryInteractions({
      start: startDate,
      end: endDate,
      limit: '100000', // High limit for exports
    });

    // Filter by learner and event type in memory if needed
    let filteredInteractions = interactions;
    if (learnerIds && learnerIds.length > 0) {
      filteredInteractions = filteredInteractions.filter(i => learnerIds.includes(i.learnerId));
    }
    if (eventTypes && eventTypes.length > 0) {
      filteredInteractions = filteredInteractions.filter(i => eventTypes.includes(i.eventType));
    }

    // Get all textbook units for these learners
    const allTextbookUnits: { learnerId: string; units: Awaited<ReturnType<typeof getTextbookByLearner>> }[] = [];
    for (const learner of learners) {
      const units = await getTextbookByLearner(learner.id);
      allTextbookUnits.push({ learnerId: learner.id, units });
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      filters: {
        startDate,
        endDate,
        learnerIds,
        eventTypes,
      },
      summary: {
        learnerCount: learners.length,
        interactionCount: filteredInteractions.length,
        textbookUnitCount: allTextbookUnits.reduce((sum, l) => sum + l.units.length, 0),
      },
      learners,
      interactions: filteredInteractions,
      textbookUnits: allTextbookUnits,
    };

    if (format === 'csv') {
      // Export as CSV for interactions
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

router.get('/learners', async (_req, res) => {
  try {
    const learners = await getAllLearners();
    
    const learnersWithStats = await Promise.all(
      learners.map(async (learner) => {
        const interactions = await getInteractionsByLearner(learner.id);
        const textbookUnits = await getTextbookByLearner(learner.id);
        const uniqueProblems = new Set(interactions.map(i => i.problemId));
        
        return {
          ...learner,
          stats: {
            totalInteractions: interactions.length,
            problemsAttempted: uniqueProblems.size,
            textbookUnitsCreated: textbookUnits.length,
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
    'payload',
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
    escapeCsv(JSON.stringify(i.payload)),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export { router as researchRouter };
