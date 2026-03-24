/**
 * Auth Routes
 *
 * POST /api/auth/signup  - Create account (student or instructor)
 * POST /api/auth/login   - Login and receive JWT cookie
 * POST /api/auth/logout  - Clear JWT cookie
 * GET  /api/auth/me      - Return current authenticated user
 */

import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { isUsingNeon, createUser } from '../db/index.js';
import { getDb } from '../db/neon.js';
import {
  createAuthAccount,
  getAuthAccountByEmail,
  getAuthAccountById,
  toPublicAccount,
} from '../db/auth.js';
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  COOKIE_NAME,
  verifyToken,
} from '../middleware/auth.js';
import {
  createCsrfToken,
  setCsrfCookie,
  clearCsrfCookie,
  requireCsrf,
} from '../middleware/csrf.js';
import { INSTRUCTOR_SIGNUP_CODE, STUDENT_SIGNUP_CODE } from '../config.js';

const router = Router();

const SALT_ROUNDS = 12;

// ============================================================================
// Validation schemas
// ============================================================================

const SignupSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['student', 'instructor']),
  classCode: z.string().optional(),
  instructorCode: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

// ============================================================================
// POST /api/auth/signup
// ============================================================================

router.post('/signup', async (req: Request, res: Response) => {
  // Auth routes require Neon (SQLite has no real auth)
  if (!isUsingNeon()) {
    res.status(503).json({
      success: false,
      error: 'Account system requires a Neon database. Running in local SQLite mode.',
    });
    return;
  }

  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, email, password, role, classCode, instructorCode } = parsed.data;

  // Validate student class code
  if (role === 'student') {
    if (!STUDENT_SIGNUP_CODE) {
      res.status(503).json({
        success: false,
        error: 'Student signup is not configured on this server',
      });
      return;
    }
    if (!classCode || classCode !== STUDENT_SIGNUP_CODE) {
      res.status(403).json({
        success: false,
        error: 'Invalid class code',
      });
      return;
    }
  }

  // Validate instructor code
  if (role === 'instructor') {
    if (!INSTRUCTOR_SIGNUP_CODE) {
      res.status(503).json({
        success: false,
        error: 'Instructor signup is not configured on this server',
      });
      return;
    }
    if (!instructorCode || instructorCode !== INSTRUCTOR_SIGNUP_CODE) {
      res.status(403).json({
        success: false,
        error: 'Invalid instructor code',
      });
      return;
    }
  }

  try {
    const db = getDb();

    // Check for duplicate email
    const existing = await getAuthAccountByEmail(db, email);
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'An account with this email already exists',
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create learner profile (users table)
    const learnerId = uuidv4();
    await createUser(learnerId, { name, role });

    // Create auth account
    const account = await createAuthAccount(db, {
      email,
      passwordHash,
      role,
      learnerId,
      name,
    });

    // Issue JWT cookie
    const token = signToken({
      accountId: account.id,
      learnerId: account.learnerId,
      email: account.email,
      role: account.role,
      name: account.name,
    });
    setAuthCookie(res, token);
    const csrfToken = createCsrfToken();
    setCsrfCookie(res, csrfToken);

    res.status(201).json({
      success: true,
      user: toPublicAccount(account),
      csrfToken,
    });
  } catch (err) {
    console.error('[auth/signup]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/auth/login
// ============================================================================

router.post('/login', async (req: Request, res: Response) => {
  if (!isUsingNeon()) {
    res.status(503).json({
      success: false,
      error: 'Account system requires a Neon database. Running in local SQLite mode.',
    });
    return;
  }

  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const db = getDb();
    const account = await getAuthAccountByEmail(db, email);

    // Use timing-safe comparison even if account not found
    const hashToCompare = account?.passwordHash ?? '$2a$12$invalidhashfortimingattackprevention';
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!account || !passwordMatch) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    const token = signToken({
      accountId: account.id,
      learnerId: account.learnerId,
      email: account.email,
      role: account.role,
      name: account.name,
    });
    setAuthCookie(res, token);
    const csrfToken = createCsrfToken();
    setCsrfCookie(res, csrfToken);

    res.json({
      success: true,
      user: toPublicAccount(account),
      csrfToken,
    });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/auth/logout
// ============================================================================

router.post('/logout', requireCsrf, (_req: Request, res: Response) => {
  clearAuthCookie(res);
  clearCsrfCookie(res);
  res.json({ success: true });
});

// ============================================================================
// GET /api/auth/me
// ============================================================================

router.get('/me', (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid or expired session' });
    return;
  }

  // If Neon is available, hydrate from DB to ensure account still exists
  if (isUsingNeon()) {
    const db = getDb();
    getAuthAccountById(db, payload.accountId)
      .then((account) => {
        if (!account) {
          clearAuthCookie(res);
          res.status(401).json({ success: false, error: 'Account not found' });
          return;
        }
        const csrfToken = createCsrfToken();
        setCsrfCookie(res, csrfToken);
        res.json({ success: true, user: toPublicAccount(account), csrfToken });
      })
      .catch((err) => {
        console.error('[auth/me]', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
      });
    return;
  }

  // SQLite mode: return payload claims directly (no real accounts)
  const csrfToken = createCsrfToken();
  setCsrfCookie(res, csrfToken);
  res.json({
    success: true,
    user: {
      id: payload.accountId,
      email: payload.email,
      role: payload.role,
      learnerId: payload.learnerId,
      name: payload.name,
      createdAt: new Date().toISOString(),
    },
    csrfToken,
  });
});

export { router as authRouter };
