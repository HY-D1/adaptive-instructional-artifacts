/**
 * Interactions API Routes - Neon PostgreSQL Implementation
 */

import { Router, Request, Response } from 'express';
import * as db from '../db/neon.js';

const router = Router();

// ============================================================================
// Event Logging
// ============================================================================

// POST /api/interactions - Log single interaction
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    if (!event.learnerId || !event.eventType || !event.problemId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: learnerId, eventType, problemId',
      });
      return;
    }

    const id = event.id || `${event.eventType}-${event.learnerId}-${Date.now()}`;

    const interaction = await db.createInteraction({
      id,
      learnerId: event.learnerId,
      timestamp: event.timestamp || new Date().toISOString(),
      eventType: event.eventType,
      problemId: event.problemId,
      payload: event,
    });

    res.status(201).json({ success: true, data: interaction });
  } catch (error) {
    console.error('Error logging interaction:', error);
    res.status(500).json({ success: false, error: 'Failed to log interaction' });
  }
});

// POST /api/interactions/batch - Log multiple interactions
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      res.status(400).json({
        success: false,
        error: 'Request body must contain an events array',
      });
      return;
    }

    const results = [];
    for (const event of events) {
      const id = event.id || `${event.eventType}-${event.learnerId}-${Date.now()}`;
      const interaction = await db.createInteraction({
        id,
        learnerId: event.learnerId,
        timestamp: event.timestamp || new Date().toISOString(),
        eventType: event.eventType,
        problemId: event.problemId,
        payload: event,
      });
      results.push(interaction);
    }

    res.status(201).json({ success: true, data: { count: results.length } });
  } catch (error) {
    console.error('Error logging interactions batch:', error);
    res.status(500).json({ success: false, error: 'Failed to log interactions' });
  }
});

// GET /api/interactions - Query interactions
router.get('/', async (req: Request, res: Response) => {
  try {
    const { learnerId, sessionId, eventType, problemId, limit, offset } = req.query;

    if (!learnerId) {
      res.status(400).json({
        success: false,
        error: 'learnerId query parameter is required',
      });
      return;
    }

    const result = await db.getInteractionsByUser(learnerId as string, {
      sessionId: sessionId as string | undefined,
      eventType: eventType as string | undefined,
      problemId: problemId as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({
      success: true,
      data: result.interactions,
      pagination: {
        total: result.total,
        limit: limit ? parseInt(limit as string, 10) : result.interactions.length,
        offset: offset ? parseInt(offset as string, 10) : 0,
        hasMore: result.interactions.length < result.total,
      },
    });
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch interactions' });
  }
});

// GET /api/interactions/:id - Get specific interaction
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const interaction = await db.getInteractionById(req.params.id);

    if (!interaction) {
      res.status(404).json({ success: false, error: 'Interaction not found' });
      return;
    }

    res.json({ success: true, data: interaction });
  } catch (error) {
    console.error('Error fetching interaction:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch interaction' });
  }
});

export { router as neonInteractionsRouter };
