/**
 * Textbooks API Routes - Neon PostgreSQL Implementation
 */

import { Router, Request, Response } from 'express';
import * as db from '../db/neon.js';

const router = Router();

// ============================================================================
// Textbook Units
// ============================================================================

// GET /api/textbooks/:userId - Get all textbook units for a user
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const units = await db.getTextbookUnitsByUser(req.params.userId);
    res.json({ success: true, data: units });
  } catch (error) {
    console.error('Error fetching textbook units:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch textbook units' });
  }
});

// POST /api/textbooks/:userId/units - Create/update textbook unit
router.post('/:userId/units', async (req: Request, res: Response) => {
  try {
    const {
      unitId,
      type,
      conceptId,
      conceptIds,
      title,
      content,
      contentFormat,
      sourceInteractionIds,
      status,
    } = req.body;

    if (!unitId || !type || !title || !content) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: unitId, type, title, content',
      });
      return;
    }

    const unit = await db.createTextbookUnit(req.params.userId, {
      unitId,
      type,
      conceptIds: conceptIds || (conceptId ? [conceptId] : []),
      title,
      content,
      contentFormat,
      sourceInteractionIds,
      status,
    });

    res.status(201).json({ success: true, data: unit });
  } catch (error) {
    console.error('Error creating textbook unit:', error);
    res.status(500).json({ success: false, error: 'Failed to create textbook unit' });
  }
});

// GET /api/textbooks/:userId/units/:unitId - Get specific unit
router.get('/:userId/units/:unitId', async (req: Request, res: Response) => {
  try {
    const unit = await db.getTextbookUnitById(req.params.userId, req.params.unitId);

    if (!unit) {
      res.status(404).json({ success: false, error: 'Unit not found' });
      return;
    }

    res.json({ success: true, data: unit });
  } catch (error) {
    console.error('Error fetching textbook unit:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch textbook unit' });
  }
});

// DELETE /api/textbooks/:userId/units/:unitId - Delete unit
router.delete('/:userId/units/:unitId', async (req: Request, res: Response) => {
  try {
    const deleted = await db.deleteTextbookUnit(req.params.userId, req.params.unitId);

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Unit not found' });
      return;
    }

    res.json({ success: true, message: 'Unit deleted' });
  } catch (error) {
    console.error('Error deleting textbook unit:', error);
    res.status(500).json({ success: false, error: 'Failed to delete textbook unit' });
  }
});

export { router as neonTextbooksRouter };
