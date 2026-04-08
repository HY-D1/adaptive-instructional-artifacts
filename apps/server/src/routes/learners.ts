/**
 * Learners API Routes
 * CRUD operations for learner profiles + full rich profile support
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  createLearner,
  getLearnerById,
  getAllLearners,
  updateLearner,
  deleteLearner,
  saveLearnerProfile,
  getLearnerProfile,
  getAllLearnerProfiles,
  updateProfileFromEvent,
  appendProfileEvents,
} from '../db/index.js';
import type { 
  ApiResponse, 
  Learner, 
  LearnerProfile,
  CreateLearnerRequest, 
  UpdateLearnerRequest,
} from '../types.js';

const router = Router();

// Validation schemas
const createLearnerSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(['student', 'instructor']),
});

const updateLearnerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['student', 'instructor']).optional(),
});

const saveProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  conceptsCovered: z.array(z.string()).optional(),
  conceptCoverageEvidence: z.record(z.object({
    conceptId: z.string(),
    score: z.number(),
    confidence: z.enum(['low', 'medium', 'high']),
    lastUpdated: z.number(),
    evidenceCounts: z.object({
      successfulExecution: z.number(),
      hintViewed: z.number(),
      explanationViewed: z.number(),
      errorEncountered: z.number(),
      notesAdded: z.number(),
    }),
    streakCorrect: z.number(),
    streakIncorrect: z.number(),
  })).optional(),
  errorHistory: z.record(z.number()).optional(),
  interactionCount: z.number().optional(),
  currentStrategy: z.string().optional(),
  preferences: z.object({
    escalationThreshold: z.number(),
    aggregationDelay: z.number(),
  }).optional(),
  lastActive: z.number().optional(),
});

const updateFromEventSchema = z.object({
  event: z.object({
    learnerId: z.string(),
    sessionId: z.string().optional(),
    timestamp: z.string(),
    eventType: z.string().transform(val => val as import('../types.js').EventType),
    problemId: z.string(),
    problemSetId: z.string().optional(),
    problemNumber: z.number().optional(),
    code: z.string().optional(),
    error: z.string().optional(),
    errorSubtypeId: z.string().optional(),
    executionTimeMs: z.number().optional(),
    rung: z.number().optional(),
    fromRung: z.number().optional(),
    toRung: z.number().optional(),
    trigger: z.string().optional(),
    conceptIds: z.array(z.string()).optional(),
    hdi: z.number().optional(),
    hdiLevel: z.enum(['low', 'medium', 'high']).optional(),
    hdiComponents: z.object({
      hpa: z.number(),
      aed: z.number(),
      er: z.number(),
      reae: z.number(),
      iwh: z.number(),
    }).optional(),
    scheduleId: z.string().optional(),
    promptId: z.string().optional(),
    response: z.string().optional(),
    isCorrect: z.boolean().optional(),
    unitId: z.string().optional(),
    action: z.enum(['created', 'updated']).optional(),
    sourceInteractionIds: z.array(z.string()).optional(),
    retrievedSourceIds: z.array(z.string()).optional(),
    payload: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

const batchEventsSchema = z.object({
  events: z.array(z.object({
    learnerId: z.string(),
    sessionId: z.string().optional(),
    timestamp: z.string(),
    eventType: z.string().transform(val => val as import('../types.js').EventType),
    problemId: z.string(),
    problemSetId: z.string().optional(),
    problemNumber: z.number().optional(),
    code: z.string().optional(),
    error: z.string().optional(),
    errorSubtypeId: z.string().optional(),
    conceptIds: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
    payload: z.record(z.unknown()).optional(),
  })),
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
// GET /api/learners - List all learners
// ============================================================================

router.get('/', async (_req, res) => {
  try {
    const learners = await getAllLearners();
    const response: ApiResponse<Learner[]> = {
      success: true,
      data: learners,
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
// GET /api/learners/:id - Get single learner (basic info)
// ============================================================================

router.get('/:id', async (req, res) => {
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

    const response: ApiResponse<Learner> = {
      success: true,
      data: learner,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch learner',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/learners - Create new learner
// ============================================================================

router.post('/', async (req, res) => {
  try {
    const parseResult = createLearnerSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: parseResult.error.message,
      };
      res.status(400).json(response);
      return;
    }

    const data: CreateLearnerRequest = parseResult.data;
    const id = generateId();
    const learner = await createLearner(id, data);

    const response: ApiResponse<Learner> = {
      success: true,
      data: learner,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create learner',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// PUT /api/learners/:id - Update learner basic info
// ============================================================================

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const parseResult = updateLearnerSchema.safeParse(req.body);

    if (!parseResult.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: parseResult.error.message,
      };
      res.status(400).json(response);
      return;
    }

    const data: UpdateLearnerRequest = parseResult.data;
    const learner = await updateLearner(id, data);

    if (!learner) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Learner not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Learner> = {
      success: true,
      data: learner,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update learner',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// DELETE /api/learners/:id - Delete learner
// ============================================================================

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteLearner(id);

    if (!deleted) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Learner not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<{ id: string }> = {
      success: true,
      data: { id },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to delete learner',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// GET /api/learners/:id/profile - Get full learner profile
// ============================================================================

router.get('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await getLearnerProfile(id);

    if (!profile) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Profile not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<LearnerProfile> = {
      success: true,
      data: profile,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to get profile',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// PUT /api/learners/:id/profile - Update full learner profile
// ============================================================================

router.put('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const parseResult = saveProfileSchema.safeParse(req.body);

    if (!parseResult.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: parseResult.error.message,
      };
      res.status(400).json(response);
      return;
    }

    // Get existing profile or create new
    let profile = await getLearnerProfile(id);
    
    if (!profile) {
      // Check if learner exists
      const learner = await getLearnerById(id);
      if (!learner) {
        const response: ApiResponse<never> = {
          success: false,
          error: 'Learner not found',
        };
        res.status(404).json(response);
        return;
      }

      // Create new profile
      profile = {
        id,
        name: learner.name,
        conceptsCovered: [],
        conceptCoverageEvidence: {},
        errorHistory: {},
        solvedProblemIds: [],
        interactionCount: 0,
        currentStrategy: 'adaptive',
        preferences: {
          escalationThreshold: 2,
          aggregationDelay: 300000,
        },
        createdAt: Date.now(),
        lastActive: Date.now(),
      };
    }

    // Apply updates
    const data = parseResult.data;
    if (data.name !== undefined) profile.name = data.name;
    if (data.conceptsCovered !== undefined) profile.conceptsCovered = data.conceptsCovered;
    if (data.conceptCoverageEvidence !== undefined) profile.conceptCoverageEvidence = data.conceptCoverageEvidence;
    if (data.errorHistory !== undefined) profile.errorHistory = data.errorHistory;
    if (data.interactionCount !== undefined) profile.interactionCount = data.interactionCount;
    if (data.currentStrategy !== undefined) profile.currentStrategy = data.currentStrategy;
    if (data.preferences !== undefined) profile.preferences = data.preferences;
    profile.lastActive = Date.now();

    await saveLearnerProfile(profile);

    const response: ApiResponse<LearnerProfile> = {
      success: true,
      data: profile,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to save profile',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/learners/:id/profile/events - Update profile from single event
// ============================================================================

router.post('/:id/profile/events', async (req, res) => {
  try {
    const { id } = req.params;
    const parseResult = updateFromEventSchema.safeParse(req.body);

    if (!parseResult.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: parseResult.error.message,
      };
      res.status(400).json(response);
      return;
    }

    const { event } = parseResult.data;
    
    // Ensure the event learnerId matches the URL parameter
    event.learnerId = id;

    const profile = await updateProfileFromEvent(id, event);

    if (!profile) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Learner not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<LearnerProfile> = {
      success: true,
      data: profile,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update profile from event',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/learners/:id/profile/events/batch - Batch update profile from events
// ============================================================================

router.post('/:id/profile/events/batch', async (req, res) => {
  try {
    const { id } = req.params;
    const parseResult = batchEventsSchema.safeParse(req.body);

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
    
    // Ensure all events have the correct learnerId
    events.forEach(event => {
      event.learnerId = id;
    });

    const profile = await appendProfileEvents(id, events);

    if (!profile) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Learner not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<LearnerProfile> = {
      success: true,
      data: profile,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to batch update profile from events',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// GET /api/learners/profiles - Get all profiles (for instructor dashboard)
// ============================================================================

router.get('/profiles', async (_req, res) => {
  try {
    const profiles = await getAllLearnerProfiles();
    const response: ApiResponse<LearnerProfile[]> = {
      success: true,
      data: profiles,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to get profiles',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export { router as learnersRouter };
