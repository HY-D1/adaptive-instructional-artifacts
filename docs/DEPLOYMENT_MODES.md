# Deployment Modes Capability Matrix

**Version**: 1.0.0  
**Last Updated**: 2026-03-15

This document provides a clear reference for which features work in **local development** vs **hosted/Vercel demo** mode.

---

## Quick Reference

| Capability | Local Dev (`npm run dev`) | Hosted Demo (Vercel) |
|------------|---------------------------|----------------------|
| **SQL Practice (32 problems)** | ✅ Full | ✅ Full |
| **Progressive Hints (3-rung ladder)** | ✅ Full | ✅ Full |
| **SQL-Engage Dataset Hints** | ✅ Full | ✅ Full |
| **Automatic Textbook** | ✅ Full | ✅ Full |
| **Student/Instructor Roles** | ✅ Full | ✅ Full* |
| **Research Dashboard** | ✅ Full | ✅ Deterministic |
| **Replay & Strategy Comparison** | ✅ Full | ✅ Deterministic |
| **AI-Powered Explanations (LLM)** | ✅ With Ollama | ❌ Unavailable |
| **PDF Search & Chat** | ✅ With backend | ❌ Unavailable |
| **PDF Upload & Index Building** | ✅ Local only | ❌ Unavailable |
| **Backend API Persistence** | ✅ Optional | ❌ localStorage only |

\* Instructor mode requires `VITE_INSTRUCTOR_PASSCODE` at build time on Vercel

---

## Detailed Capability Matrix

### Core Learning Features (Always Available)

| Feature | Local | Hosted | Notes |
|---------|-------|--------|-------|
| SQL Editor (Monaco) | ✅ | ✅ | In-browser, no backend needed |
| 32 Practice Problems | ✅ | ✅ | Static dataset |
| Schema Visualization | ✅ | ✅ | Generated from metadata |
| Query Execution | ✅ | ✅ | sql.js WASM in browser |
| Error Classification | ✅ | ✅ | Client-side pattern matching |
| 3-Rung Hint Ladder | ✅ | ✅ | Progressive escalation logic |
| SQL-Engage Hints | ✅ | ✅ | Deterministic templates |
| Automatic Textbook | ✅ | ✅ | localStorage persistence |
| Concept Coverage Map | ✅ | ✅ | Pre-computed from traces |
| HDI Calculation | ✅ | ✅ | Client-side from interactions |
| Cross-Tab Sync | ✅ | ✅ | BroadcastChannel API |

### Research Features (Deterministic in Hosted Mode)

| Feature | Local | Hosted | Notes |
|---------|-------|--------|-------|
| Research Dashboard | ✅ | ✅ | Hosted uses deterministic replay |
| Strategy Comparison | ✅ | ✅ | Local: LLM-enhanced; Hosted: template-based |
| Replay Visualization | ✅ | ✅ | Both modes support replay |
| Escalation Heatmap | ✅ | ✅ | Generated from interaction data |
| Error Transition View | ✅ | ✅ | Client-side computation |
| Mastery Timeline | ✅ | ✅ | Client-side computation |
| Learner Clustering | ✅ | ✅ | Client-side algorithms |
| Export Session Data | ✅ | ✅ | JSON download |

### AI-Powered Features (Local Only)

| Feature | Local | Hosted | Notes |
|---------|-------|--------|-------|
| LLM-Generated Explanations | ✅ With Ollama | ❌ | Requires local Ollama instance |
| AI Textbook Units | ✅ With Ollama | ❌ | Falls back to deterministic templates |
| Context-Aware Hints | ✅ With Ollama | ❌ | Falls back to SQL-Engage dataset |
| "Ask My Textbook" Chat | ✅ With backend | ❌ | Requires PDF index + LLM |
| Source Grounding (PDF) | ✅ With PDF index | ❌ | Citation links show but don't resolve |

### Infrastructure Features (Local Only)

| Feature | Local | Hosted | Notes |
|---------|-------|--------|-------|
| PDF Upload | ✅ | ❌ | Requires backend file system |
| PDF Index Building | ✅ | ❌ | Requires Poppler + backend |
| PDF Search | ✅ | ❌ | Requires vector index |
| Backend API Persistence | ✅ Optional | ❌ | Hosted uses localStorage only |
| Server-Side Analytics | ✅ | ❌ | Hosted uses client-side only |

