/**
 * Textbooks API Routes
 * CRUD operations for learner textbook units
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  upsertTextbookUnit,
  getTextbookByLearner,
  deleteTextbookUnit,
  getTextbookUnit,
} from '../db/index.js';
import type {
  ApiResponse,
  InstructionalUnit,
  CreateUnitRequest,
  UpdateUnitRequest,
} from '../types.js';

const router = Router();

// Validation schemas
const createUnitSchema = z.object({
  unitId: z.string().min(1),
  type: z.enum(['hint', 'explanation', 'example', 'summary']),
  conceptIds: z.array(z.string()).optional(),
  title: z.string().min(1),
  content: z.string(),
  contentFormat: z.enum(['markdown', 'html']).optional(),
  sourceInteractionIds: z.array(z.string()).optional(),
  status: z.enum(['primary', 'alternative', 'archived']).optional(),
});

const updateUnitSchema = z.object({
  type: z.enum(['hint', 'explanation', 'example', 'summary']).optional(),
  conceptIds: z.array(z.string()).optional(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  contentFormat: z.enum(['markdown', 'html']).optional(),
  sourceInteractionIds: z.array(z.string()).optional(),
  status: z.enum(['primary', 'alternative', 'archived']).optional(),
});

// ============================================================================
// GET /api/textbooks/:learnerId - Get learner's textbook
// ============================================================================

router.get('/:learnerId', async (req, res) => {
  try {
    const { learnerId } = req.params;
    const units = await getTextbookByLearner(learnerId);

    const response: ApiResponse<InstructionalUnit[]> = {
      success: true,
      data: units,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch textbook',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// GET /api/textbooks/:learnerId/units/:unitId - Get specific unit
// ============================================================================

router.get('/:learnerId/units/:unitId', async (req, res) => {
  try {
    const { learnerId, unitId } = req.params;
    const unit = await getTextbookUnit(learnerId, unitId);

    if (!unit) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Unit not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<InstructionalUnit> = {
      success: true,
      data: unit,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// POST /api/textbooks/:learnerId/units - Add/update unit
// ============================================================================

router.post('/:learnerId/units', async (req, res) => {
  try {
    const { learnerId } = req.params;
    const parseResult = createUnitSchema.safeParse(req.body);

    if (!parseResult.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: parseResult.error.message,
      };
      res.status(400).json(response);
      return;
    }

    const data: CreateUnitRequest = parseResult.data;
    const unit = await upsertTextbookUnit(learnerId, data.unitId, data);

    const response: ApiResponse<InstructionalUnit> = {
      success: true,
      data: unit,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// PUT /api/textbooks/:learnerId/units/:unitId - Update unit
// ============================================================================

router.put('/:learnerId/units/:unitId', async (req, res) => {
  try {
    const { learnerId, unitId } = req.params;
    const parseResult = updateUnitSchema.safeParse(req.body);

    if (!parseResult.success) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Validation failed',
        message: parseResult.error.message,
      };
      res.status(400).json(response);
      return;
    }

    const data: UpdateUnitRequest = parseResult.data;
    
    // Check if unit exists
    const existing = await getTextbookUnit(learnerId, unitId);
    if (!existing) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Unit not found',
      };
      res.status(404).json(response);
      return;
    }

    const unit = await upsertTextbookUnit(learnerId, unitId, data);

    const response: ApiResponse<InstructionalUnit> = {
      success: true,
      data: unit,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// DELETE /api/textbooks/:learnerId/units/:unitId - Remove unit
// ============================================================================

router.delete('/:learnerId/units/:unitId', async (req, res) => {
  try {
    const { learnerId, unitId } = req.params;
    const deleted = await deleteTextbookUnit(learnerId, unitId);

    if (!deleted) {
      const response: ApiResponse<never> = {
        success: false,
        error: 'Unit not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<{ learnerId: string; unitId: string }> = {
      success: true,
      data: { learnerId, unitId },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to delete unit',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export { router as textbooksRouter };
