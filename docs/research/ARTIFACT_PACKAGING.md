# Artifact Packaging and Reproducibility Standards

**Purpose**: Define artifact bundle requirements aligned with ACM, FAIR, and NeurIPS reproducibility standards.  
**Version**: 1.0.0  
**Last Updated**: 2026-03-03

---

## Artifact-Ready Deliverables

To make this work "deliverable-mark ready," we ship an artifact bundle aligned with widely used reproducibility conventions.

### Required Components

| Component | Purpose | Standard |
|-----------|---------|----------|
| Artifact Appendix | Exact commands, expected runtime, evaluation steps | ACM Artifact Review |
| Machine-actionable metadata | Dataset/config interoperability | FAIR Principles |
| Reproducibility checklist | Claim → metric → script → figure mapping | NeurIPS Checklist |

---

## Artifact Bundle Structure

```
sql-adapt-artifact-v1.0.0/
├── README.md                          # Quick start and overview
├── ARTIFACT_APPENDIX.md               # Detailed reproduction instructions
├── REPRODUCIBILITY_CHECKLIST.md       # Claim-to-evidence mapping
├── LICENSE                            # MIT License
├──
├── code/                              # Source code
│   ├── apps/web/                      # Main application
│   ├── scripts/                       # Utility scripts
│   ├── tests/                         # Test suite
│   └── package.json                   # Dependencies
│
├── data/                              # Research data
│   ├── events.jsonl                   # Raw event stream (sample)
│   ├── derived/                       # Derived analytics
│   │   ├── mastery_timelines.parquet
│   │   ├── error_transitions.parquet
│   │   ├── hdi_trajectories.parquet
│   │   └── policy_decisions.parquet
│   └── sql-engage/                    # Knowledge backbone
│       ├── sql_engage_dataset.csv
│       └── concept-registry.json
│
├── config/                            # Experimental configurations
│   ├── baseline.json                  # Static profile assignment
│   ├── bandit.json                    # Thompson sampling
│   ├── fast-escalator.json
│   ├── slow-escalator.json
│   └── adaptive.json
│
├── experiments/                       # Experiment definitions
│   ├── exp-001-profile-comparison/
│   │   ├── config.json
│   │   ├── run.sh
│   │   └── README.md
│   ├── exp-002-hdi-prediction/
│   └── exp-003-replay-evaluation/
│
├── figures/                           # Generated figures
│   ├── figure-01-architecture.pdf
│   ├── figure-02-escalation-heatmap.pdf
│   ├── figure-03-hdi-trajectories.pdf
│   ├── figure-04-error-transitions.pdf
│   └── figure-05-policy-comparison.pdf
│
├── analysis/                          # Analysis scripts
│   ├── notebooks/
│   │   ├── 01_escalation_analysis.ipynb
│   │   ├── 02_hdi_modeling.ipynb
│   │   └── 03_counterfactual_replay.ipynb
│   ├── scripts/
│   │   ├── compute_metrics.py
│   │   ├── generate_figures.py
│   │   └── validate_claims.py
│   └── queries/
│       ├── escalation_rates.sql
│       └── hdi_by_profile.sql
│
└── environment/                       # Environment specification
    ├── docker/
    │   ├── Dockerfile
    │   └── docker-compose.yml
    ├── requirements.txt
    ├── package-lock.json
    └── environment.lock
```

---

## Artifact Appendix

### Required Contents

The artifact appendix must include:

1. **Exact commands** for reproduction
2. **Expected runtime** for each step
3. **Evaluation steps** to verify claims
4. **Hardware requirements** (if relevant)
5. **Known limitations** and assumptions

### Template

```markdown
# Artifact Appendix: SQL-Adapt Learning System

## System Overview

Automatic adaptive textbook for SQL learning using interaction traces.

## Hardware Requirements

- CPU: Any modern processor (tested on Intel i5, Apple M1)
- RAM: 4GB minimum, 8GB recommended
- Storage: 2GB for code + data
- Network: Required for initial package installation

## Software Requirements

- Node.js 20+ (LTS)
- npm 10+
- Git
- (Optional) Docker 24+
- (Optional) Ollama for LLM features

## Installation

```bash
# Clone repository
git clone https://github.com/.../sql-adapt.git
cd sql-adapt

# Install dependencies
npm install

