import { expect, test, type Page } from '@playwright/test';

type Role = 'student' | 'instructor';

interface SeedProfile {
  id: string;
  name: string;
  role: Role;
  createdAt: number;
}

interface SeedData {
  profile: SeedProfile;
  profiles?: Array<Record<string, unknown>>;
  interactions?: Array<Record<string, unknown>>;
  textbooks?: Record<string, Array<Record<string, unknown>>>;
  extra?: Record<string, string>;
}

const now = Date.now();

function buildLearnerProfile(id: string, name: string, concepts: string[] = []): Record<string, unknown> {
  return {
    id,
    name,
    createdAt: now - 60_000,
    lastActive: now - 30_000,
    conceptsCovered: concepts,
    conceptCoverageEvidence: [],
    errorHistory: [],
    interactionCount: 0,
    version: 1,
    currentStrategy: 'adaptive-medium',
    preferences: {
      escalationThreshold: 3,
      aggregationDelay: 300_000,
    },
  };
}

function buildTextbookUnit(
  id: string,
  learnerId: string,
  problemId: string,
  conceptId: string,
  title: string
): Record<string, unknown> {
  return {
    id,
    learnerId,
    type: 'explanation',
    conceptId,
    conceptIds: [conceptId],
    problemId,
    title,
    content: `${title} content`,
    contentFormat: 'markdown',
    sourceInteractionIds: [`source-${id}`],
    provenance: { source: 'launch-guard-test' },
    status: 'active',
    prerequisites: [],
    addedTimestamp: now,
  };
}

async function seedStorage(page: Page, data: SeedData): Promise<void> {
  await page.goto('/');
  await page.evaluate((payload) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-welcome-disabled', 'true');
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(payload.profile));
    window.localStorage.setItem('sql-adapt-user-role', payload.profile.role);
    if (payload.profiles) {
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(payload.profiles));
    }
    if (payload.interactions) {
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(payload.interactions));
    }
    if (payload.textbooks) {
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify(payload.textbooks));
    }
    if (payload.extra) {
      Object.entries(payload.extra).forEach(([key, value]) => {
        window.localStorage.setItem(key, value);
      });
    }
  }, data);
}

