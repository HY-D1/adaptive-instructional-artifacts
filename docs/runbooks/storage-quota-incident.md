# Storage Quota Incident Playbook

**Version**: 1.0.0  
**Date**: 2026-04-08  
**Audience**: On-call engineers, support owners  
**Scope**: localStorage quota exceeded errors in production

---

## Symptoms

### User-Facing Symptoms

| Symptom | Severity | Detection |
|---------|----------|-----------|
| App crashes with blank screen | P0 | User report + Sentry |
| "Save failed" error messages | P1 | User report + telemetry |
| Data not persisting on refresh | P1 | User report + DB check |
| Slow performance on interactions | P2 | Telemetry latency spikes |
| Hint requests failing silently | P2 | `hint_view` events missing |

### Error Signatures

```javascript
// Browser console errors
QuotaExceededError: The quota has been exceeded
NS_ERROR_DOM_QUOTA_REACHED: Persistent storage maximum size reached

// Application logs (if caught)
[Storage] Failed to save user profile: quota exceeded
[Storage] Exception saving interaction: quota exceeded
[HintCache] hint_cache_write_skipped_quota
```

### Telemetry Queries

Check for quota issues in Neon DB:

```sql
-- Find users with failed saves in last hour
SELECT learner_id, COUNT(*) as failed_saves
FROM interaction_events
WHERE success = false 
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY learner_id
HAVING COUNT(*) > 5;

-- Check for missing session saves
SELECT session_id, MAX(created_at) as last_event
FROM interaction_events
WHERE created_at > NOW() - INTERVAL '2 hours'
GROUP BY session_id
HAVING COUNT(*) FILTER (WHERE event_type = 'session_end') = 0;
```

---

## Safe Cleanup Keys

### Priority 1: Safe to Clear (Regenerable Data)

Clear these **first** when quota is exceeded:

| Key Pattern | Description | Impact | Recovery |
|-------------|-------------|--------|----------|
| `hint-cache:*` | Cached hint snapshots | Low | Regenerated on next hint request |
| `sql-learning-pdf-index` | PDF search index | Low | Falls back to memory; re-fetch from server |
| `sql-learning-llm-cache` | LLM response cache | Low | Regenerated on next LLM call |
| `hints-*` (legacy) | Old hint format | None | Obsolete, safe to delete |
| `hint-info-*` (legacy) | Old hint metadata | None | Obsolete, safe to delete |

### Priority 2: Clear with Caution (Sync-Dependent)

Clear **only after verifying backend sync**:

| Key | Description | Verification Step |
|-----|-------------|-------------------|
| `sql-adapt-offline-queue` | Pending backend writes | Run `npm run audit:beta-telemetry` to confirm events in DB |
| `sql-adapt-pending-interactions` | Unconfirmed interactions | Check `interaction_events` table for matching IDs |
| `sql-adapt-pending-session-ends` | Session end queue | Verify `session_end` events in DB |
| `sql-adapt-dead-letter` | Failed writes log | Review before clearing; may need investigation |

### Priority 3: Never Clear Without Backup

**Do NOT clear these without explicit verification**:

| Key | Data | Verification |
|-----|------|--------------|
| `sql-learning-interactions` | Research interaction history | Ensure full export exists in DB |
| `sql-learning-profiles` | Learner progress and HDI | Verify Neon `learner_profiles` table |
| `sql-adapt-user-profile` | Active user identity | Confirm re-login path works |
| `sql-learning-active-session` | Current session state | Verify backend session exists |
| `sql-learning-practice-drafts` | In-progress problem drafts | Confirm saved to backend |
| `sql-learning-textbook` | Student notes | Verify export to DB |

---

## How to Verify Neon Durability

### Quick Health Check

```bash
# Check backend health
curl -sS https://adaptive-instructional-artifacts-ap.vercel.app/health

# Check persistence mode (should show dbMode=neon)
curl -sS https://adaptive-instructional-artifacts-ap.vercel.app/api/system/persistence-status
```

### Database Verification Queries

```sql
-- 1. Verify learner profile exists in Neon
SELECT id, profile_id, hdi_score, last_updated
FROM learner_profiles
WHERE id = '<learner-id>';

-- 2. Check recent interactions are persisted
SELECT event_type, created_at, success
FROM interaction_events
WHERE learner_id = '<learner-id>'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Verify session state is saved
SELECT session_id, current_problem_id, current_code, last_activity_at
FROM learner_sessions
WHERE learner_id = '<learner-id>'
ORDER BY last_activity_at DESC
LIMIT 1;

-- 4. Check for data loss (compare counts)
SELECT 
  learner_id,
  COUNT(*) as event_count,
  COUNT(*) FILTER (WHERE success = true) as successful_events
FROM interaction_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY learner_id
HAVING COUNT(*) FILTER (WHERE success = true) < COUNT(*) * 0.9;
```

### Backend Session Verification

```bash
# Get session data for a learner (requires auth)
curl -sS "https://adaptive-instructional-artifacts-ap.vercel.app/api/sessions/<learner-id>" \
  -H "Cookie: <auth-cookie>"
```

### Telemetry Audit Script

```bash
# Run telemetry audit for specific time range
npm run audit:beta-telemetry -- \
  --since "2026-04-08T10:00:00Z" \
  --until "2026-04-08T12:00:00Z" \
  --stage 1
```

---

## Rollback Threshold (When to Escalate)

### Immediate Escalation (P0)

Escalate to technical lead **immediately** if:

