# Auth Rate Limiting Audit — SQL-Adapt

**Date**: 2026-04-08  
**Issue**: Preview/prod login shows "Too many auth attempts" without legitimate abuse  
**Severity**: P1 — Blocks beta launch readiness

---

## Root Cause Summary

The auth rate limiting implementation has multiple design flaws that combine to block legitimate users in preview/production environments.

### Primary Issue: Overly Broad IP-Based Limiter

**Location**: `apps/server/src/app.ts:243`
```typescript
app.use('/api/auth', authRateLimiter, authRouter);
```

**Problem**: The `authRateLimiter` is mounted on ALL `/api/auth/*` routes:
- `POST /api/auth/login` — Needs protection ✓
- `POST /api/auth/signup` — Needs protection ✓  
- `POST /api/auth/logout` — Should NOT be rate-limited ✗
- `GET /api/auth/me` — Should NOT be rate-limited ✗

### Secondary Issue: Broken Success-Skip Mechanism

**Location**: `apps/server/src/middleware/rate-limit.ts`

The `markAuthSuccess()` function exists but is **never called** in the auth routes:
- `apps/server/src/routes/auth.ts` has 0 references to `markAuthSuccess`
- The `successfulAuthRequests` Set is always empty
- Successful logins still count against the rate limit

### Tertiary Issue: IP-Based Keying Fails on Vercel

**Location**: `apps/server/src/middleware/rate-limit.ts:85`
```typescript
keyGenerator: (req: Request) => {
  return req.ip ?? 'unknown';
},
```

**Problem**: 
- On Vercel, requests come through proxies/CDN layers
- Many legitimate users share the same `req.ip` (proxy IPs)
- 5 requests per 15 minutes per IP is far too aggressive for shared infrastructure
- No `trust proxy` configuration for Express to see true client IPs

### Quaternary Issue: Telemetry Blind Spot

**Location**: `apps/server/src/routes/auth.ts`

Rate-limited requests return 429 **before** reaching the auth router:
- `authRateLimiter.handler()` sends 429 response directly
- Auth routes' `logAuthEvent()` is never called
- No visibility into how many legitimate users are blocked
- Research telemetry loses auth attempt signals

---

## Auth Endpoint Analysis

| Endpoint | Method | Current Limit | Should Limit | Key Strategy |
|----------|--------|---------------|--------------|--------------|
| `/api/auth/login` | POST | 5/15min IP | Yes | Email + IP |
| `/api/auth/signup` | POST | 5/15min IP | Yes | IP only (new users) |
| `/api/auth/logout` | POST | 5/15min IP | **No** | N/A |
| `/api/auth/me` | GET | 5/15min IP | **No** | N/A |

---

## Current Rate Limiter Configuration

```typescript
// authRateLimiter (line 64-95)
windowMs: 15 * 60 * 1000,  // 15 minutes
limit: 5,                   // 5 requests
keyGenerator: (req) => req.ip ?? 'unknown',
skip: (req) => {
  // Check successfulAuthRequests Set - ALWAYS EMPTY
  const key = getAuthRequestKey(req);
  if (successfulAuthRequests.has(key)) {
    successfulAuthRequests.delete(key);
    return true;
  }
  return false;
}
```

---

## Affected Code Paths

### Backend
1. `apps/server/src/app.ts:243` — Rate limiter mounting
2. `apps/server/src/middleware/rate-limit.ts:64-95` — Broken auth limiter
3. `apps/server/src/routes/auth.ts` — Missing markAuthSuccess calls

### Frontend
1. `apps/web/src/app/pages/AuthPage.tsx:121-132` — Login handler (no 429 handling)
2. `apps/web/src/app/pages/AuthPage.tsx:136-160` — Signup handler (no 429 handling)
3. `apps/web/src/app/lib/api/auth-client.ts:147-162` — Login client (no retry-after parsing)

---

## Evidence from Code Review

### markAuthSuccess Never Called
```bash
$ rg -n "markAuthSuccess" apps/server/src/
apps/server/src/middleware/rate-limit.ts:22:export function markAuthSuccess(req: Request): void {
apps/server/src/middleware/rate-limit.ts:78:    if (successfulAuthRequests.has(key)) {
# No calls in auth.ts or any other route file
```

### Express Trust Proxy Not Configured
```bash
$ rg -n "trust proxy" apps/server/src/
# No results — Express sees proxy IP, not client IP
```

### Rate Limited Responses Bypass Telemetry
```typescript
// rate-limit.ts:87-94
handler: (_req: Request, res: Response) => {
  res.status(429).json({...});  // Never reaches auth routes
}

// auth.ts:120-144
async function logAuthEvent(...) {...}  // Never called for 429s
```

---

## Deployment Parity Issues

### Preview Environment
- Preview deployments share infrastructure with other Vercel projects
- Higher chance of IP collision with unrelated traffic
- Rate limit more likely to trigger incorrectly

### Production Environment  
- Dedicated deployment but still behind Vercel CDN
- `req.ip` shows CDN edge node IP, not true client IP
- Students on same school network share external IP

---

## Recommendations

### Immediate (Fix Before Beta)

1. **Remove authRateLimiter from /api/auth mount point**
   - Apply specific limiters to individual endpoints
   - Leave `/logout` and `/me` unprotected

2. **Add Express trust proxy configuration**
   - Enable `app.set('trust proxy', ...)` for Vercel
   - Use `X-Forwarded-For` header for client IP

3. **Implement email-based keying for login**
   - Key login attempts by normalized email + IP
   - Prevents shared IP from blocking different users

4. **Remove broken markAuthSuccess mechanism**
   - Replace with proper per-endpoint configuration
   - Don't try to "skip" after success

5. **Add telemetry for rate-limited requests**
   - Log 429 responses as `failure_reason=rate_limited`
   - Keep research data contract intact

### Frontend

6. **Distinguish 401 vs 429 errors**
   - Show "Too many attempts, try again in X minutes" for 429
   - Show "Invalid email or password" for 401

### Testing

7. **Add rate limit integration tests**
   - Test consecutive failed logins
   - Test successful login doesn't block
   - Test shared IP with different emails

---

## Success Criteria

- [ ] Legitimate preview/prod login works after multiple attempts
- [ ] GET /api/auth/me never returns 429
- [ ] POST /api/auth/logout never returns 429
- [ ] Failed login attempts are logged to auth_events
- [ ] Rate-limited attempts are logged with failure_reason=rate_limited
- [ ] Frontend shows clear message distinguishing 401 vs 429
- [ ] Multiple users on same IP can still log in (email-based keying)

---

*Audit completed: Ready for workstream implementation*
