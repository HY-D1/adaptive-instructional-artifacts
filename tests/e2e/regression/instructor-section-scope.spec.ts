import { expect, test } from '@playwright/test';

async function signup(
  request: import('@playwright/test').APIRequestContext,
  payload: Record<string, unknown>
) {
  const response = await request.post('/api/auth/signup', { data: payload });
  const body = await response.json();
  return { response, body };
}

async function loginContext(
  playwright: import('@playwright/test').Playwright,
  baseURL: string,
  email: string,
  password: string
) {
  const context = await playwright.request.newContext({ baseURL });
  const loginResponse = await context.post('/api/auth/login', {
    data: { email, password },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const loginBody = await loginResponse.json();
  return {
    context,
    csrfToken: loginBody.csrfToken as string,
  };
}

async function seedLearnerData(
  context: import('@playwright/test').APIRequestContext,
  learnerId: string,
  csrfToken: string,
  marker: string
) {
  const sessionRes = await context.post(`/api/sessions/${learnerId}/active`, {
    data: {
      currentProblemId: 'problem-1',
      currentCode: `SELECT '${marker}' AS marker`,
      guidanceState: { rung: 1, source: marker },
      lastActivity: new Date().toISOString(),
    },
    headers: { 'x-csrf-token': csrfToken },
  });
  expect(sessionRes.ok()).toBeTruthy();

  const interactionRes = await context.post('/api/interactions/batch', {
    data: {
      events: [{
        id: `evt-${marker}-${Date.now()}`,
        learnerId,
        eventType: 'execution',
        problemId: 'problem-1',
        timestamp: Date.now(),
        successful: false,
        code: `SELECT '${marker}' AS marker`,
      }],
    },
    headers: { 'x-csrf-token': csrfToken },
  });
  expect(interactionRes.ok()).toBeTruthy();

  const unitRes = await context.post(`/api/textbooks/${learnerId}/units`, {
    data: {
      unitId: `unit-${marker}-${Date.now()}`,
      type: 'explanation',
      conceptId: 'joins-inner',
      title: `Scoped note ${marker}`,
      content: `Section scope note for ${marker}`,
      sourceInteractionIds: [`src-${marker}`],
    },
    headers: { 'x-csrf-token': csrfToken },
  });
  expect(unitRes.ok()).toBeTruthy();
}

function assertOnlyLearnerAndSection(
  rows: Array<{ learnerId?: string; sectionId?: string | null }>,
  expectedLearnerId: string,
  expectedSectionId: string
) {
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row.learnerId).toBe(expectedLearnerId);
    expect(row.sectionId).toBe(expectedSectionId);
  }
}

