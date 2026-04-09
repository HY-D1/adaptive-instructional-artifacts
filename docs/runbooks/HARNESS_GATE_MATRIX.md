# Harness Gate Matrix

**Version:** hardening/research-grade-tightening  
**Purpose:** Prevent local fixes from breaking cross-system behavior

---

## Gate Definitions

| Gate | Lane | Description | Test Command |
|------|------|-------------|--------------|
| A | Boot/Runtime | App boots without runtime errors | `npm run build` |
| B | Auth/Login | Login/logout flow, session creation | `npm run test:unit -- --run --grep auth` |
| C | Student Session | Session restore, problem state | `npm run test:unit -- --run --grep session` |
| D | Solved Progress | Progress hydration, UI refresh | `npm run test:unit -- --run --grep progress` |
| E | Notes/Textbook | Textbook sync, note persistence | `npm run test:unit -- --run --grep textbook` |
| F | Instructor/Research | Analytics, research logging | `npm run test:unit -- --run --grep research` |
| G | Storage/Quota | Quota management, cleanup | `npm run test:unit -- --run --grep quota` |

---

## Current Status

| Gate | Status | Evidence |
|------|--------|----------|
| A | ✅ PASS | Build 2.87s, 2875 modules |
| B | ✅ PASS | Auth tests pass |
| C | ✅ PASS | Session persistence verified |
| D | ✅ PASS | Solved refresh triggered |
| E | ✅ PASS | Storage tests pass |
| F | ✅ PASS | Research gate passes |
| G | ✅ PASS | Quota resilience passes |

**Overall: 7/7 GREEN** ✅

---

## Merge Policy

1. **Local fix must pass:**
   - Its own gate
   - One neighboring gate
   - Boot/Runtime gate (A)

2. **No merge if:**
   - Any gate is RED
   - Cross-system regression detected
   - Auth/Storage corruption scan fails

3. **Required verification:**
   ```bash
   npm run integrity:scan
   npm run build
   npm run test:unit -- --run
   ```
