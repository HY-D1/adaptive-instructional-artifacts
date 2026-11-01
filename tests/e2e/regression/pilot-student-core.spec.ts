import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { getEditorText, replaceEditorText } from '../../helpers/test-helpers';

// Playwright's failure snapshots include password input values.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
// Explicit opt-in: this test creates a student on an independently verified preview.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const scenario of ['new', 'returning-control', 'returning-adaptive']) {
test(`isolated pilot ${scenario}: login, answer, hint, notes and clean-context recovery`, async ({ page, browser }) => {
  test.skip(process.env.PILOT_ISOLATED_TARGET !== 'true', 'Requires verified isolated preview');
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const base = process.env.PLAYWRIGHT_BASE_URL!;
  const api = process.env.PLAYWRIGHT_API_BASE_URL!;
  const classCode = process.env.E2E_STUDENT_CLASS_CODE!;
  expect(base && api && classCode).toBeTruthy();
  expect(new URL(base).hostname).not.toBe('adaptive-instructional-artifacts.vercel.app');
  const prefix = scenario === 'returning-control' ? 'PILOT_RETURNING_CONTROL' : 'PILOT_RETURNING_ADAPTIVE';
  test.skip(scenario !== 'new' && !process.env[`${prefix}_EMAIL`], 'Requires controlled pre-migration account');
  const email = scenario === 'new' ? `pilot-browser-${Date.now()}@sql-adapt.test` : process.env[`${prefix}_EMAIL`]!;
  const password = scenario === 'new' ? `Pilot!${randomBytes(24).toString('hex')}` : process.env[`${prefix}_PASSWORD`]!;
  const correct = 'SELECT * FROM users;';
  const read = (p: Page, path: string) => p.evaluate(async url => {
    const response = await fetch(url, { credentials: 'include' });
    return { status: response.status, body: await response.json() };
  }, `${api}${path}`);
  const closeWelcome = async (p: Page) => {
    const close = p.getByRole('button', { name: 'Close welcome dialog', exact: true });
    if (await close.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)) await close.click();
  };
  const login = async (p: Page) => {
    await p.goto(`${base}/login`);
    await p.locator('#login-email').fill(email);
    await p.locator('#login-password').fill(password);
    await p.locator('form').getByRole('button', { name: /^Sign In$/i }).click();
    await expect(p).toHaveURL(/\/practice/);
    await closeWelcome(p);
    await expect(p.getByRole('button', { name: 'Run Query', exact: true })).toBeEnabled();
  };

  if (scenario === 'new') {
  await page.goto(`${base}/login?tab=signup`);
  await page.locator('#signup-name').fill('Pilot Browser Student');
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill(password);
  await page.getByRole('button', { name: 'Student Practice SQL', exact: true }).click();
  await page.locator('#signup-code').fill(classCode);
  await page.getByRole('button', { name: /Create Account/i }).last().click();
  await expect(page).toHaveURL(/\/pre-survey-required/);
  const identityBefore = await read(page, '/api/auth/me');
  expect(identityBefore.status).toBe(200);
  const learnerBefore = identityBefore.body.user.learnerId;
  expect((await read(page, '/api/surveys/status')).body.data.completed).toBe(false);
  const csrf = (await page.context().cookies(api)).find(cookie => cookie.name === 'sql_adapt_csrf')?.value;
  expect(Boolean(csrf)).toBe(true);
  const gated = await page.request.post(`${api}/api/sessions/${encodeURIComponent(learnerBefore)}/active`, { headers: { 'x-csrf-token': csrf! }, data: {}, failOnStatusCode: false });
  expect(gated.status()).toBe(403);
  expect((await gated.json()).code).toBe('PRE_SURVEY_REQUIRED');
  const invitations = await read(page, '/api/surveys');
  const invitation = invitations.body.data?.find((item: { instance: string; status: string }) => item.instance === 'pre' && item.status === 'pending');
  expect(Boolean(invitation?.surveyUrl && invitation?.username)).toBe(true);
  const survey = new URL(invitation.surveyUrl);
  const token = survey.searchParams.get('completion_token');
  expect(Boolean(token && survey.searchParams.get('username') === invitation.username && survey.searchParams.get('instance') === 'pre')).toBe(true);
  const callback = new URL('/api/surveys/complete', api);
  callback.search = new URLSearchParams({ instance: 'pre', username: invitation.username, completion_token: token!, ResponseID: `pilot-${randomBytes(16).toString('hex')}` }).toString();
  // The token is sensitive. Suppress request errors that could contain its URL.
  let completed = false;
  try {
    const response = await page.request.get(callback.toString(), { maxRedirects: 0, failOnStatusCode: false });
    const location = response.headers().location;
    completed = response.status() === 302 && !!location && new URL(location, base).pathname === '/practice';
  } catch { /* Report only the sanitized failure below. */ }
  expect(completed).toBe(true);
  expect((await read(page, '/api/surveys/status')).body.data.completed).toBe(true);
  } else {
    await login(page);
    expect((await read(page, '/api/surveys/status')).body.data.completed).toBe(true);
  }
  await page.goto(`${base}/practice`);
  await closeWelcome(page);
  await page.getByRole('button', { name: 'Logout', exact: true }).first().click();
  const logoutAnyway = page.getByRole('button', { name: 'Log out anyway', exact: true });
  if (await logoutAnyway.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)) await logoutAnyway.click();
  await expect.poll(async () => (await read(page, '/api/auth/me')).status).toBe(401);
  await login(page);
  const identity = await read(page, '/api/auth/me');
  expect(identity.status).toBe(200);
  const learnerId = identity.body.user.learnerId;
  expect(typeof learnerId).toBe('string');
  await expect(page.getByText('Select All Users', { exact: true }).first()).toBeVisible();
  await replaceEditorText(page, 'SELECT name FROM users WHERE age > 100;');
  await page.getByRole('button', { name: 'Run Query', exact: true }).click();
  await expect(page.getByText('Results differ', { exact: true })).toBeVisible();
  await page.getByTestId('hint-action-button').click();
  await expect.poll(async () =>
    await page.getByTestId('hint-label-1').isVisible().catch(() => false) ||
    await page.getByText(/Full Explanation Unlocked|Explanation has been generated/i).first().isVisible().catch(() => false),
  ).toBe(true);
  await page.getByRole('button', { name: /Save to Notes/i }).first().click();
  await expect(page.getByText(/Saved.*My Textbook|Updated.*My Textbook/i).first()).toBeVisible();
  await expect.poll(async () => (await read(page, `/api/textbooks/${learnerId}`)).body.data?.length ?? 0).toBeGreaterThan(0);
  const note = (await read(page, `/api/textbooks/${learnerId}`)).body.data[0];
  expect(note.title.length).toBeGreaterThan(0);
  await replaceEditorText(page, correct);
  await page.getByRole('button', { name: 'Run Query', exact: true }).click();
  await expect(page.getByText('Output matches', { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const result = await read(page, `/api/learners/${learnerId}/progress/problem-1`);
    return result.status === 200 && result.body.data?.solved === true && result.body.data?.lastCode === correct;
  }).toBe(true);
  await page.reload();
  await expect.poll(() => getEditorText(page)).toContain(correct);

  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? process.env.E2E_VERCEL_BYPASS_SECRET;
  const clean = await browser.newContext({ extraHTTPHeaders: bypass ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' } : {} });
  try {
    const second = await clean.newPage();
    await login(second);
    await expect.poll(() => getEditorText(second)).toContain(correct);
    const restored = await read(second, `/api/learners/${learnerId}/progress/problem-1`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.solved).toBe(true);
    const notes = await read(second, `/api/textbooks/${learnerId}`);
    expect(notes.status).toBe(200);
    expect(notes.body.data.some((unit: { id: string; content: string }) => unit.id === note.id && unit.content === note.content)).toBe(true);
    await second.getByRole('link', { name: 'My Textbook', exact: true }).first().click();
    await expect(second.getByText(note.title, { exact: false }).first()).toBeVisible();
  } finally {
    await clean.close();
  }
});

}
