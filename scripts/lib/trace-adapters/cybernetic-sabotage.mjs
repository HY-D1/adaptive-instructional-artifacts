function asObject(value) {
  return value && typeof value === 'object' ? value : null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function collectFromKnownKeys(payload, keys) {
  const results = [];
  const root = asObject(payload);
  if (!root) {
    return results;
  }

  for (const key of keys) {
    const value = root[key];
    if (!Array.isArray(value)) {
      continue;
    }
    for (const item of value) {
      const obj = asObject(item);
      if (obj) {
        results.push(obj);
      }
    }
  }

  return results;
}

function collectAttemptRecords(payload) {
  const root = asObject(payload);
  if (!root) return [];

  const candidates = [];

  const learners = toArray(root.learners);
  for (const learner of learners) {
    const learnerObj = asObject(learner);
    if (!learnerObj) continue;
    const learnerId = learnerObj.learnerId || learnerObj.learner_id || learnerObj.userId || learnerObj.user_id;
    const problemId = learnerObj.problemId || learnerObj.problem_id || learnerObj.challengeId || learnerObj.challenge_id;
    const attempts = toArray(learnerObj.attempts);
    const baseTimestamp = Number(learnerObj.baseTimestampMs ?? learnerObj.base_timestamp_ms ?? root.baseTimestampMs ?? root.base_timestamp_ms ?? 0);

    for (const attempt of attempts) {
      const attemptObj = asObject(attempt);
      if (!attemptObj) continue;
      const offsetMs = Number(attemptObj.offsetMs ?? attemptObj.offset_ms ?? 0);
      candidates.push({
        ...attemptObj,
        learnerId,
        problemId,
        timestamp: Number.isFinite(baseTimestamp + offsetMs) ? baseTimestamp + offsetMs : undefined
      });
    }
  }

  return candidates;
}

export function extractCyberneticSabotageRecords(payload, sourceLabel = 'cybernetic-sabotage') {
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
      'trace',
      'traceEvents',
      'logs',
      'records'
    ]),
    ...collectAttemptRecords(payload)
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
