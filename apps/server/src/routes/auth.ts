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
import { createAuthEvent, getDb } from '../db/neon.js';
import {
  createAuthAccount,
  getAuthAccountByEmail,
  getAuthAccountById,
  type AuthAccountPublic,
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
  CSRF_COOKIE_NAME,
  clearCsrfCookie,
  requireCsrf,
} from '../middleware/csrf.js';
import { INSTRUCTOR_SIGNUP_CODE } from '../config.js';
import {
  createSectionForInstructor,
  enrollStudentInSection,
  getOwnedSectionsByInstructor,
  getSectionBySignupCode,
  getSectionForStudent,
} from '../db/sections.js';

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

// Fast path: minimal context for login response (non-blocking)
// Heavy hydration should be done by the frontend after login
async function withMinimalSectionContext(account: AuthAccountPublic) {
  if (account.role === 'student') {
    // Return minimal context - section can be hydrated via separate API call
    return {
      ...account,
      sectionId: null, // Frontend should fetch via /api/learners/:id/session or similar
      sectionName: null,
    };
  }

  // For instructors, return empty sections array - they can fetch full list via /api/instructor/overview
  return {
    ...account,
    ownedSections: [],
  };
}

// Full context for when explicitly needed (e.g., /api/auth/me)
async function withSectionContext(account: AuthAccountPublic) {
  if (account.role === 'student') {
    const section = await getSectionForStudent(account.learnerId);
    return {
      ...account,
      sectionId: section?.id ?? null,
      sectionName: section?.name ?? null,
    };
  }

  const ownedSections = await getOwnedSectionsByInstructor(account.learnerId);
  return {
    ...account,
    ownedSections: ownedSections.map((section) => ({
      id: section.id,
      name: section.name,
      studentSignupCode: section.studentSignupCode,
    })),
  };
}

function getOrCreateCsrfToken(req: Request, res: Response): string {
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof existingToken === 'string' && existingToken.trim().length > 0) {
    return existingToken;
  }
  const csrfToken = createCsrfToken();
  setCsrfCookie(res, csrfToken);
  return csrfToken;
}

async function logAuthEvent(params: {
  email?: string;
  accountId?: string | null;
  learnerId?: string | null;
  role?: 'student' | 'instructor' | null;
  outcome: 'success' | 'failure';
  failureReason?: string | null;
}): Promise<void> {
  if (!params.email?.trim()) {
    return;
  }

  try {
    await createAuthEvent({
      email: params.email,
      accountId: params.accountId,
      learnerId: params.learnerId,
      role: params.role,
      outcome: params.outcome,
      failureReason: params.failureReason,
    });
  } catch (error) {
    console.warn('[auth/telemetry]', error);
  }
}

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

  const telemetryEmail =
    typeof req.body?.email === 'string' && z.string().email().safeParse(req.body.email).success
      ? req.body.email.trim().toLowerCase()
      : undefined;
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    await logAuthEvent({
      email: telemetryEmail,
      outcome: 'failure',
      failureReason: 'validation_error',
    });
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, email, password, role, classCode, instructorCode } = parsed.data;

  // Validate instructor code
  if (role === 'instructor') {
    if (!INSTRUCTOR_SIGNUP_CODE) {
      await logAuthEvent({
        email,
        role,
        outcome: 'failure',
        failureReason: 'instructor_signup_not_configured',
      });
      res.status(503).json({
        success: false,
        error: 'Instructor signup is not configured on this server',
      });
      return;
    }
    if (!instructorCode || instructorCode !== INSTRUCTOR_SIGNUP_CODE) {
      await logAuthEvent({
        email,
        role,
        outcome: 'failure',
        failureReason: 'invalid_instructor_code',
      });
      res.status(403).json({
        success: false,
        error: 'Invalid instructor code',
      });
      return;
    }
  }

  try {
    const db = getDb();
    let studentSection = null as Awaited<ReturnType<typeof getSectionBySignupCode>>;

    // Validate student class code (section signup code)
    if (role === 'student') {
      if (!classCode?.trim()) {
        await logAuthEvent({
          email,
          role,
          outcome: 'failure',
          failureReason: 'missing_class_code',
        });
        res.status(400).json({
          success: false,
          error: 'Class code is required for student signup',
        });
        return;
      }
      studentSection = await getSectionBySignupCode(classCode);
      if (!studentSection) {
        await logAuthEvent({
          email,
          role,
          outcome: 'failure',
          failureReason: 'invalid_class_code',
        });
        res.status(403).json({
          success: false,
          error: 'Invalid class code',
        });
        return;
      }
    }

    // Check for duplicate email
    const existing = await getAuthAccountByEmail(db, email);
    if (existing) {
      await logAuthEvent({
        email,
        role,
        outcome: 'failure',
        failureReason: 'duplicate_email',
      });
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

    if (role === 'student' && studentSection) {
      await enrollStudentInSection({
        sectionId: studentSection.id,
        studentUserId: learnerId,
      });
    }

    if (role === 'instructor') {
      await createSectionForInstructor({
        instructorUserId: learnerId,
        name: `${name}'s Section`,
      });
    }

    await logAuthEvent({
      email,
      accountId: account.id,
      learnerId: account.learnerId,
      role: account.role,
      outcome: 'success',
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
      user: await withMinimalSectionContext(toPublicAccount(account)),
      csrfToken,
    });
  } catch (err) {
    await logAuthEvent({
      email: telemetryEmail,
      outcome: 'failure',
      failureReason: 'internal_error',
    });
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

  const telemetryEmail =
    typeof req.body?.email === 'string' && z.string().email().safeParse(req.body.email).success
      ? req.body.email.trim().toLowerCase()
      : undefined;
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    await logAuthEvent({
      email: telemetryEmail,
      outcome: 'failure',
      failureReason: 'validation_error',
    });
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
      await logAuthEvent({
        email,
        outcome: 'failure',
        failureReason: 'invalid_credentials',
      });
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
    await logAuthEvent({
      email,
      accountId: account.id,
      learnerId: account.learnerId,
      role: account.role,
      outcome: 'success',
    });

    res.json({
      success: true,
      user: await withMinimalSectionContext(toPublicAccount(account)),
      csrfToken,
    });
  } catch (err) {
    await logAuthEvent({
      email: telemetryEmail,
      outcome: 'failure',
      failureReason: 'internal_error',
    });
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
        const csrfToken = getOrCreateCsrfToken(req, res);
        withSectionContext(toPublicAccount(account))
          .then((userWithContext) => {
            res.json({ success: true, user: userWithContext, csrfToken });
          })
          .catch((contextError) => {
            console.error('[auth/me/context]', contextError);
            res.json({ success: true, user: toPublicAccount(account), csrfToken });
          });
      })
      .catch((err) => {
        console.error('[auth/me]', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
      });
    return;
  }

  // SQLite mode: return payload claims directly (no real accounts)
  const csrfToken = getOrCreateCsrfToken(req, res);
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
