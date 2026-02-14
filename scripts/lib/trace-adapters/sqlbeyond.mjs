function asObject(value) {
  return value && typeof value === 'object' ? value : null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function collectFromKnownKeys(payload, keys) {
  const results = [];
  const root = asObject(payload);
  if (!root) return results;

  for (const key of keys) {
    const value = root[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      const obj = asObject(item);
      if (obj) results.push(obj);
    }
  }

  return results;
}

function collectSessionAttemptRecords(payload) {
  const root = asObject(payload);
  if (!root) return [];

  const results = [];
  const sessions = toArray(root.sessions);

  for (const session of sessions) {
    const sessionObj = asObject(session);
    if (!sessionObj) continue;

    const sessionId = sessionObj.sessionId || sessionObj.session_id;
    const learnerId =
      sessionObj.learnerId || sessionObj.learner_id || sessionObj.userId || sessionObj.user_id;
    const problemId =
      sessionObj.problemId || sessionObj.problem_id || sessionObj.exerciseId || sessionObj.exercise_id;

    const attempts = toArray(sessionObj.attempts);
    for (const attempt of attempts) {
      const attemptObj = asObject(attempt);
      if (!attemptObj) continue;
      results.push({
        ...attemptObj,
        sessionId,
        learnerId,
        problemId
      });
    }
  }

  return results;
}

function collectLegacySubmissionRecords(payload) {
  const root = asObject(payload);
  if (!root) return [];

  const submissions = toArray(root.submissions);
  return submissions
    .map((submission) => asObject(submission))
    .filter(Boolean)
    .map((submission) => ({
      ...submission,
      eventType: submission.eventType || submission.event_type || 'execution'
    }));
}

export function extractSqlbeyondRecords(payload, sourceLabel = 'sqlbeyond') {
  const records = [];

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const obj = asObject(item);
      if (obj) records.push(obj);
    }
  }

  records.push(
    ...collectFromKnownKeys(payload, [
      'interactions',
      'events',
      'actions',
      'records',
      'trace',
      'traceEvents',
      'attempts'
    ]),
    ...collectSessionAttemptRecords(payload),
    ...collectLegacySubmissionRecords(payload)
  );

  const dedup = new Set();
  const unique = [];

  for (const record of records) {
    const key = JSON.stringify(record);
    if (dedup.has(key)) continue;
    dedup.add(key);
    unique.push({
      ...record,
      __adapter: sourceLabel
    });
  }

  return unique;
}