---

## Environment Variable Requirements

### Build-Time Variables (Vercel)

These are **embedded at build time** and cannot be changed without redeploy:

| Variable | Hosted Required | Local Required | Purpose |
|----------|-----------------|----------------|---------|
| `VITE_INSTRUCTOR_PASSCODE` | ✅ Yes | ⚠️ Dev fallback | Enables instructor role selection |
| `VITE_API_BASE_URL` | ❌ No | ❌ No | Backend API URL (hosted usually has no backend) |
| `VITE_ENABLE_LLM` | ❌ No | ❌ No | UI toggle (always false on hosted) |
| `VITE_ENABLE_PDF_INDEX` | ❌ No | ❌ No | UI toggle (always false on hosted) |

### Runtime Detection

The system automatically detects hosted mode via `runtime-config.ts`:

```typescript
// Detects Vercel, Netlify, or production without backend
isHostedMode() // returns true on Vercel

// Checks if instructor mode should be shown
isInstructorModeAvailable() // requires VITE_INSTRUCTOR_PASSCODE on hosted

// Always returns false on hosted
isLLMAvailable() // local Ollama only
isPDFIndexAvailable() // local backend only
```

---

## Hosted Mode Limitations

### What Changes in Hosted Mode

1. **Deterministic Content Generation**: Instead of LLM-generated explanations, the system uses:
   - SQL-Engage dataset templates
   - Error-specific templates from `error-templates.ts`
   - Pre-computed concept explanations

2. **localStorage Persistence**: All data stored in browser localStorage:
   - User profile
   - Interaction events
   - Textbook units
   - Session state

3. **No Backend API Calls**: The app never attempts to call:
   - `/api/llm/*` endpoints
   - `/api/pdf-index/*` endpoints
   - `/api/learners` (uses localStorage)

4. **Instructor Mode Gated**: Requires `VITE_INSTRUCTOR_PASSCODE` to be set at build time

### User-Facing Messages

Hosted mode shows appropriate messages when features are unavailable:

- **Research Dashboard**: "Research features use deterministic mode. PDF indexing and LLM require local deployment."
- **PDF Features**: "PDF upload and index building are not available in hosted mode."
- **LLM Features**: "LLM features are not available in hosted mode. Run locally with Ollama."

---

## Reproducing Each Mode

### Local Full Demo

```bash
# 1. Install dependencies
npm install

# 2. Create .env (optional - has dev fallbacks)
cp apps/web/.env.example apps/web/.env

# 3. Start dev server
npm run dev

# 4. Open http://localhost:5173
```

**Features available**: Everything (LLM if Ollama running, backend API if `npm run server:dev`)

### Hosted/Demo-Mode Build

```bash
# 1. Set required environment variable
export VITE_INSTRUCTOR_PASSCODE=TeachSQL2024

# 2. Build for production
npm run build

# 3. Verify hosted mode detection
grep -r "isHostedMode" dist/app/assets/*.js | head -5

# 4. Deploy dist/app to Vercel/Netlify
```

**Features available**: Deterministic hints, textbook, research dashboard (no LLM/PDF)

---

## Testing Mode Detection

Add this to browser console on any deployment:

```javascript
import('./lib/runtime-config.ts').then(m => m.logRuntimeConfig())
```

Expected output on **hosted**:
```
🔧 Runtime Configuration
  Instructor Mode: ✅ Available
  LLM Features: ❌ Not available (local dev only)
  PDF Index: ❌ Disabled
  Backend API: ❌ Not configured
  Hosted Mode: ☁️ Yes (Vercel/Netlify)
```

Expected output on **local**:
```
🔧 Runtime Configuration
  Instructor Mode: ✅ Available
  LLM Features: ✅ Available (or ❌ if Ollama not running)
  PDF Index: ✅ Enabled (or ❌ if not configured)
  Backend API: ✅ http://localhost:3001 (or ❌ if not running)
  Hosted Mode: 🖥️ No (full-stack)
```

---

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment procedures
- [runtime-config.ts](../apps/web/src/app/lib/runtime-config.ts) - Mode detection implementation
- [DETERMINISTIC_TEXTBOOK_GENERATION.md](./DETERMINISTIC_TEXTBOOK_GENERATION.md) - How hints work without LLM

---

*Last updated: 2026-03-15*
