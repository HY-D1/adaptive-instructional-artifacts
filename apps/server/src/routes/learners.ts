/**
 * Learners API Routes
 * CRUD operations for learner profiles
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  createLearner,
  getLearnerById,
  getAllLearners,
  updateLearner,
  deleteLearner,
} from '../db/index.js';
import type { ApiResponse, Learner, CreateLearnerRequest, UpdateLearnerRequest } from '../types.js';

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
// GET /api/learners/:id - Get single learner
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
// PUT /api/learners/:id - Update learner
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

export { router as learnersRouter };
