/**
 * Interactions API Routes
 * Event logging (append-only) with lossless preservation of all fields
 * Supports full InteractionEvent schema for research replay
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  createInteraction,
  createInteractionsBatch,
  queryInteractions,
  getAllInteractionsForExport,
  validateResearchEvent,
  validateResearchBatchForWrite,
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

// ============================================================================
// Validation Schemas - Full InteractionEvent Schema (Lossless)
// ============================================================================

const hdiComponentsSchema = z.object({
  hpa: z.number(),
  aed: z.number(),
  er: z.number(),
  reae: z.number(),
  iwh: z.number(),
});

const banditRewardSchema = z.object({
  total: z.number(),
  components: z.object({
    independentSuccess: z.number(),
    errorReduction: z.number(),
    delayedRetention: z.number(),
    dependencyPenalty: z.number(),
    timeEfficiency: z.number(),
  }),
});

const retrievedChunkSchema = z.object({
  docId: z.string(),
  page: z.number().optional(),
  chunkId: z.string().optional(),
  score: z.number().optional(),
  snippet: z.string().optional(),
});

export const createInteractionSchema = z.object({
  // Required fields
  learnerId: z.string().min(1),
  sessionId: z.string().optional(),
  timestamp: z.string().datetime(),
  eventType: z.string(),
  problemId: z.string().min(1),
  
  // Problem context
  problemSetId: z.string().optional(),
  problemNumber: z.number().optional(),
  
  // Code/Error fields
  code: z.string().optional(),
  error: z.string().optional(),
  errorSubtypeId: z.string().optional(),
  executionTimeMs: z.number().optional(),
  
  // Hint/Explanation fields
  hintId: z.string().optional(),
  explanationId: z.string().optional(),
  hintText: z.string().optional(),
  hintLevel: z.number().optional(),
  helpRequestIndex: z.number().optional(),
  sqlEngageSubtype: z.string().optional(),
  sqlEngageRowId: z.string().optional(),
  
  // Policy/Execution fields
  policyVersion: z.string().optional(),
  timeSpent: z.number().optional(),
  successful: z.boolean().optional(),
  ruleFired: z.string().optional(),
  templateId: z.string().optional(),
  inputHash: z.string().optional(),
  model: z.string().optional(),
  
  // Textbook fields
  noteId: z.string().optional(),
  noteTitle: z.string().optional(),
  noteContent: z.string().optional(),
  
  // Source/Retrieval fields
  retrievedSourceIds: z.array(z.string()).optional(),
  retrievedChunks: z.array(retrievedChunkSchema).optional(),
  triggerInteractionIds: z.array(z.string()).optional(),
  evidenceInteractionIds: z.array(z.string()).optional(),
  sourceInteractionIds: z.array(z.string()).optional(),
  
  // I/O fields
  inputs: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  outputs: z.record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])).optional(),
  
  // Concept fields
  conceptId: z.string().optional(),
  conceptIds: z.array(z.string()).optional(),
  source: z.enum(['problem', 'hint', 'textbook']).optional(),
  totalTime: z.number().optional(),
  problemsAttempted: z.number().optional(),
  problemsSolved: z.number().optional(),
  
  // Guidance Ladder fields
  requestType: z.enum(['hint', 'explanation', 'textbook']).optional(),
  currentRung: z.number().optional(),
  rung: z.number().optional(),
  grounded: z.boolean().optional(),
  contentLength: z.number().optional(),
  fromRung: z.number().optional(),
  toRung: z.number().optional(),
  trigger: z.string().optional(),
  
  // Textbook Unit fields
  unitId: z.string().optional(),
  action: z.enum(['created', 'updated']).optional(),
  dedupeKey: z.string().optional(),
  revisionCount: z.number().optional(),
  
  // Source view fields
  passageCount: z.number().optional(),
  expanded: z.boolean().optional(),
  
  // Chat fields
  chatMessage: z.string().optional(),
  chatResponse: z.string().optional(),
  chatQuickChip: z.string().optional(),
  savedToNotes: z.boolean().optional(),
  textbookUnitsRetrieved: z.array(z.string()).optional(),
  
  // Escalation Profile fields (Week 5)
  profileId: z.string().optional(),
  assignmentStrategy: z.enum(['static', 'diagnostic', 'bandit']).optional(),
  previousThresholds: z.object({ escalate: z.number(), aggregate: z.number() }).optional(),
  newThresholds: z.object({ escalate: z.number(), aggregate: z.number() }).optional(),
  
  // Bandit fields (Week 5)
  selectedArm: z.string().optional(),
  selectionMethod: z.enum(['thompson_sampling', 'epsilon_greedy']).optional(),
  armStatsAtSelection: z.record(z.object({ mean: z.number(), pulls: z.number() })).optional(),
  reward: banditRewardSchema.optional(),
  newAlpha: z.number().optional(),
  newBeta: z.number().optional(),
  
  // HDI fields
  hdi: z.number().optional(),
  hdiLevel: z.enum(['low', 'medium', 'high']).optional(),
  hdiComponents: hdiComponentsSchema.optional(),
  trend: z.enum(['increasing', 'stable', 'decreasing']).optional(),
  slope: z.number().optional(),
  interventionType: z.enum(['forced_independent', 'profile_switch', 'reflective_prompt']).optional(),
  
  // Reinforcement fields
  scheduleId: z.string().optional(),
  promptId: z.string().optional(),
  promptType: z.enum(['mcq', 'sql_completion', 'concept_explanation']).optional(),
  response: z.string().optional(),
  isCorrect: z.boolean().optional(),
  scheduledTime: z.number().optional(),
  shownTime: z.number().optional(),
  
  // Legacy fields for backward compatibility
  payload: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
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
// POST /api/interactions - Log single event (lossless)
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

    // Validate research events (RESEARCH-4 parity with Neon routes)
    const researchValidation = validateResearchEvent(data as unknown as import('../db/index.js').ResearchEventInput);
    if (!researchValidation.valid) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Research validation failed',
        message: `Missing required fields for ${data.eventType}: ${researchValidation.missing.join(', ')}`,
      };
      res.status(400).json(response);
      return;
    }

    const id = generateId();
    const interaction = await createInteraction({ id, ...data });

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
// POST /api/interactions/batch - Log multiple events (lossless)
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

    // Validate research events in batch (RESEARCH-4 parity with Neon routes)
    const researchValidation = validateResearchBatchForWrite(events as unknown as import('../db/index.js').ResearchEventInput[]);
    if (!researchValidation.valid) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Research validation failed',
        message: `Invalid events: ${researchValidation.errors.map((e: import('../db/index.js').BatchValidationError) => `${e.eventType}(${e.eventId}): [${e.missingFields.join(', ')}]`).join('; ')}`,
      };
      res.status(400).json(response);
      return;
    }

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
// GET /api/interactions/export - Research export (full events)
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
      // Convert to CSV with ALL fields for research
      const csv = convertInteractionsToCsv(interactions);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="interactions.csv"');
      res.send(csv);
      return;
    }

    // Default JSON format - full events preserved
    res.json({
      success: true,
      data: interactions,
      meta: {
        count: interactions.length,
        exportedAt: new Date().toISOString(),
        fields: [
          'id', 'learnerId', 'sessionId', 'timestamp', 'eventType', 'problemId',
          'problemSetId', 'problemNumber', 'code', 'error', 'errorSubtypeId',
          'executionTimeMs', 'rung', 'fromRung', 'toRung', 'trigger', 'conceptIds',
          'hdi', 'hdiLevel', 'hdiComponents', 'scheduleId', 'promptId', 'response',
          'isCorrect', 'unitId', 'action', 'sourceInteractionIds', 'retrievedSourceIds',
          'payload', 'metadata', 'createdAt'
        ],
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

// ============================================================================
// Helper: Convert interactions to CSV with all fields
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

export { router as interactionsRouter };
