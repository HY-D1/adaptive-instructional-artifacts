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
    const codeA = instructorASignup.body.user?.ownedSections?.[0]?.studentSignupCode as string;
    expect(codeA).toBeTruthy();

    const instructorBSignup = await signup(request, {
      name: 'Instructor B',
      email: instrBEmail,
      password,
      role: 'instructor',
      instructorCode,
    });
    expect(instructorBSignup.response.ok()).toBeTruthy();
    const codeB = instructorBSignup.body.user?.ownedSections?.[0]?.studentSignupCode as string;
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

    try {
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
    } finally {
      await instructorA.context.dispose();
      await instructorB.context.dispose();
    }
  });
});
