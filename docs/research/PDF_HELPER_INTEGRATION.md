# PDF Helper Integration Guide

**Purpose**: Document the relationship between `algl-pdf-helper` and SQL-Adapt

---

## Architecture

```
┌─────────────────────┐         ┌──────────────────────────────┐
│  algl-pdf-helper    │         │  adaptive-instructional-     │
│  (Python CLI Tool)  │  ────▶  │  artifacts (React App)       │
│                     │ Export  │                              │
│ - OCR PDFs          │         │ - Interactive learning       │
│ - Extract concepts  │         │ - Hint escalation            │
│ - Generate chunks   │         │ - Textbook accumulation      │
│ - Create embeddings │         │ - Research dashboard         │
└─────────────────────┘         └──────────────────────────────┘
            │
            ▼
   apps/web/public/textbook-static/
   ├── concept-map.json
   └── concepts/*.md
```

---

## When to Use PDF Helper

### Use Cases
1. **Adding a new textbook** to the system
2. **Updating textbook content** after PDF changes
3. **Re-processing with new concept mappings**
4. **Generating initial concept structure**

### Don't Use For
- Runtime content retrieval (use SQL-Adapt's built-in PDF index)
- Student-facing operations
- Dynamic content generation

---

## Integration Flow

### Step 1: Process PDF (in algl-pdf-helper)

```bash
cd /Users/harrydai/Desktop/Personal Portfolio/algl-pdf-helper

# Place PDF in raw_pdf/
cp my-textbook.pdf raw_pdf/

# Run processing
./start.sh
# → Select: Process All PDFs
# → Select: Use OCR (if scanned)
# → Select: Export to SQL-Adapt
```

### Step 2: Verify Export

Check that content was exported:

```bash
ls -la apps/web/public/textbook-static/
# Should see:
# ├── concept-map.json
# └── concepts/
#     ├── select-basic.md
#     ├── where-clause.md
#     └── ...
```

### Step 3: Build SQL-Adapt

```bash
cd /Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts
npm run build
```

Static content is now bundled with the app.

---

## Content Contract

### Expected Output Structure

```
textbook-static/
├── concept-map.json          # Concept metadata and chunk mappings
└── concepts/                 # Individual concept markdown files
    ├── README.md            # Index of all concepts
    ├── {concept-id}.md      # One file per concept
    └── ...
```

### Concept Map Schema

```typescript
interface ConceptMap {
  version: string;
  generatedAt: string;
  sourceDocId: string;
  concepts: Record<string, ConceptMapEntry>;
}

interface ConceptMapEntry {
  title: string;
  definition: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  pageNumbers: number[];
  chunkIds: Record<string, string[]>;  // section -> chunk IDs
  relatedConcepts: string[];
  practiceProblemIds: string[];
}
```

---

## Configuration

### Export Path

The PDF helper exports to a **hardcoded path**:

```python
# In algl-pdf-helper/src/algl_pdf_helper/export_sqladapt.py
DEFAULT_OUTPUT_DIR = Path("/Users/harrydai/Desktop/Personal Portfolio/adaptive-instructional-artifacts/apps/web/public/textbook-static")
```

To change this, modify the path in `export_sqladapt.py` or use environment variables.

### Adding to .gitignore

The exported content is **not** in git (it's generated):

```gitignore
# In adaptive-instructional-artifacts/.gitignore
apps/web/public/textbook-static/
```

To preserve a specific version, commit it explicitly:

```bash
git add -f apps/web/public/textbook-static/concept-map.json
git add -f apps/web/public/textbook-static/concepts/
```

---

## Development Workflow

### Scenario 1: Adding New Textbook

```bash
# 1. Add PDF to helper
cp new-textbook.pdf ../algl-pdf-helper/raw_pdf/

# 2. Update concepts.yaml if needed
vim ../algl-pdf-helper/concepts.yaml

# 3. Process
cd ../algl-pdf-helper && ./start.sh

# 4. Verify in SQL-Adapt
cd ../adaptive-instructional-artifacts
npm run dev
# Navigate to textbook view, verify content appears
```

### Scenario 2: Concept Refinement

```bash
# 1. Edit concept definitions
cd ../algl-pdf-helper
vim concepts.yaml

# 2. Re-process (faster than full OCR)
./start.sh
# → Select: Re-process existing

# 3. Check diff
git diff apps/web/public/textbook-static/
```

---

## Troubleshooting

### Issue: Export path not found

```bash
# Ensure directory exists
mkdir -p apps/web/public/textbook-static
```

### Issue: Content not appearing in app

1. Check export succeeded:
   ```bash
   ls -la apps/web/public/textbook-static/concepts/
   ```

2. Restart dev server (static files cached):
   ```bash
   npm run dev
   ```

3. Check browser console for 404 errors

### Issue: OCR not working

OCR requires system dependencies:

```bash
# macOS
brew install tesseract ghostscript

# Ubuntu
sudo apt-get install tesseract-ocr ghostscript
```

---

## Future Considerations

### Potential Integration (Keep Separate for Now)

If you want tighter integration later, consider:

1. **Git Submodule** (not recommended - adds complexity)
   ```bash
   git submodule add ../algl-pdf-helper scripts/pdf-helper
   ```

2. **NPM Script Wrapper** (better)
   ```json
   {
     "scripts": {
       "pdf:process": "cd ../algl-pdf-helper && ./start.sh",
       "pdf:export": "cd ../algl-pdf-helper && algl-pdf export"
     }
   }
   ```

3. **Docker Container** (for deployment)
   - Containerize PDF helper
   - Mount output directory to SQL-Adapt

### Keep Separate Because

- PDF processing is **not** part of the research system
- It's a **content preparation** tool
- Different deployment requirements
- Heavy dependencies not needed for runtime

---

## Quick Reference

| Task | Location | Command |
|------|----------|---------|
| Process PDF | algl-pdf-helper | `./start.sh` |
| Export content | algl-pdf-helper | Select "Export to SQL-Adapt" |
| View concepts | SQL-Adapt | Navigate to Textbook page |
| Update mapping | algl-pdf-helper | Edit `concepts.yaml` |
| Debug export | algl-pdf-helper | Check `export_sqladapt.py` |

---

*Last updated: 2026-02-27*
