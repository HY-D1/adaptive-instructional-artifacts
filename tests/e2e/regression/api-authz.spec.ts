import { expect, test } from '@playwright/test';
import { createApiContext, resolveApiBaseUrl } from '../helpers/auth-env';

const API_BASE_URL = resolveApiBaseUrl();

function expectBlocked(status: number): void {
  expect([401, 403]).toContain(status);
}

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
  email: string,
  password: string
) {
  const context = await createApiContext(playwright, API_BASE_URL);
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
  test('student blocked on instructor/research and cross-learner access', async ({ playwright }) => {
    const instructorCode = process.env.E2E_INSTRUCTOR_CODE ?? process.env.VITE_INSTRUCTOR_PASSCODE ?? 'TeachSQL2024';
    const ts = Date.now();
    const instructorEmail = `authz-instructor-${ts}@sql-adapt.test`;
    const instructorOtherEmail = `authz-instructor-other-${ts}@sql-adapt.test`;
    const studentEmail = `authz-student-${ts}@sql-adapt.test`;
    const otherStudentEmail = `authz-other-${ts}@sql-adapt.test`;
    const externalStudentEmail = `authz-external-${ts}@sql-adapt.test`;
    const password = 'AuthzCase!123';

    const bootstrap = await createApiContext(playwright, API_BASE_URL);
    try {
      const instructorSignup = await signup(bootstrap, {
      name: 'Authz Instructor',
      email: instructorEmail,
      password,
      role: 'instructor',
      instructorCode,
    });
    expect(instructorSignup.response.ok()).toBeTruthy();
    const classCode = instructorSignup.body.user?.ownedSections?.[0]?.studentSignupCode as string;
    expect(classCode).toBeTruthy();

      const instructorOtherSignup = await signup(bootstrap, {
      name: 'Other Instructor',
      email: instructorOtherEmail,
      password,
      role: 'instructor',
      instructorCode,
    });
    expect(instructorOtherSignup.response.ok()).toBeTruthy();
    const otherClassCode = instructorOtherSignup.body.user?.ownedSections?.[0]?.studentSignupCode as string;
    expect(otherClassCode).toBeTruthy();

      const studentSignup = await signup(bootstrap, {
      name: 'Authz Student',
      email: studentEmail,
      password,
      role: 'student',
      classCode,
    });
    expect(studentSignup.response.ok()).toBeTruthy();
    const studentId = studentSignup.body.user.learnerId as string;

      const otherStudentSignup = await signup(bootstrap, {
      name: 'Other Student',
      email: otherStudentEmail,
      password,
      role: 'student',
      classCode,
    });
    expect(otherStudentSignup.response.ok()).toBeTruthy();
    const otherStudentId = otherStudentSignup.body.user.learnerId as string;

      const externalStudentSignup = await signup(bootstrap, {
      name: 'External Student',
      email: externalStudentEmail,
      password,
      role: 'student',
      classCode: otherClassCode,
    });
    expect(externalStudentSignup.response.ok()).toBeTruthy();
    const externalStudentId = externalStudentSignup.body.user.learnerId as string;

      const anonymous = await createApiContext(playwright, API_BASE_URL);
      const student = await loginContext(playwright, studentEmail, password);
      const instructor = await loginContext(playwright, instructorEmail, password);
      const externalStudent = await loginContext(playwright, externalStudentEmail, password);
      try {
      const anonInstructor = await anonymous.get('/api/instructor/learners');
      expectBlocked(anonInstructor.status());
      const anonResearch = await anonymous.get('/api/research/export');
      expectBlocked(anonResearch.status());
      const anonInteractions = await anonymous.get(`/api/interactions?learnerId=${studentId}`);
      expectBlocked(anonInteractions.status());

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
      expect(spoofWrite.status()).toBe(403);

      const studentSessionSpoof = await student.context.post(`/api/sessions/${otherStudentId}/active`, {
        data: {
          currentProblemId: 'problem-2',
          currentCode: 'SELECT 1',
          guidanceState: { rung: 2, source: 'student-spoof' },
        },
        headers: { 'x-csrf-token': student.csrfToken },
      });
      expect(studentSessionSpoof.status()).toBe(403);

      const ownRead = await student.context.get(`/api/interactions?learnerId=${studentId}`);
      expect(ownRead.ok()).toBeTruthy();
      const ownReadBody = await ownRead.json();
      const spoofed = (ownReadBody.data || []).find((item: any) => item.id === spoofEvent.id);
      expect(spoofed).toBeFalsy();

      const otherLearnerDetail = await instructor.context.get(`/api/instructor/learner/${otherStudentId}`);
      expect(otherLearnerDetail.ok()).toBeTruthy();
      const otherLearnerDetailBody = await otherLearnerDetail.json();
      const spoofOnOtherLearner = (otherLearnerDetailBody.data?.interactions || [])
        .find((item: any) => item.id === spoofEvent.id);
      expect(spoofOnOtherLearner).toBeFalsy();

      const crossSectionInteractionRead = await instructor.context.get(`/api/interactions?learnerId=${externalStudentId}`);
      expect(crossSectionInteractionRead.status()).toBe(403);

      const crossSectionSessionRead = await instructor.context.get(`/api/sessions/${externalStudentId}/active`);
      expect(crossSectionSessionRead.status()).toBe(403);
      const crossSectionSessionWrite = await instructor.context.post(`/api/sessions/${externalStudentId}/active`, {
        data: {
          currentProblemId: 'problem-3',
          currentCode: 'SELECT 2',
          guidanceState: { rung: 1, source: 'instructor-cross-scope' },
        },
        headers: { 'x-csrf-token': instructor.csrfToken },
      });
      expect(crossSectionSessionWrite.status()).toBe(403);

      const ownSessionWrite = await student.context.post(`/api/sessions/${studentId}/active`, {
        data: {
          currentProblemId: 'problem-1',
          currentCode: 'SELECT * FROM employees',
          guidanceState: { rung: 1, source: 'own-session-write' },
        },
        headers: { 'x-csrf-token': student.csrfToken },
      });
      expect(ownSessionWrite.ok()).toBeTruthy();
      const ownSessionRead = await student.context.get(`/api/sessions/${studentId}/active`);
      expect(ownSessionRead.ok()).toBeTruthy();
      const ownSessionBody = await ownSessionRead.json();
      expect(ownSessionBody.data?.sectionId).toBeTruthy();

      const externalEvent = {
        id: `evt-external-${ts}`,
        learnerId: externalStudentId,
        eventType: 'execution',
        problemId: 'problem-1',
        timestamp: Date.now(),
        successful: true,
      };
      const externalEventWrite = await externalStudent.context.post('/api/interactions/batch', {
        data: { events: [externalEvent] },
        headers: { 'x-csrf-token': externalStudent.csrfToken },
      });
      expect(externalEventWrite.ok()).toBeTruthy();
      } finally {
        await anonymous.dispose();
        await student.context.dispose();
        await instructor.context.dispose();
        await externalStudent.context.dispose();
      }
    } finally {
      await bootstrap.dispose();
    }
  });
});
