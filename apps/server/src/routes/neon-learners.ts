/**
 * Learners API Routes - Neon PostgreSQL Implementation
 */

import { Router, Request, Response } from 'express';
import * as db from '../db/neon.js';
import { requireOwnership } from '../middleware/auth.js';

const router = Router();

// Verify ownership for all :id routes (students can only access their own data)
router.param('id', requireOwnership);

// ============================================================================
// User Management
// ============================================================================

// GET /api/learners - List all users
router.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await db.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// POST /api/learners - Create new user
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, role } = req.body;

    if (!id || !name || !role) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: id, name, role',
      });
      return;
    }

    if (!['student', 'instructor'].includes(role)) {
      res.status(400).json({
        success: false,
        error: 'Role must be "student" or "instructor"',
      });
      return;
    }

    const existing = await db.getUserById(id);
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'User already exists',
      });
      return;
    }

    const user = await db.createUser(id, { name, role });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// GET /api/learners/:id - Get specific user
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await db.getUserById(req.params.id);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// PUT /api/learners/:id - Update user
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, role } = req.body;

    if (role && !['student', 'instructor'].includes(role)) {
      res.status(400).json({
        success: false,
        error: 'Role must be "student" or "instructor"',
      });
      return;
    }

    const user = await db.updateUser(req.params.id, { name, role });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// DELETE /api/learners/:id - Delete user
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await db.deleteUser(req.params.id);

    if (!deleted) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// ============================================================================
// Session Management
// ============================================================================

// GET /api/learners/:id/session - Get active session
router.get('/:id/session', async (req: Request, res: Response) => {
  try {
    const session = await db.getActiveSession(req.params.id);

    if (!session) {
      res.status(404).json({ success: false, error: 'No active session' });
      return;
    }

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session' });
  }
});

// POST /api/learners/:id/session - Save session
router.post('/:id/session', async (req: Request, res: Response) => {
  try {
    const { sessionId, conditionId, ...config } = req.body;

    if (!sessionId || !conditionId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, conditionId',
      });
      return;
    }

    await db.saveSession(req.params.id, sessionId, conditionId, config);
    const session = await db.getSession(req.params.id, sessionId);

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ success: false, error: 'Failed to save session' });
  }
});

// DELETE /api/learners/:id/session/:sessionId - Clear session
router.delete('/:id/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const cleared = await db.clearSession(req.params.id, req.params.sessionId);

    if (!cleared) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    res.json({ success: true, cleared: true });
  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({ success: false, error: 'Failed to clear session' });
  }
});

// ============================================================================
// Problem Progress
// ============================================================================

// GET /api/learners/:id/progress - Get all problem progress
router.get('/:id/progress', async (req: Request, res: Response) => {
  try {
    const progress = await db.getAllProblemProgress(req.params.id);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
});

// GET /api/learners/:id/progress/:problemId - Get specific problem progress
router.get('/:id/progress/:problemId', async (req: Request, res: Response) => {
  try {
    const progress = await db.getProblemProgress(req.params.id, req.params.problemId);

    if (!progress) {
      res.status(404).json({ success: false, error: 'Progress not found' });
      return;
    }

    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
});

// POST /api/learners/:id/progress/:problemId - Update problem progress
router.post('/:id/progress/:problemId', async (req: Request, res: Response) => {
  try {
    const { solved, incrementAttempts, incrementHints, lastCode } = req.body;

    await db.updateProblemProgress(req.params.id, req.params.problemId, {
      solved,
      incrementAttempts,
      incrementHints,
      lastCode,
    });

    const progress = await db.getProblemProgress(req.params.id, req.params.problemId);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ success: false, error: 'Failed to update progress' });
  }
});

// ============================================================================
// Learner Profile (Full Rich Profile)
// ============================================================================

// GET /api/learners/:id/profile - Get learner's full profile
router.get('/:id/profile', async (req: Request, res: Response) => {
  try {
    const profile = await db.getLearnerProfile(req.params.id);

    if (!profile) {
      // Return 404 but also return a default profile structure
      // This allows the frontend to handle missing profiles gracefully
      res.status(404).json({
        success: false,
        error: 'Profile not found',
        data: null,
      });
      return;
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error fetching learner profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch learner profile' });
  }
});

// PUT /api/learners/:id/profile - Save/update learner's full profile
router.put('/:id/profile', async (req: Request, res: Response) => {
  try {
    const {
      name,
      conceptsCovered,
      conceptCoverageEvidence,
      errorHistory,
      interactionCount,
      currentStrategy,
      preferences,
      lastActive,
      extendedData,
    } = req.body;

    const profile = await db.saveLearnerProfile(req.params.id, {
      name,
      conceptsCovered,
      conceptCoverageEvidence,
      errorHistory,
      interactionCount,
      currentStrategy,
      preferences,
      lastActive,
      extendedData,
    });

    if (!profile) {
      res.status(500).json({ success: false, error: 'Failed to save profile' });
      return;
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error saving learner profile:', error);
    res.status(500).json({ success: false, error: 'Failed to save learner profile' });
  }
});

// POST /api/learners/:id/profile/events - Update profile from event
router.post('/:id/profile/events', async (req: Request, res: Response) => {
  try {
    const { event } = req.body;

    if (!event) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: event',
      });
      return;
    }

    const profile = await db.updateLearnerProfileFromEvent(req.params.id, event);

    if (!profile) {
      res.status(500).json({ success: false, error: 'Failed to update profile from event' });
      return;
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error updating profile from event:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile from event' });
  }
});

// GET /api/learners/profiles - Get all learner profiles
router.get('/profiles', async (_req: Request, res: Response) => {
  try {
    const profiles = await db.getAllLearnerProfiles();
    res.json({ success: true, data: profiles });
  } catch (error) {
    console.error('Error fetching all profiles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profiles' });
  }
});

export { router as neonLearnersRouter };