| Condition | Evidence | Action |
|-----------|----------|--------|
| > 10% of active users affected | 5+ quota errors in 15 min | Page on-call, consider rollback |
| Confirmed data loss | DB shows missing interactions | **ROLLBACK NOW** |
| Backend also failing | `/health` non-200 | Escalate to infrastructure |
| Cannot clear sufficient storage | 0 bytes freed after cleanup | Emergency code fix needed |

### Escalation Path

```
Support Owner detects issue
    |
    v
Quick localStorage cleanup attempted
    |
    v
Issue persists? ----YES----> Page Technical Lead
    | NO                        |
    v                           v
Monitor for 15 min      Assess rollback need
    |                           |
    v                           v
Resolved                Execute rollback if needed
```

### Rollback Decision Matrix

| Scenario | User Impact | Data at Risk | Decision |
|----------|-------------|--------------|----------|
| Single user, localStorage full | 1 user | None (backend sync OK) | Cleanup, no rollback |
| Multiple users, localStorage full | 5+ users | Low (backend has data) | Cleanup + monitor |
| Backend quota/sync failing | All users | **HIGH** | **ROLLBACK** |
| Data loss confirmed | Any users | Research data | **ROLLBACK + INVESTIGATE** |

---

## Recovery Steps

### Immediate Response (First 5 Minutes)

1. **Confirm scope**
   ```bash
   # Check Vercel function errors
   # Check Sentry for QuotaExceededError
   # Ask supervisor: "How many students report issues?"
   ```

2. **Verify backend health**
   ```bash
   curl -sS https://adaptive-instructional-artifacts-ap.vercel.app/health
   npm run corpus:verify-active-run
   ```

3. **Identify affected learners**
   ```sql
   SELECT DISTINCT learner_id 
   FROM interaction_events 
   WHERE success = false 
     AND created_at > NOW() - INTERVAL '30 minutes';
   ```

### Storage Cleanup Procedure

For affected users, guide them through (or execute via remote debugging):

```javascript
// 1. Check current usage
const usage = JSON.stringify(localStorage).length;
console.log(`Current usage: ${(usage / 1024).toFixed(2)} KB`);

// 2. Clear hint caches (safest)
Object.keys(localStorage)
  .filter(key => key.startsWith('hint-cache:'))
  .forEach(key => localStorage.removeItem(key));

// 3. Clear PDF index (if not needed)
localStorage.removeItem('sql-learning-pdf-index');

// 4. Clear LLM cache
localStorage.removeItem('sql-learning-llm-cache');

// 5. Clear legacy keys
Object.keys(localStorage)
  .filter(key => key.startsWith('hints-') || key.startsWith('hint-info-'))
  .forEach(key => localStorage.removeItem(key));

// 6. Verify space freed
const newUsage = JSON.stringify(localStorage).length;
console.log(`Freed: ${((usage - newUsage) / 1024).toFixed(2)} KB`);
```

### Backend Sync Verification

Before clearing any queue keys:

```bash
# 1. Run telemetry audit
npm run audit:beta-telemetry -- --since "<incident-start>"

# 2. Check for unconfirmed events in localStorage (user's browser)
# Run in browser console:
const pending = JSON.parse(localStorage.getItem('sql-adapt-pending-interactions') || '{}');
console.log('Unconfirmed events:', Object.keys(pending).length);

# 3. Compare with DB
# Query interaction_events for the same time period
```

### Recovery Validation

After cleanup, verify:

| Check | Method | Expected Result |
|-------|--------|-----------------|
| localStorage has space | `JSON.stringify(localStorage).length` | < 4MB (typically < 2MB) |
| New saves work | Trigger a hint request | No quota error |
| Backend sync working | Check interaction_events | New events appear |
| Session persistence | Refresh page | State restored |

### Post-Incident Actions

1. **Document affected users**
   - Learner IDs affected
   - Time range of incident
   - Data verified in DB vs localStorage

2. **Update incident log**
   ```bash
   # Add entry to docs/runbooks/beta-live-findings-FILLED.md
   ```

3. **Schedule follow-up**
   - Add P2 item: "Implement proactive storage monitoring"
   - Consider: Add storage usage telemetry

---

## Prevention

### Monitoring Recommendations

```javascript
// Add to telemetry (optional enhancement)
// Track localStorage usage percentage
const quotaEstimate = 5 * 1024 * 1024; // 5MB typical limit
const usage = JSON.stringify(localStorage).length;
const usagePercent = (usage / quotaEstimate) * 100;

if (usagePercent > 80) {
  // Emit warning telemetry
  console.warn('[Storage] High usage:', usagePercent.toFixed(1) + '%');
}
```

### Proactive Cleanup Triggers

The app already implements:

- **Hint cache**: Max 40 entries, 7-day TTL
- **Hint cache**: Budget-based cleanup (2KB per entry)
- **PDF index**: Memory fallback when localStorage fails

### User Communication

If storage issues persist, advise users:

> "If you see 'Save failed' errors, try refreshing the page. Your progress is safely stored on our servers. If issues continue, clear your browser cache for this site and sign in again."

---

## Related Runbooks

- [Beta 50-Student Operations](./beta-50-student-operations.md) — General operations
- [Beta Supervised Launch Packet](./beta-supervised-launch-packet.md) — Rollback procedures
- [Beta Telemetry Readiness](./beta-telemetry-readiness.md) — Telemetry queries

---

*Last Updated: 2026-04-08*
