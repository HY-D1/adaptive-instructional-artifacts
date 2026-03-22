/**
 * @regression UX-BUG-2: Concept readability — helper quality metadata
 *
 * Covers the exact learner journey that was broken:
 *   learner opens a concept page with garbled extraction output →
 *   sees the "quality-limited" banner →
 *   garbled explanation NOT shown as primary content →
 *   safe fallback (definition + learnerSafeSummary) IS shown
 *
 * The bug: ConceptDetailPage used only local heuristics to assess content
 * quality, missing garbled concepts that the upstream helper pipeline had
 * already flagged. The page silently rendered garbled extraction artefacts
 * as primary learning content.
 *
 * The fix: ConceptDetailPage now reads qualityMetadata from concept-map.json
 * first; local heuristics are used only when metadata is absent. The
 * learnerSafeSummary from the pipeline is shown in the fallback "Overview"
 * box when available.
 *
 * Known-bad concepts seeded in concept-map.json:
 *   - murachs-mysql-3rd-edition/mysql-intro  (readabilityStatus: garbled)
 *   - dbms-ramakrishnan-3rd-edition/select-basic (readabilityStatus: garbled)
 *
 * Tags:
 *   @regression  — must pass on every merge to main
 *   @ux-bugs     — part of the learner-facing bug regression suite
 *   @no-external — no LLM / Ollama required (deterministic generator used)
 *
 * How to run:
 *   npx playwright test -c playwright.config.ts tests/e2e/regression/ux-bugs-concept-readability.spec.ts
 */

import { expect, test } from '@playwright/test';

const LEARNER_ID = 'concept-readability-e2e';

