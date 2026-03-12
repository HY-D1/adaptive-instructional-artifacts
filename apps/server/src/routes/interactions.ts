/**
 * Interactions API Routes
 * Event logging (append-only) with query capabilities
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  createInteraction,
  createInteractionsBatch,
  queryInteractions,
  getAllInteractionsForExport,
} from '../db/index.js';
import type {
  ApiResponse,
  Interaction,
  CreateInteractionRequest,
  PaginatedResponse,
  InteractionQueryParams,
  EventType,
} from '../types.js';

const router = Router();

// Validation schemas
const createInteractionSchema = z.object({
  learnerId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  timestamp: z.string().datetime(),
  eventType: z.string(),
  problemId: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
}) as z.ZodType<CreateInteractionRequest>;

const batchInteractionsSchema = z.object({
  events: z.array(createInteractionSchema as z.ZodType<CreateInteractionRequest>),
});

// Generate UUID
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// GET /api/interactions - Query interactions
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const params: InteractionQueryParams = {
      learnerId: req.query.learnerId as string | undefined,
      sessionId: req.query.sessionId as string | undefined,
      eventType: req.query.eventType as EventType | undefined,
      problemId: req.query.problemId as string | undefined,
      start: req.query.start as string | undefined,
      end: req.query.end as string | undefined,
      limit: req.query.limit as string | undefined,
      offset: req.query.offset as string | undefined,
    };

    const { interactions, total } = await queryInteractions(params);
    const limit = parseInt(params.limit || '100', 10);
    const offset = parseInt(params.offset || '0', 10);

    const response: PaginatedResponse<Interaction> = {
      success: true,
      data: interactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + interactions.length < total,
      },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to query interactions',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/interactions - Log single event
// ============================================================================

router.post('/', async (req, res) => {
  try {
    const parseResult = createInteractionSchema.safeParse(req.body);

    if (!parseResult.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: parseResult.error.message,
      };
      res.status(400).json(response);
      return;
    }

    const data: CreateInteractionRequest = parseResult.data;
    const id = generateId();
    const interaction = await createInteraction(id, data);

    const response: ApiResponse<Interaction> = {
      success: true,
      data: interaction,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create interaction',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/interactions/batch - Log multiple events
// ============================================================================

router.post('/batch', async (req, res) => {
  try {
    const parseResult = batchInteractionsSchema.safeParse(req.body);

    if (!parseResult.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: parseResult.error.message,
      };
      res.status(400).json(response);
      return;
    }

    const { events } = parseResult.data;
    const interactions = await createInteractionsBatch(events);

    const response: ApiResponse<{ count: number; interactions: Interaction[] }> = {
      success: true,
      data: {
        count: interactions.length,
        interactions,
      },
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create interactions batch',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// GET /api/interactions/export - Research export
// ============================================================================

router.get('/export', async (req, res) => {
  try {
    const format = (req.query.format as string) || 'json';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const learnerIds = req.query.learnerIds ? (req.query.learnerIds as string).split(',') : undefined;
    const eventTypesParam = req.query.eventTypes ? (req.query.eventTypes as string).split(',') as EventType[] : undefined;

    const interactions = await getAllInteractionsForExport(startDate, endDate, learnerIds, eventTypesParam);

    if (format === 'csv') {
      // Convert to CSV
      const headers = ['id', 'learnerId', 'sessionId', 'timestamp', 'eventType', 'problemId', 'payload'];
      const rows = interactions.map(i => [
        i.id,
        i.learnerId,
        i.sessionId || '',
        i.timestamp,
        i.eventType,
        i.problemId,
        JSON.stringify(i.payload),
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="interactions.csv"');
      res.send(csv);
      return;
    }

    // Default JSON format
    res.json({
      success: true,
      data: interactions,
      meta: {
        count: interactions.length,
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to export interactions',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export { router as interactionsRouter };