test.describe('@regression @launch-guard launch readiness regression guards', () => {
  test('textbook visible count matches rendered problem notes', async ({ page }) => {
    const learnerId = 'launch-student-counts';
    const units = [
      buildTextbookUnit('unit-1', learnerId, 'joins-basics', 'joins-basic', 'Join note 1'),
      buildTextbookUnit('unit-2', learnerId, 'joins-basics', 'joins-basic', 'Join note 2'),
      buildTextbookUnit('unit-3', learnerId, 'group-by', 'group-by', 'Group note 1'),
      buildTextbookUnit('unit-4', learnerId, 'group-by', 'group-by', 'Group note 2'),
    ];

    await seedStorage(page, {
      profile: { id: learnerId, name: 'Launch Student', role: 'student', createdAt: now },
      textbooks: { [learnerId]: units },
    });

    await page.goto('/textbook');
    await expect(page.getByRole('heading', { name: 'My Textbook' })).toBeVisible();
    await page.getByTestId('textbook-view-problems').click();

    const noteCountLabel = await page.getByTestId('textbook-total-notes-count').textContent();
    const parsedCount = Number((noteCountLabel || '').replace(/[^\d]/g, ''));
    const renderedCount = await page.getByTestId('textbook-problem-note-item').count();

    expect(parsedCount).toBe(renderedCount);
  });

  test('textbook view and filters persist across refresh', async ({ page }) => {
    const learnerId = 'launch-instructor-textbook';
    const interactions = [
      {
        id: 'attempt-1',
        learnerId,
        sessionId: 'session-1',
        timestamp: now,
        eventType: 'error',
        problemId: 'joins-basics',
        errorSubtypeId: 'missing-join-condition',
      },
    ];

    await seedStorage(page, {
      profile: { id: learnerId, name: 'Launch Instructor', role: 'instructor', createdAt: now },
      interactions,
      textbooks: { [learnerId]: [buildTextbookUnit('unit-keep', learnerId, 'joins-basics', 'joins-basic', 'Persisted note')] },
    });

    await page.goto(`/textbook?learnerId=${learnerId}`);
    await expect(page.getByRole('heading', { name: 'My Textbook' })).toBeVisible();
    await page.getByTestId('textbook-view-problems').click();
    await page.getByTestId('textbook-toggle-filters').click();
    await page.getByTestId('textbook-search-input').fill('joins');
    await page.reload();

    await expect(page.getByTestId('textbook-search-input')).toHaveValue('joins');
    await expect(page.getByTestId('textbook-view-problems')).toHaveClass(/bg-blue-100/);
  });

  test('instructor learner count matches visible learner rows', async ({ page }) => {
    const instructorId = 'launch-instructor-counts';
    const learnerA = buildLearnerProfile('learner-a', 'Learner A', ['select-basic']);
    const learnerB = buildLearnerProfile('learner-b', 'Learner B', ['joins-basic', 'group-by']);

    await seedStorage(page, {
      profile: { id: instructorId, name: 'Instructor One', role: 'instructor', createdAt: now },
      profiles: [learnerA, learnerB],
      interactions: [],
    });

    await page.goto('/instructor-dashboard');
    await expect(page.getByTestId('instructor-total-students-value')).toBeVisible();

    const cardValue = await page.getByTestId('instructor-total-students-value').textContent();
    const totalStudents = Number((cardValue || '').replace(/[^\d]/g, ''));
    const rowCount = await page.getByTestId('instructor-student-row').count();

    expect(totalStudents).toBe(rowCount);
  });

  test('logout and role switch clear scoped UI state keys', async ({ page }) => {
    const instructorId = 'launch-instructor-logout';
    const staleKey = `sql-adapt-ui-state-v1:instructor:${instructorId}:textbook`;

    await seedStorage(page, {
      profile: { id: instructorId, name: 'Instructor Logout', role: 'instructor', createdAt: now },
      extra: { [staleKey]: JSON.stringify({ searchQuery: 'stale' }) },
    });

    await page.goto('/instructor-dashboard');
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);

    const staleKeyExistsAfterLogout = await page.evaluate((key) => window.localStorage.getItem(key), staleKey);
    expect(staleKeyExistsAfterLogout).toBeNull();

    await page.evaluate(() => {
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'launch-student-after-logout',
          name: 'Student After Logout',
          role: 'student',
          createdAt: Date.now(),
        })
      );
      window.localStorage.setItem('sql-adapt-user-role', 'student');
    });
    await page.goto('/practice');
    await expect(page).toHaveURL(/\/practice/);
  });

  test('primary CTA remains stable and icon-only controls stay labeled', async ({ page }) => {
    const instructorId = 'launch-instructor-cta';
    const interactions = [
      {
        id: 'attempt-2',
        learnerId: instructorId,
        sessionId: 'session-2',
        timestamp: now,
        eventType: 'error',
        problemId: 'group-by',
        errorSubtypeId: 'aggregate-misuse',
      },
    ];

    await seedStorage(page, {
      profile: { id: instructorId, name: 'Instructor CTA', role: 'instructor', createdAt: now },
      interactions,
      textbooks: { [instructorId]: [buildTextbookUnit('unit-cta', instructorId, 'group-by', 'group-by', 'CTA note')] },
      profiles: [buildLearnerProfile(instructorId, 'Instructor CTA', ['group-by'])],
    });

    await page.goto('/instructor-dashboard');
    await expect(page.getByTestId('launch-preview-button')).toHaveCount(1);
    await page.reload();
    await expect(page.getByTestId('launch-preview-button')).toHaveCount(1);

    await page.goto(`/textbook?learnerId=${instructorId}`);
    await page.getByTestId('textbook-toggle-filters').click();
    await page.getByTestId('textbook-search-input').fill('group');
    await expect(page.getByRole('button', { name: 'Clear textbook search' })).toBeVisible();
  });
});
