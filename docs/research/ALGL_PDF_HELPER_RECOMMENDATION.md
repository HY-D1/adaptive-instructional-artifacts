# Recommendation: Keep algl-pdf-helper Separate

**Date**: 2026-02-27  
**Decision**: Do NOT integrate `algl-pdf-helper` into `adaptive-instructional-artifacts`

---

## Executive Summary

After analyzing both projects, I recommend **keeping them as separate repositories**. They have different purposes, tech stacks, and lifecycles. The current one-way integration (PDF Helper → SQL-Adapt via file export) is the correct architecture.

---

## Project Comparison

| Aspect | `algl-pdf-helper` | `adaptive-instructional-artifacts` |
|--------|-------------------|-----------------------------------|
| **Primary Language** | Python 3.10+ | TypeScript 5.8 |
| **Framework** | CLI Tool (Typer) | React 18 + Vite |
| **Runtime** | Build-time / Dev-time | Browser runtime |
| **Dependencies** | Heavy (OCR, Tesseract, PyMuPDF) | Light (React, sql.js) |
| **Purpose** | Content preparation | Interactive learning |
| **Usage Frequency** | Once per textbook | Continuous |
| **Output** | Static JSON/Markdown | Interactive web app |

---

## Why Integration Would Be Problematic

### 1. Technology Mismatch
```
❌ Cannot easily mix Python + TypeScript in one project
❌ Would require complex build pipeline
❌ Different dependency management (pip vs npm)
```

### 2. Runtime vs Build-time
```
PDF Helper:    Run once → Generate static content → Done
SQL-Adapt:     Continuous runtime → Serve content → Interactive
```

Mixing these would:
- Add unnecessary Python runtime to a web app
- Increase deployment complexity
- Make CI/CD harder

### 3. Dependency Bloat
```
PDF Helper Dependencies:
- ocrmypdf (OCR pipeline)
- tesseract (OCR engine) 
- ghostscript (PDF processing)
- pymupdf (PDF extraction)
- ~500MB+ system dependencies

SQL-Adapt Dependencies:
- React, sql.js, Monaco editor
- All client-side, ~2MB bundle
```

Adding PDF helper deps would make SQL-Adapt deployment much heavier.

### 4. Different Deployment Targets
```
PDF Helper:    Developer machine, occasional use
SQL-Adapt:     Vercel/Static hosting, continuous availability
```

---

## Current Integration (Good)

### One-Way Data Flow
```
algl-pdf-helper/
├── Process PDF
├── Extract concepts  
├── Generate chunks
└── Export to ───▶ adaptive-instructional-artifacts/
                    └── apps/web/public/textbook-static/
                        ├── concept-map.json
                        └── concepts/*.md
```

### How It Works
1. Developer runs PDF helper to process textbook
2. Helper exports static content to SQL-Adapt's `public/` folder
3. SQL-Adapt builds with static content included
4. App serves content at runtime

### Benefits
✅ Clean separation of concerns  
✅ PDF processing doesn't affect app runtime  
✅ App remains lightweight  
✅ Can process PDFs without rebuilding app  
✅ Easy to update content independently  

---

## Improvements Made (Don't Merge)

Instead of merging, I've made the integration smoother:

### 1. Integration Documentation
- Created `docs/PDF_HELPER_INTEGRATION.md`
- Documents the relationship clearly
- Provides troubleshooting guide

### 2. NPM Script Helpers
Added to `package.json`:
```json
{
  "textbook:process": "echo 'Run: cd ../algl-pdf-helper && ./start.sh'",
  "textbook:export": "echo 'Run: cd ../algl-pdf-helper && algl-pdf export'",
  "textbook:verify": "ls -la apps/web/public/textbook-static/"
}
```

Usage:
```bash
npm run textbook:verify  # Check if content exists
npm run textbook:process # Shows instructions
```

### 3. Documentation Links
- Updated `docs/README.md` with link to integration guide
- Clear reference in main documentation index

---

## When Would Integration Make Sense?

Consider merging ONLY if:

1. **PDF processing becomes runtime feature**
   - Students upload PDFs directly
   - Real-time processing required
   - Not your current use case

2. **Single deployment target needed**
   - Both must run on same server
   - Not applicable (PDF helper is dev tool)

3. **Shared code becomes significant**
   - >20% code shared
   - Currently 0% shared (different languages)

**None of these apply to your project.**

---

## Alternative: Git Submodule (Not Recommended)

If you want tighter git integration:

```bash
# Option: Add as submodule (NOT RECOMMENDED)
git submodule add ../algl-pdf-helper scripts/pdf-helper
```

**Why not:**
- Adds complexity
- Submodules are error-prone
- No real benefit over separate repos

---

## Recommended Workflow

### For Content Updates
```bash
# 1. Process PDF in helper
cd ../algl-pdf-helper
./start.sh
# → Select: Process PDF
# → Select: Export to SQL-Adapt

# 2. Verify in SQL-Adapt
cd ../adaptive-instructional-artifacts
npm run textbook:verify

# 3. Test
npm run dev
# Check textbook content appears

# 4. Commit (if needed)
git add -f apps/web/public/textbook-static/
git commit -m "content: Update textbook from PDF processing"
```

### For Development
```bash
# Terminal 1: Run SQL-Adapt
cd adaptive-instructional-artifacts
npm run dev

# Terminal 2: Run PDF helper (when needed)
cd algl-pdf-helper
./start.sh
```

---

## Summary

| Approach | Recommendation | Reason |
|----------|---------------|--------|
| **Keep Separate** | ✅ **DO THIS** | Correct architecture |
| Merge repos | ❌ Don't do | Tech mismatch, complexity |
| Git submodule | ❌ Don't do | Unnecessary complexity |
| NPM workspace | ❌ Don't do | Different languages |

### Key Points
1. PDF helper is a **build tool**, not part of the runtime app
2. Different tech stacks = keep separate
3. One-way export is the right pattern
4. Documentation improvements make integration clear

---

## Files Created

| File | Purpose |
|------|---------|
| `docs/PDF_HELPER_INTEGRATION.md` | Complete integration guide |
| `docs/ALGL_PDF_HELPER_RECOMMENDATION.md` | This recommendation document |

---

## Next Steps

1. ✅ Keep projects separate (no action needed)
2. ✅ Use integration guide when processing PDFs
3. ✅ Use npm scripts for verification
4. ⏭️ Continue with 6-week implementation plan

---

*Recommendation made: 2026-02-27*  
*Rationale: Architecture fit, tech stack separation, deployment simplicity*