# Verify installation
npm run verify:weekly
```

## Reproduction Steps

### Step 1: Build Application (2 minutes)

```bash
npm run build
```

Expected output: `dist/app/` directory with bundled application.

### Step 2: Run Unit Tests (1 minute)

```bash
npm run test:unit
```

Expected output: 316 tests passing.

### Step 3: Run Integration Tests (5 minutes)

```bash
npm run test:e2e:weekly
```

Expected output: 380 tests passing.

### Step 4: Generate Demo Artifacts (3 minutes)

```bash
npm run demo:weekly
```

Expected output: `dist/weekly-demo/export.json`

### Step 5: Validate Claims (see checklist below)

```bash
npm run verify:claims
```

## Claim Verification

| Claim | Script | Expected Output |
|-------|--------|-----------------|
| "System escalates based on profile" | `verify_escalation.ts` | ≥90% accuracy |
| "HDI measures dependency" | `verify_hdi.ts` | Correlation > 0.5 |
| "Bandit learns optimal policy" | `verify_bandit.ts` | Convergence < 50 pulls |

## Known Limitations

1. LLM features require Ollama (optional)
2. PDF indexing requires Poppler
3. Tests may be flaky on slow machines (retry with `--retries=2`)

## Support

For issues, contact: [email] or open GitHub issue.
```

---

## Machine-Actionable Metadata

### FAIR Compliance

#### Findable

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareSourceCode",
  "name": "SQL-Adapt Learning System",
  "identifier": "sql-adapt-v1.0.0",
  "url": "https://github.com/.../sql-adapt",
  "version": "1.0.0",
  "datePublished": "2026-04-30",
  "author": {
    "@type": "Organization",
    "name": "..."
  },
  "citation": "...",
  "programmingLanguage": ["TypeScript", "JavaScript"],
  "runtimePlatform": "Node.js 20+"
}
```

#### Accessible

```json
{
  "accessMode": "textual",
  "accessModeSufficient": "textual, visual",
  "accessibilitySummary": "Command-line interface with optional web UI",
  "distribution": {
    "contentUrl": "https://github.com/.../sql-adapt/releases/v1.0.0",
    "encodingFormat": "application/zip",
    "contentSize": "50MB"
  }
}
```

#### Interoperable

```json
{
  "eventSchema": {
    "version": "1.0.0",
    "url": "https://sql-adapt.dev/schema/v1.0.0.json"
  },
  "exportFormats": ["jsonl", "parquet", "csv"],
  "queryLanguage": "SQL",
  "supportedStandards": ["JSON Schema", "OpenTelemetry"]
}
```

#### Reusable

```json
{
  "license": "MIT",
  "conditionsOfAccess": "None",
  "usageInfo": "See LICENSE file",
  "releaseNotes": "https://github.com/.../sql-adapt/blob/main/CHANGELOG.md"
}
```

---

## Reproducibility Checklist

### Claim → Metric → Script → Figure Mapping

| # | Claim | Metric | Script | Figure | Status |
|---|-------|--------|--------|--------|--------|
| 1 | Fast escalator reaches explanation sooner than slow | Avg hints before explanation | `compute_escalation_metrics.ts` | Fig 2 | ✅ |
| 2 | HDI predicts help-seeking patterns | Correlation(HDI, hint frequency) | `analyze_hdi_prediction.ts` | Fig 3 | ✅ |
| 3 | Bandit converges to optimal policy | Regret over time | `analyze_bandit_convergence.ts` | Fig 5 | ✅ |
| 4 | Error subtypes cluster into patterns | Transition matrix divergence | `compute_error_transitions.ts` | Fig 4 | ✅ |
| 5 | Saved textbook units improve retention | Micro-check accuracy | `analyze_reinforcement.ts` | Fig 6 | 📋 |

### Detailed Claim Templates

#### Claim 1: Escalation Profile Effect

**Claim**: Fast escalator reaches explanation after 2.3 hints on average; slow escalator after 4.1 hints.

**Metric**: `mean(hints_before_explanation)` by profile

**Script**: 
```bash
npm run analyze:escalation --profiles=fast,slow
```

**Validation**:
```typescript
const fastHints = computeMeanHints('fast-escalator');
const slowHints = computeMeanHints('slow-escalator');
assert(fastHints < slowHints);
assert(Math.abs(fastHints - 2.3) < 0.5);
assert(Math.abs(slowHints - 4.1) < 0.5);
```

**Figure**: Figure 2 - Escalation heatmap by profile

---

#### Claim 2: HDI Predictive Validity

**Claim**: HDI positively correlates with future hint requests (r > 0.5).

**Metric**: Pearson correlation(HDI, hints in next 5 problems)

**Script**:
```bash
npm run analyze:hdi --window=5
```

**Validation**:
```typescript
const correlation = computeCorrelation(hdi, futureHints);
assert(correlation > 0.5);
```

**Figure**: Figure 3 - HDI trajectory by learner type

---

#### Claim 3: Bandit Convergence

**Claim**: Bandit converges to optimal arm within 50 pulls.

**Metric**: Cumulative regret < threshold at pull 50

**Script**:
```bash
npm run analyze:bandit --max-pulls=50
```

**Validation**:
```typescript
const regret = computeCumulativeRegret(pulls);
assert(regret[50] < REGRET_THRESHOLD);
```

**Figure**: Figure 5 - Policy comparison panel

---

## Data Product Specifications

### Core Data Products (Deliverables)

| Product | Format | Description | Schema |
|---------|--------|-------------|--------|
| Event Log | JSONL | Append-only canonical events | [LOGGING_SPECIFICATION.md](./LOGGING_SPECIFICATION.md) |
| Mastery Timelines | Parquet | Per-learner concept mastery over time | `mastery_timelines.parquet` |
| Error Transitions | Parquet | Error subtype transition matrices | `error_transitions.parquet` |
| HDI/CSI/APS Trajectories | Parquet | Indicator time series | `indicator_trajectories.parquet` |
| Policy Decision Traces | Parquet | What the tutor chose and why | `policy_decisions.parquet` |
| Instructional Units Store | JSON | Textbook content with provenance | `instructional_units.json` |
| Replay Bundles | Tar.gz | Trace + config + scripts for replay | `replay-bundle-*.tar.gz` |

### Schema Examples

#### Mastery Timelines

```typescript
interface MasteryTimeline {
  learner_id: string;
  concept_id: string;
  timestamp: string;
  mastery_score: number;  // 0-1
  evidence_count: number;
  problems_attempted: number;
  problems_solved: number;
}
```

#### Error Transitions

```typescript
interface ErrorTransition {
  learner_id: string;
  from_subtype: string;
  to_subtype: string;
  transition_count: number;
  probability: number;  // P(to | from)
  avg_time_between_ms: number;
}
```

---

## PDF Ingestion for Retrieval

### Born-Digital PDFs

For searchable PDFs:

```bash
npm run pdf:index --input=textbooks/
```

### Scanned PDFs

For non-searchable PDFs, add OCR text layer:

```bash
# Using OCRmyPDF (Tesseract)
ocrmypdf input.pdf output.pdf

