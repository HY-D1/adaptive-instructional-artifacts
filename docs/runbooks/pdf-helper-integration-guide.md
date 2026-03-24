# PDF Helper → Adaptive App Integration Contract

This document is the **repo-relative contract** for exporting processed PDF data from the helper project and ingesting it into the adaptive repo. No absolute paths appear here; every path is expressed relative to one of two roots:

- `$REPO_ROOT` — the root of *this* repository (`adaptive-instructional-artifacts/`)
- `$HELPER_ROOT` — the root of your PDF-helper project (any location)

---

## Overview

```text
PDF helper project          adaptive-instructional-artifacts/
─────────────────           ────────────────────────────────
Processes PDF(s)       →    $REPO_ROOT/apps/web/public/textbook-static/
Generates:                    concept-map.json
  concept-map.json            textbook-manifest.json
  textbook-manifest.json      chunks-metadata.json
  chunks-metadata.json        concepts/
  concepts/{docId}/*.md         {docId}/
                                  {conceptId}.md
```

The adaptive repo ships with a sync script that copies an export directory into `textbook-static/` and then runs the corpus validation gate.

---

## Input Paths (helper reads from the adaptive repo)

| Purpose             | Repo-relative path                               |
| ------------------- | ------------------------------------------------ |
| PDF chunks index    | `dist/pdf-index/chunks.json`                     |
| PDF index manifest  | `dist/pdf-index/manifest.json`                   |
| Full index document | `dist/pdf-index/index.json`                      |
| Concept registry    | `apps/web/src/app/data/concept-registry.json`    |

In your helper script, derive these dynamically:

```python
import os
REPO_ROOT = os.environ.get("SQL_ADAPT_ROOT", os.path.abspath("../adaptive-instructional-artifacts"))

PDF_CHUNKS_FILE       = os.path.join(REPO_ROOT, "dist/pdf-index/chunks.json")
PDF_MANIFEST_FILE     = os.path.join(REPO_ROOT, "dist/pdf-index/manifest.json")
CONCEPT_REGISTRY_FILE = os.path.join(REPO_ROOT, "apps/web/src/app/data/concept-registry.json")
```

Set `SQL_ADAPT_ROOT` in your shell or `.env` before running the helper:

```bash
export SQL_ADAPT_ROOT="$(cd ../adaptive-instructional-artifacts && pwd)"
```

---

## Output Contract (helper writes here, then we sync)

The helper must produce a **self-contained export directory** with this structure:

```text
{export-dir}/
  concept-map.json          # required
  textbook-manifest.json    # strongly recommended
  chunks-metadata.json      # optional
  concepts/
    {docId}/
      {conceptId}.md        # one file per concept
    {docId}/
      {conceptId}.md
```

### concept-map.json schema

```json
{
  "version": "1.0.0",
  "generatedAt": "{ISO-8601 timestamp}",
  "sourceDocIds": [
    "murachs-mysql-3rd-edition",
    "dbms-ramakrishnan-3rd-edition"
  ],
  "concepts": {
    "{docId}/{conceptId}": {
      "title": "...",
      "definition": "...",
      "difficulty": "beginner | intermediate | advanced",
      "pageNumbers": [],
      "chunkIds": {
        "definition": ["{docId}:p{n}:c{n}"],
        "examples": [],
        "commonMistakes": []
      },
      "relatedConcepts": ["{docId}/{conceptId}"],
      "practiceProblemIds": [],
      "sourceDocId": "{docId}"
    }
  }
}
```

**Critical**: `sourceDocIds` must list **all** textbook IDs whose concepts appear in the map. The corpus validation gate enforces that both `murachs-mysql-3rd-edition` and `dbms-ramakrishnan-3rd-edition` are present.

---

## Syncing into the Adaptive Repo

After the helper produces its export directory, run from `$REPO_ROOT`:

```bash
npm run textbook:sync -- {path-to-export-dir}
```

Example (helper export lives next to the repo):

```bash
npm run textbook:sync -- ../algl-pdf-helper/export
```

The sync script (`scripts/sync-helper-export.mjs`) will:

1. Validate the export directory structure.
2. Copy `concept-map.json`, `textbook-manifest.json`, `chunks-metadata.json` into `apps/web/public/textbook-static/`.
3. Merge `concepts/{docId}/` trees into the same location (new files overwrite existing; files not in the export are kept).
4. Run `node scripts/validate-corpus.mjs` automatically.

The sync exits non-zero if validation fails — **do not commit a corpus that fails validation**.

---

## Verifying the Corpus

```bash
npm run textbook:verify
```

This runs `scripts/validate-corpus.mjs` which checks:

1. `concept-map.json` exists.
2. `sourceDocIds` contains **both** `murachs-mysql-3rd-edition` and `dbms-ramakrishnan-3rd-edition`.
3. `textbook-manifest.json` exists.
4. Concept directories exist for each required source doc.
5. Every concept-map entry resolves to an existing `.md` file.

Exit 0 = corpus is valid. Exit 1 = one or more checks failed.

---

## Concept Markdown Format

Each concept file must have this structure (parsed by `concept-loader.ts`).

Required sections:

- `## Definition` — one-sentence definition.
- `## Explanation` — 2–3 paragraphs.
- `## Examples` — one or more `### Example N: Title` subsections, each with a `sql` code block.
- `## Common Mistakes` — one or more `### Mistake N: Title` subsections with **Incorrect:**, **Correct:**, and **Why this happens:** blocks.

Example skeleton:

```markdown
# Concept Title

## Definition

One-sentence definition of the concept.

## Explanation

Two to three paragraphs explaining the concept in depth.

## Examples

### Example 1: Descriptive Title

(sql code block here)

Explanation of what this example demonstrates.

## Common Mistakes

### Mistake 1: Descriptive Title

**Incorrect:**
(sql code block with wrong code)

**Correct:**
(sql code block with correct code)

**Why this happens:** Short explanation of the root cause.

---

*Source: Textbook Title, Author, Edition*
```

See `apps/web/public/textbook-static/concepts/murachs-mysql-3rd-edition/` for working examples.

---

## Rebuilding the PDF Index (inputs to the helper)

If you need to regenerate the PDF chunk index from scratch:

```bash
# Single PDF
node scripts/build-pdf-index.mjs textbooks/murachs-mysql-3rd-edition.pdf

# Directory of PDFs
node scripts/build-pdf-index.mjs textbooks/

# Custom output directory
node scripts/build-pdf-index.mjs textbooks/murachs-mysql-3rd-edition.pdf dist/pdf-index
```

Requires `pdftotext` (Poppler):

```bash
# macOS
brew install poppler

# Ubuntu/Debian
sudo apt-get install poppler-utils
```

---

## Path Quick Reference (repo-relative)

| Purpose           | Path                                                              |
| ----------------- | ----------------------------------------------------------------- |
| Corpus root       | `apps/web/public/textbook-static/`                                |
| Concept map       | `apps/web/public/textbook-static/concept-map.json`                |
| Textbook manifest | `apps/web/public/textbook-static/textbook-manifest.json`          |
| Concept files     | `apps/web/public/textbook-static/concepts/{docId}/{conceptId}.md` |
| Concept registry  | `apps/web/src/app/data/concept-registry.json`                     |
| PDF chunk index   | `dist/pdf-index/`                                                 |
| Sync script       | `scripts/sync-helper-export.mjs`                                  |
| Validation gate   | `scripts/validate-corpus.mjs`                                     |