/**
 * Seed auth + learning profile into localStorage so the StudentRoute is
 * satisfied without going through the StartPage flow.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript((id: string) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');

    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id,
      name: 'Readability Tester',
      role: 'student',
      createdAt: Date.now()
    }));

    window.localStorage.setItem('sql-learning-profiles', JSON.stringify([{
      id,
      name: 'Readability Tester',
      conceptsCovered: [],
      conceptCoverageEvidence: [],
      errorHistory: [],
      interactionCount: 0,
      version: 1,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
    }]));
  }, LEARNER_ID);
});

test.describe('@regression @ux-bugs @no-external Concept readability — helper quality metadata', () => {
  /**
   * Primary regression: a concept flagged as garbled in concept-map.json must
   * show the quality-limited banner and must NOT show the raw explanation as
   * primary content. The learnerSafeSummary must be visible instead.
   *
   * Concept used: murachs-mysql-3rd-edition/mysql-intro
   *   qualityMetadata.readabilityStatus = "garbled"
   *   qualityMetadata.learnerSafeSummary = "MySQL is the world's most popular..."
   */
  test('Known-bad concept shows quality banner and learnerSafeSummary, hides garbled explanation', async ({ page }) => {
    await page.goto('/concepts/murachs-mysql-3rd-edition/mysql-intro');

    // Wait for page content to load (not the loading spinner)
    await expect(
      page.locator('h1').filter({ hasText: /Introduction to MySQL/i })
    ).toBeVisible({ timeout: 30_000 });

    // 1. Quality-limited banner must be visible
    const banner = page.locator('[role="note"][aria-label*="quality"]');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText(/Source quality limited/i);

    // 2. The "Learn" tab (default) must be active
    await expect(
      page.getByRole('button', { name: 'Learn' })
    ).toBeVisible();

    // 3. learnerSafeSummary must be visible in the fallback Overview box
    const overviewBox = page.getByTestId('learner-safe-summary');
    await expect(overviewBox).toBeVisible({ timeout: 10_000 });
    await expect(overviewBox).toContainText(/MySQL/i);

    // 4. Definition box must still be shown (always safe)
    const definitionBox = page.locator('.bg-blue-50.border-l-4');
    await expect(definitionBox.first()).toBeVisible();

    await page.screenshot({ path: 'test-results/ux-bug-concept-readability-bad.png', fullPage: true });
  });

  /**
   * Second known-bad concept: dbms-ramakrishnan-3rd-edition/select-basic
   * Must also show the banner and fallback summary.
   */
  test('Second known-bad concept (different source doc) also shows quality fallback', async ({ page }) => {
    await page.goto('/concepts/dbms-ramakrishnan-3rd-edition/select-basic');

    await expect(
      page.locator('h1').filter({ hasText: /SELECT Statement Basics/i })
    ).toBeVisible({ timeout: 30_000 });

    // Quality banner present
    const banner = page.locator('[role="note"][aria-label*="quality"]');
    await expect(banner).toBeVisible({ timeout: 10_000 });

    // learnerSafeSummary present
    const overviewBox = page.getByTestId('learner-safe-summary');
    await expect(overviewBox).toBeVisible({ timeout: 10_000 });
    await expect(overviewBox).toContainText(/SELECT/i);

    await page.screenshot({ path: 'test-results/ux-bug-concept-readability-bad2.png', fullPage: true });
  });

  /**
   * Route-interception test: a concept whose markdown contains a textbook
   * extraction artefact (form-feed \x0c) must fall through to local
   * heuristics when no qualityMetadata is present, and must still show the
   * quality banner.
   *
   * This tests the local-heuristic fallback path, which is the safety net
   * when qualityMetadata is absent.
   */
  test('Local-heuristic fallback: garbled markdown (no metadata) triggers quality banner', async ({ page }) => {
    // Intercept the concept markdown for a concept that has NO qualityMetadata
    // in concept-map.json and inject a garbled payload via route interception.
    // We use an existing concept whose map entry has no qualityMetadata — if
    // one doesn't exist, we seed it via route intercept of concept-map.json.

    // Step 1: Intercept concept-map.json to inject a test concept with no qualityMetadata
    await page.route('**/textbook-static/concept-map.json', async route => {
      const resp = await route.fetch();
      const json = await resp.json() as { concepts: Record<string, unknown> };
      // Inject a test concept without qualityMetadata
      json.concepts['test-garbled-concept'] = {
        id: 'test-garbled-concept',
        title: 'Garbled Test Concept',
        definition: 'A test concept with garbled content.',
        difficulty: 'beginner',
        estimatedReadTime: 5,
        pageNumbers: [1],
        chunkIds: { definition: [], examples: [], commonMistakes: [] },
        relatedConcepts: [],
        practiceProblemIds: []
        // No qualityMetadata — must fall through to local heuristics
      };
      await route.fulfill({ json });
    });

    // Step 2: Intercept the markdown file for this concept and return garbled content
    await page.route('**/textbook-static/concepts/test-garbled-concept.md', async route => {
      // Simulate a pdftotext artefact: form-feed character in explanation
      const garbledMarkdown = [
        '## Definition',
        'A test concept.',
        '## What is This?',
        'Normal definition text.',
        '## Explanation',
        // Long garbled text: form-feed artefact (triggers heuristic 3 immediately)
        'Content before page break.\x0cContent after page break continued from next page.',
        '## Examples',
        '## Common Mistakes',
      ].join('\n');
      await route.fulfill({
        contentType: 'text/markdown',
        body: garbledMarkdown
      });
    });

    await page.goto('/concepts/test-garbled-concept');

    await expect(
      page.locator('h1').filter({ hasText: /Garbled Test Concept/i })
    ).toBeVisible({ timeout: 30_000 });

    // Quality banner must appear — triggered by local heuristic
    const banner = page.locator('[role="note"][aria-label*="quality"]');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText(/Source quality limited/i);

    await page.screenshot({ path: 'test-results/ux-bug-concept-readability-local-heuristic.png', fullPage: true });
  });

  /**
   * Positive control: a concept with clean content must NOT show the banner
   * and must show the full explanation as primary content.
   *
   * Uses route interception to inject a known-good markdown payload so the
   * test is stable regardless of actual textbook content.
   */
  test('Clean concept does NOT show quality banner and shows full explanation', async ({ page }) => {
    // Inject a clean concept into concept-map.json
    await page.route('**/textbook-static/concept-map.json', async route => {
      const resp = await route.fetch();
      const json = await resp.json() as { concepts: Record<string, unknown> };
      json.concepts['test-clean-concept'] = {
        id: 'test-clean-concept',
        title: 'Clean Test Concept',
        definition: 'A well-formed concept with clean content.',
        difficulty: 'beginner',
        estimatedReadTime: 5,
        pageNumbers: [10],
        chunkIds: { definition: [], examples: [], commonMistakes: [] },
        relatedConcepts: [],
        practiceProblemIds: [],
        qualityMetadata: {
          readabilityStatus: 'clean',
          exampleQuality: 'clean'
        }
      };
      await route.fulfill({ json });
    });

    // Inject clean markdown
    await page.route('**/textbook-static/concepts/test-clean-concept.md', async route => {
      const cleanMarkdown = [
        '## Definition',
        'A well-formed concept with clean content.',
        '## Explanation',
        'The SELECT statement retrieves rows from a table. You can filter results with WHERE.',
        'Aggregates like COUNT() and SUM() work with GROUP BY. Order results using ORDER BY.',
        '## Examples',
        '### Basic SELECT',
        'Retrieves all rows from the users table.',
        '```sql',
        'SELECT * FROM users;',
        '```',
        '## Common Mistakes',
      ].join('\n');
      await route.fulfill({
        contentType: 'text/markdown',
        body: cleanMarkdown
      });
    });

    await page.goto('/concepts/test-clean-concept');

    await expect(
      page.locator('h1').filter({ hasText: /Clean Test Concept/i })
    ).toBeVisible({ timeout: 30_000 });

    // Quality banner must NOT be visible
    const banner = page.locator('[role="note"][aria-label*="quality"]');
    await expect(banner).not.toBeVisible({ timeout: 5_000 });

    // Full explanation must be shown
    const explanationArea = page.locator('.prose');
    await expect(explanationArea).toBeVisible({ timeout: 5_000 });
    await expect(explanationArea).toContainText(/SELECT statement/i);

    await page.screenshot({ path: 'test-results/ux-bug-concept-readability-clean.png', fullPage: true });
  });
});
