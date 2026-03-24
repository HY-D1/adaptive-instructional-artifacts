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

test.describe('@authz API authorization and learner spoof protections', () => {
  test('student blocked on instructor/research and cross-learner access', async ({ request, playwright, baseURL }) => {
    if (!baseURL) {
      test.skip();
      return;
    }

    const instructorCode = process.env.E2E_INSTRUCTOR_CODE ?? process.env.VITE_INSTRUCTOR_PASSCODE ?? 'TeachSQL2024';
    const ts = Date.now();
    const instructorEmail = `authz-instructor-${ts}@sql-adapt.test`;
    const studentEmail = `authz-student-${ts}@sql-adapt.test`;
    const otherStudentEmail = `authz-other-${ts}@sql-adapt.test`;
    const password = 'AuthzCase!123';

    const instructorSignup = await signup(request, {
      name: 'Authz Instructor',
      email: instructorEmail,
      password,
      role: 'instructor',
      instructorCode,
    });
    expect(instructorSignup.response.ok()).toBeTruthy();
    const classCode = instructorSignup.body.user?.ownedSections?.[0]?.studentSignupCode as string;
    expect(classCode).toBeTruthy();

    const studentSignup = await signup(request, {
      name: 'Authz Student',
      email: studentEmail,
      password,
      role: 'student',
      classCode,
    });
    expect(studentSignup.response.ok()).toBeTruthy();
    const studentId = studentSignup.body.user.learnerId as string;

    const otherStudentSignup = await signup(request, {
      name: 'Other Student',
      email: otherStudentEmail,
      password,
      role: 'student',
      classCode,
    });
    expect(otherStudentSignup.response.ok()).toBeTruthy();
    const otherStudentId = otherStudentSignup.body.user.learnerId as string;

    const student = await loginContext(playwright, baseURL, studentEmail, password);
    const instructor = await loginContext(playwright, baseURL, instructorEmail, password);
    try {
      const researchBlocked = await student.context.get('/api/research/export');
      expect(researchBlocked.status()).toBe(403);

      const profilesBlocked = await student.context.get('/api/learners/profiles');
      expect(profilesBlocked.status()).toBe(403);

      const instructorBlocked = await student.context.get('/api/instructor/learners');
      expect(instructorBlocked.status()).toBe(403);

      const crossLearnerBlocked = await student.context.get(`/api/interactions?learnerId=${otherStudentId}`);
      expect(crossLearnerBlocked.status()).toBe(403);

      const spoofEvent = {
        id: `evt-spoof-${ts}`,
        learnerId: otherStudentId,
        eventType: 'execution',
        problemId: 'problem-1',
        timestamp: Date.now(),
        successful: true,
      };
      const spoofWrite = await student.context.post('/api/interactions/batch', {
        data: { events: [spoofEvent] },
        headers: { 'x-csrf-token': student.csrfToken },
      });
      expect(spoofWrite.ok()).toBeTruthy();

      const ownRead = await student.context.get(`/api/interactions?learnerId=${studentId}`);
      expect(ownRead.ok()).toBeTruthy();
      const ownReadBody = await ownRead.json();
      const spoofed = (ownReadBody.data || []).find((item: any) => item.id === spoofEvent.id);
      expect(spoofed).toBeTruthy();
      expect(spoofed.learnerId).toBe(studentId);
      expect(spoofed.learnerId).not.toBe(otherStudentId);

      const otherLearnerDetail = await instructor.context.get(`/api/instructor/learner/${otherStudentId}`);
      expect(otherLearnerDetail.ok()).toBeTruthy();
      const otherLearnerDetailBody = await otherLearnerDetail.json();
      const spoofOnOtherLearner = (otherLearnerDetailBody.data?.interactions || [])
        .find((item: any) => item.id === spoofEvent.id);
      expect(spoofOnOtherLearner).toBeFalsy();
    } finally {
      await student.context.dispose();
      await instructor.context.dispose();
    }
  });
});