test.describe('@authz @section-scope instructor sees only own section', () => {
  test('instructor A and B are isolated by enrollment scope', async ({ request, playwright, baseURL }) => {
    if (!baseURL) {
      test.skip();
      return;
    }

    const instructorCode = process.env.E2E_INSTRUCTOR_CODE ?? process.env.VITE_INSTRUCTOR_PASSCODE ?? 'TeachSQL2024';

    const ts = Date.now();
    const instrAEmail = `instr-a-${ts}@sql-adapt.test`;
    const instrBEmail = `instr-b-${ts}@sql-adapt.test`;
    const studentAEmail = `student-a-${ts}@sql-adapt.test`;
    const studentBEmail = `student-b-${ts}@sql-adapt.test`;
    const password = 'SectionScope!123';

    const instructorASignup = await signup(request, {
      name: 'Instructor A',
      email: instrAEmail,
      password,
      role: 'instructor',
      instructorCode,
    });
    expect(instructorASignup.response.ok()).toBeTruthy();
    const sectionAId = instructorASignup.body.user?.ownedSections?.[0]?.id as string;
    const codeA = instructorASignup.body.user?.ownedSections?.[0]?.studentSignupCode as string;
    expect(sectionAId).toBeTruthy();
    expect(codeA).toBeTruthy();

    const instructorBSignup = await signup(request, {
      name: 'Instructor B',
      email: instrBEmail,
      password,
      role: 'instructor',
      instructorCode,
    });
    expect(instructorBSignup.response.ok()).toBeTruthy();
    const sectionBId = instructorBSignup.body.user?.ownedSections?.[0]?.id as string;
    const codeB = instructorBSignup.body.user?.ownedSections?.[0]?.studentSignupCode as string;
    expect(sectionBId).toBeTruthy();
    expect(codeB).toBeTruthy();

    const studentASignup = await signup(request, {
      name: 'Student A',
      email: studentAEmail,
      password,
      role: 'student',
      classCode: codeA,
    });
    expect(studentASignup.response.ok()).toBeTruthy();
    const studentAId = studentASignup.body.user.learnerId as string;

    const studentBSignup = await signup(request, {
      name: 'Student B',
      email: studentBEmail,
      password,
      role: 'student',
      classCode: codeB,
    });
    expect(studentBSignup.response.ok()).toBeTruthy();
    const studentBId = studentBSignup.body.user.learnerId as string;

    const instructorA = await loginContext(playwright, baseURL, instrAEmail, password);
    const instructorB = await loginContext(playwright, baseURL, instrBEmail, password);
    const studentA = await loginContext(playwright, baseURL, studentAEmail, password);
    const studentB = await loginContext(playwright, baseURL, studentBEmail, password);

    try {
      await seedLearnerData(studentA.context, studentAId, studentA.csrfToken, 'scope-a');
      await seedLearnerData(studentB.context, studentBId, studentB.csrfToken, 'scope-b');

      const learnersARes = await instructorA.context.get('/api/instructor/learners');
      expect(learnersARes.ok()).toBeTruthy();
      const learnersABody = await learnersARes.json();
      const learnerIdsA = (learnersABody.data || []).map((item: any) => item.learner?.id);
      expect(learnerIdsA).toContain(studentAId);
      expect(learnerIdsA).not.toContain(studentBId);

      const learnersBRes = await instructorB.context.get('/api/instructor/learners');
      expect(learnersBRes.ok()).toBeTruthy();
      const learnersBBody = await learnersBRes.json();
      const learnerIdsB = (learnersBBody.data || []).map((item: any) => item.learner?.id);
      expect(learnerIdsB).toContain(studentBId);
      expect(learnerIdsB).not.toContain(studentAId);

      const crossReadA = await instructorA.context.get(`/api/instructor/learner/${studentBId}`);
      expect(crossReadA.status()).toBe(403);
      const crossReadB = await instructorB.context.get(`/api/instructor/learner/${studentAId}`);
      expect(crossReadB.status()).toBe(403);

      const researchLearnersA = await instructorA.context.get('/api/research/learners');
      expect(researchLearnersA.ok()).toBeTruthy();
      const researchLearnersABody = await researchLearnersA.json();
      const researchLearnerIdsA = (researchLearnersABody.data || []).map((item: any) => item.id);
      expect(researchLearnerIdsA).toContain(studentAId);
      expect(researchLearnerIdsA).not.toContain(studentBId);

      const researchLearnersB = await instructorB.context.get('/api/research/learners');
      expect(researchLearnersB.ok()).toBeTruthy();
      const researchLearnersBBody = await researchLearnersB.json();
      const researchLearnerIdsB = (researchLearnersBBody.data || []).map((item: any) => item.id);
      expect(researchLearnerIdsB).toContain(studentBId);
      expect(researchLearnerIdsB).not.toContain(studentAId);

      const researchCrossA = await instructorA.context.get(`/api/research/learner/${studentBId}/trajectory`);
      expect(researchCrossA.status()).toBe(403);
      const researchCrossB = await instructorB.context.get(`/api/research/learner/${studentAId}/trajectory`);
      expect(researchCrossB.status()).toBe(403);

      const overviewARes = await instructorA.context.get('/api/instructor/overview');
      expect(overviewARes.ok()).toBeTruthy();
      const overviewABody = await overviewARes.json();
      expect(overviewABody.data?.learnerCount).toBe(1);
      expect(overviewABody.data?.sections?.map((section: any) => section.id)).toEqual([sectionAId]);

      const overviewBRes = await instructorB.context.get('/api/instructor/overview');
      expect(overviewBRes.ok()).toBeTruthy();
      const overviewBBody = await overviewBRes.json();
      expect(overviewBBody.data?.learnerCount).toBe(1);
      expect(overviewBBody.data?.sections?.map((section: any) => section.id)).toEqual([sectionBId]);

      const instructorExportARes = await instructorA.context.get('/api/instructor/export');
      expect(instructorExportARes.ok()).toBeTruthy();
      const instructorExportABody = await instructorExportARes.json();
      expect(instructorExportABody.data?.exportMetadata?.sectionIds).toEqual([sectionAId]);
      assertOnlyLearnerAndSection(instructorExportABody.data?.interactions || [], studentAId, sectionAId);
      const textbookA = instructorExportABody.data?.textbookUnits || [];
      expect(textbookA.length).toBeGreaterThan(0);
      for (const row of textbookA) {
        expect(row.learnerId).toBe(studentAId);
      }

      const instructorExportBRes = await instructorB.context.get('/api/instructor/export');
      expect(instructorExportBRes.ok()).toBeTruthy();
      const instructorExportBBody = await instructorExportBRes.json();
      expect(instructorExportBBody.data?.exportMetadata?.sectionIds).toEqual([sectionBId]);
      assertOnlyLearnerAndSection(instructorExportBBody.data?.interactions || [], studentBId, sectionBId);
      const textbookB = instructorExportBBody.data?.textbookUnits || [];
      expect(textbookB.length).toBeGreaterThan(0);
      for (const row of textbookB) {
        expect(row.learnerId).toBe(studentBId);
      }

      const aggregatesARes = await instructorA.context.get('/api/research/aggregates');
      expect(aggregatesARes.ok()).toBeTruthy();
      const aggregatesABody = await aggregatesARes.json();
      expect(aggregatesABody.data?.totalLearners).toBe(1);
      expect(aggregatesABody.data?.totalInteractions).toBeGreaterThan(0);

      const aggregatesBRes = await instructorB.context.get('/api/research/aggregates');
      expect(aggregatesBRes.ok()).toBeTruthy();
      const aggregatesBBody = await aggregatesBRes.json();
      expect(aggregatesBBody.data?.totalLearners).toBe(1);
      expect(aggregatesBBody.data?.totalInteractions).toBeGreaterThan(0);

      const researchExportARes = await instructorA.context.get('/api/research/export');
      expect(researchExportARes.ok()).toBeTruthy();
      const researchExportABody = await researchExportARes.json();
      expect(researchExportABody.data?.exportMetadata?.sectionIds).toEqual([sectionAId]);
      assertOnlyLearnerAndSection(researchExportABody.data?.interactions || [], studentAId, sectionAId);
      const researchTextbookA = researchExportABody.data?.textbookUnits || [];
      expect(researchTextbookA.length).toBeGreaterThan(0);
      for (const row of researchTextbookA) {
        expect(row.learnerId).toBe(studentAId);
      }

      const researchExportBRes = await instructorB.context.get('/api/research/export');
      expect(researchExportBRes.ok()).toBeTruthy();
      const researchExportBBody = await researchExportBRes.json();
      expect(researchExportBBody.data?.exportMetadata?.sectionIds).toEqual([sectionBId]);
      assertOnlyLearnerAndSection(researchExportBBody.data?.interactions || [], studentBId, sectionBId);
      const researchTextbookB = researchExportBBody.data?.textbookUnits || [];
      expect(researchTextbookB.length).toBeGreaterThan(0);
      for (const row of researchTextbookB) {
        expect(row.learnerId).toBe(studentBId);
      }
    } finally {
      await instructorA.context.dispose();
      await instructorB.context.dispose();
      await studentA.context.dispose();
      await studentB.context.dispose();
    }
  });
});