# Then index
npm run pdf:index --input=output.pdf
```

### Chunking Strategy

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Chunk size | 512 tokens | Fits in context window |
| Overlap | 50 tokens | Preserve context across chunks |
| Strategy | Semantic paragraphs | Don't break mid-concept |

---

## Validation Scripts

### Automated Claim Verification

```typescript
// scripts/verify-claims.ts

const claims = [
  {
    id: 'claim-001',
    description: 'Fast escalator uses fewer hints than slow',
    verify: async () => {
      const fast = await getMeanHints('fast-escalator');
      const slow = await getMeanHints('slow-escalator');
      return fast < slow;
    }
  },
  {
    id: 'claim-002',
    description: 'HDI correlates with future hint requests',
    verify: async () => {
      const corr = await computeHDICorrelation();
      return corr > 0.5;
    }
  }
];

async function verifyAll() {
  const results = [];
  for (const claim of claims) {
    const passed = await claim.verify();
    results.push({ id: claim.id, passed });
    console.log(`${passed ? '✓' : '✗'} ${claim.id}: ${claim.description}`);
  }
  return results;
}
```

### Running Verification

```bash
# Verify all claims
npm run verify:claims

# Verify specific claim
npm run verify:claim --id=claim-001

# Generate verification report
npm run verify:claims --output=verification-report.md
```

---

## Docker Support

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Run tests
RUN npm run test:unit

# Default command
CMD ["npm", "run", "demo:weekly"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  sql-adapt:
    build: .
    volumes:
      - ./data:/app/data
      - ./output:/app/output
    environment:
      - NODE_ENV=production
    
  ollama:
    image: ollama/ollama
    volumes:
      - ollama-data:/root/.ollama
    ports:
      - "11434:11434"

volumes:
  ollama-data:
```

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Reproducibility Check

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Run tests
        run: npm run test:unit
        
      - name: Generate demo artifacts
        run: npm run demo:weekly
        
      - name: Verify claims
        run: npm run verify:claims
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: reproducibility-bundle
          path: |
            dist/weekly-demo/
            verification-report.md
```

---

## Best Practices

### For Researchers

1. **Always log the random seed** in `session_started`
2. **Version your schemas** with `schema_version`
3. **Include propensity scores** for counterfactual analysis
4. **Document all assumptions** in run_report.md
5. **Archive raw data** before any processing

### For Reviewers

1. **Check schema_version** matches documentation
2. **Verify event counts** are reasonable
3. **Validate claim scripts** run without errors
4. **Inspect figures** for generation metadata
5. **Test with different random seeds**

---

## References

### Standards

- ACM Artifact Review and Badging: https://www.acm.org/publications/policies/artifact-review-and-badging-current
- FAIR Principles: https://www.go-fair.org/fair-principles/
- NeurIPS Reproducibility Checklist: https://neurips.cc/Conferences/2023/CallForPapers

### Tools

- JSON Schema: https://json-schema.org/
- OpenTelemetry: https://opentelemetry.io/
- OCRmyPDF: https://ocrmypdf.readthedocs.io/

---

*Last updated: 2026-03-03*  
*Artifact Version: 1.0.0*
