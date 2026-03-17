# Documentation Index — Adaptive Instructional Artifacts

This folder is coordinated as a small documentation system, not independent notes.

**Current Focus**: Research Architecture Documentation (Week 5 Complete)  
**Status**: Week 5 Complete. 316 unit tests + 380 E2E tests (696 total) passing.  
**Research Phase**: Feb 1 – April 30, 2026

---

## 📁 Documentation Structure

```
docs/
├── README.md                      # This file - Documentation index
├── DEPLOYMENT.md                  # Deployment procedures and configuration
├── DEPLOYMENT_MODES.md            # Local vs hosted capability matrix
├── research/                      # Research architecture & design
│   ├── PROJECT_OVERVIEW.md        # Executive summary & research vision
│   ├── RESEARCH_ARCHITECTURE.md   # System architecture & 17 components
│   ├── LOGGING_SPECIFICATION.md   # Event schema & reproducibility
│   ├── ARTIFACT_PACKAGING.md      # Artifact bundle standards
│   ├── ESCALATION_POLICIES.md     # Component 7: Escalation profiles
│   ├── MULTI_ARMED_BANDIT.md      # Component 8: Bandit learning
│   ├── HDI.md                     # Component 9: Dependency index
│   ├── KNOWLEDGE_CONSOLIDATION.md # Component 10: Spaced reinforcement
│   ├── ERROR_TRAJECTORY.md        # Component 11: Error modeling
│   ├── COGNITIVE_LOAD_PROXY.md    # Component 12: CSI
│   ├── COUNTERFACTUAL_REPLAY.md   # Component 13: Offline evaluation
│   ├── CONCEPT_GRAPH.md           # Component 14: Prerequisites
│   ├── SELF_EXPLANATION.md        # Component 15: RQS scoring
│   ├── EXPERIMENTAL_MANIPULATIONS.md  # Component 16: A/B testing
│   ├── AFFECTIVE_PROXY.md         # Component 17: Frustration detection
│   ├── 6_WEEK_IMPLEMENTATION_PLAN.md  # Detailed timeline
│   ├── IMPLEMENTATION_COORDINATION.md # Dependency matrix
│   ├── GOAL_ALIGNMENT_SUMMARY.md      # Success criteria
│   ├── PDF_HELPER_INTEGRATION.md      # PDF pipeline docs
│   ├── ALGL_PDF_HELPER_RECOMMENDATION.md
│   ├── ENHANCED_HINTS_FEATURE.md
│   └── assignment-strategy-simulations-report.md
├── runbooks/                      # Operational guides
│   ├── progress.md                # Architecture & milestones
│   ├── weekly-progress.md         # Active checkpoint log
│   ├── weekly-demo.md             # Demo clickpath & validation
│   ├── concept-comparison.md      # Content quality analysis
│   └── pdf-helper-integration-guide.md
├── reports/                       # Test reports & analysis
│   ├── BANDIT_TEST_REPORT.md
│   ├── PROFILE_VALIDATION_SIMULATION_REPORT.md
│   ├── PROFILE_VALIDATION_TEST_MATRIX.md
│   ├── EDGE_CASE_TESTING_SUMMARY.md
│   ├── PERFORMANCE_BENCHMARK_REPORT.md
│   ├── BUG_HUNTING_REPORT.md
│   ├── HDI-UI-Review-Report.md
│   └── CLEANUP_SCRIPT.md
└── archive/                       # Historical/outdated docs
    ├── REORGANIZATION_PLAN.md     # File structure reorganization (completed)
    ├── archive-week3.md
    ├── archive-source-grounding.md
    ├── textbook-integration-plan.md
    ├── edge-case-test-report-2026-02-20.md
    ├── integration-test-results-2026-02-27.md
    ├── settings-page-week5-test-report-2026-02-27.md
    └── week5-indicators-test-report.md
```

---

## 📋 Quick Navigation

| Looking for... | Go to... |
|----------------|----------|
| **Executive summary & research vision** | [research/PROJECT_OVERVIEW.md](./research/PROJECT_OVERVIEW.md) |
| **System architecture & all 17 components** | [research/RESEARCH_ARCHITECTURE.md](./research/RESEARCH_ARCHITECTURE.md) |
| **Deployment procedures** | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| **Local vs hosted capabilities** | [DEPLOYMENT_MODES.md](./DEPLOYMENT_MODES.md) |
| **Event logging schema** | [research/LOGGING_SPECIFICATION.md](./research/LOGGING_SPECIFICATION.md) |
| **Artifact packaging standards** | [research/ARTIFACT_PACKAGING.md](./research/ARTIFACT_PACKAGING.md) |
| **Current milestone status** | [runbooks/progress.md](./runbooks/progress.md) |
| **Active task log** | [runbooks/weekly-progress.md](./runbooks/weekly-progress.md) |
| **Test reports & validation** | [reports/](./reports/) |
| **Old/historical docs** | [archive/](./archive/) |

---

## 📚 Documentation Categories

### Deployment & Operations

| Document | Purpose | Key Information |
|----------|---------|-----------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment procedures | Vercel config, environment variables, build commands |
| [DEPLOYMENT_MODES.md](./DEPLOYMENT_MODES.md) | Local vs hosted capabilities | Feature matrix, what works on Vercel vs local dev |

### Core Research Documentation

| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [research/PROJECT_OVERVIEW.md](./research/PROJECT_OVERVIEW.md) | Executive summary, research vision, foundation infrastructure | 2026-03-03 |
| [research/RESEARCH_ARCHITECTURE.md](./research/RESEARCH_ARCHITECTURE.md) | Logical components, 17 research components, implementation roadmap | 2026-03-03 |
| [runbooks/progress.md](./runbooks/progress.md) | Durable architecture record and milestone tracking | 2026-03-02 |
| [runbooks/weekly-progress.md](./runbooks/weekly-progress.md) | Active checkpoint log — all tasks documented here | 2026-02-28 |
| [AGENTS.md](../AGENTS.md) | Agent workflow policy and response contract | 2026-03-03 |

### Reproducibility & Standards

| Document | Purpose | Standards |
|----------|---------|-----------|
| [research/LOGGING_SPECIFICATION.md](./research/LOGGING_SPECIFICATION.md) | Canonical event schema, two-layer logging, validation rules | ACM, FAIR, NeurIPS |
| [research/ARTIFACT_PACKAGING.md](./research/ARTIFACT_PACKAGING.md) | Artifact bundle structure, claim verification, Docker support | ACM Artifact Review |

### Research Component Documentation (17 Components)

#### ✅ Complete (Week 5)

| # | Component | Document | Status | Tests |
|---|-----------|----------|--------|-------|
| 7 | Escalation Policies | [ESCALATION_POLICIES.md](./research/ESCALATION_POLICIES.md) | ✅ Complete | 83 |
| 8 | Multi-Armed Bandit | [MULTI_ARMED_BANDIT.md](./research/MULTI_ARMED_BANDIT.md) | ✅ Complete | 91 |
| 9 | HDI (Dependency) | [HDI.md](./research/HDI.md) | ✅ Complete | 96 |

#### 📋 Planned (Weeks 6-12)

| # | Component | Document | Status |
|---|-----------|----------|--------|
| 10 | Knowledge Consolidation | [KNOWLEDGE_CONSOLIDATION.md](./research/KNOWLEDGE_CONSOLIDATION.md) | 📋 Draft |
| 11 | Error Trajectory | [ERROR_TRAJECTORY.md](./research/ERROR_TRAJECTORY.md) | 📋 Draft |
| 12 | Cognitive Load Proxy | [COGNITIVE_LOAD_PROXY.md](./research/COGNITIVE_LOAD_PROXY.md) | 📋 Draft |
| 13 | Counterfactual Replay | [COUNTERFACTUAL_REPLAY.md](./research/COUNTERFACTUAL_REPLAY.md) | 🚧 In Progress |
| 14 | Concept Graph | [CONCEPT_GRAPH.md](./research/CONCEPT_GRAPH.md) | 📋 Draft |
| 15 | Self-Explanation | [SELF_EXPLANATION.md](./research/SELF_EXPLANATION.md) | 📋 Draft |
| 16 | Experimental Manipulations | [EXPERIMENTAL_MANIPULATIONS.md](./research/EXPERIMENTAL_MANIPULATIONS.md) | 📋 Draft |
| 17 | Affective Proxy | [AFFECTIVE_PROXY.md](./research/AFFECTIVE_PROXY.md) | 📋 Draft |

### Implementation Planning

| Document | Purpose |
|----------|---------|
| [research/6_WEEK_IMPLEMENTATION_PLAN.md](./research/6_WEEK_IMPLEMENTATION_PLAN.md) | Detailed week-by-week breakdown with code specifications |
| [research/IMPLEMENTATION_COORDINATION.md](./research/IMPLEMENTATION_COORDINATION.md) | Dependency matrix, file coordination, and risk management |
| [research/GOAL_ALIGNMENT_SUMMARY.md](./research/GOAL_ALIGNMENT_SUMMARY.md) | Analysis of goal alignment and success criteria |

### Content Pipeline Documentation

| Document | Purpose |
|----------|---------|
| [research/PDF_HELPER_INTEGRATION.md](./research/PDF_HELPER_INTEGRATION.md) | How `algl-pdf-helper` connects to SQL-Adapt |
| [research/ALGL_PDF_HELPER_RECOMMENDATION.md](./research/ALGL_PDF_HELPER_RECOMMENDATION.md) | PDF helper recommendations |
| [runbooks/pdf-helper-integration-guide.md](./runbooks/pdf-helper-integration-guide.md) | Python implementation templates for PDF processing |
| [runbooks/concept-comparison.md](./runbooks/concept-comparison.md) | Before/after content quality comparison (130 concepts) |

### Test Reports & Validation

| Document | Purpose |
|----------|---------|
| [reports/BANDIT_TEST_REPORT.md](./reports/BANDIT_TEST_REPORT.md) | Bandit algorithm test results |
| [reports/PROFILE_VALIDATION_SIMULATION_REPORT.md](./reports/PROFILE_VALIDATION_SIMULATION_REPORT.md) | Profile validation simulation |
| [reports/PROFILE_VALIDATION_TEST_MATRIX.md](./reports/PROFILE_VALIDATION_TEST_MATRIX.md) | Profile validation test cases |
| [reports/EDGE_CASE_TESTING_SUMMARY.md](./reports/EDGE_CASE_TESTING_SUMMARY.md) | Edge case testing summary |
| [reports/PERFORMANCE_BENCHMARK_REPORT.md](./reports/PERFORMANCE_BENCHMARK_REPORT.md) | Performance benchmark results |
| [reports/BUG_HUNTING_REPORT.md](./reports/BUG_HUNTING_REPORT.md) | Bug hunting findings |
| [reports/HDI-UI-Review-Report.md](./reports/HDI-UI-Review-Report.md) | HDI UI review findings |
| [reports/CLEANUP_SCRIPT.md](./reports/CLEANUP_SCRIPT.md) | Cleanup procedures |

### Operational Runbooks

| Document | Purpose |
|----------|---------|
| [runbooks/weekly-demo.md](./runbooks/weekly-demo.md) | Demo clickpath and validation commands |
| [runbooks/concept-comparison.md](./runbooks/concept-comparison.md) | Content quality comparison |
| [runbooks/pdf-helper-integration-guide.md](./runbooks/pdf-helper-integration-guide.md) | PDF processing guide |

---

## 🗓️ Implementation Timeline

| Phase | Dates | Components | Key Deliverables | Status |
|-------|-------|------------|------------------|--------|
| **Week 5** | Feb 27-Mar 6 | 7, 8, 9 | Escalation profiles, Bandit, HDI, Assignment Strategy | ✅ Complete |
| **Week 6** | Mar 7-13 | 10, 11, 12 | Knowledge consolidation, Error trajectories, CSI | 📋 Planned |
| **Week 7** | Mar 14-20 | 13, 14 | Counterfactual replay, Concept graph | 📋 Planned |
| **Week 8** | Mar 21-27 | 15, 16 | RQS scoring, Experimental conditions | 📋 Planned |
| **Week 9** | Mar 28-Apr 3 | 17 | APS, Research Dashboard 2.0 | 📋 Planned |
| **Weeks 10-12** | Apr 4-30 | All | Experiments, Analysis, Publication | 📋 Planned |

---

## 📊 Current Status

### Test Summary

| Test Type | Count | Status |
|-----------|-------|--------|
| Unit Tests (Vitest) | 316 | ✅ Passing |
| E2E Tests (Playwright) | 380 | ✅ Passing |
| **Total** | **696** | ✅ **All Passing** |

### Week 5 Deliverables

| Component | Deliverable | Status | Tests |
|-----------|-------------|--------|-------|
| 7 | Four escalation profiles | ✅ | 30 |
| 7 | Profile selection strategies | ✅ | - |
| 7 | Settings debug controls | ✅ | - |
| 7 | Profile badge | ✅ | - |
| 8 | Thompson Sampling | ✅ | 45 |
| 8 | Per-learner bandits | ✅ | - |
| 8 | Bandit debug panel | ✅ | - |
| 9 | 5 HDI components | ✅ | 43 |
| 9 | HDI debug utilities | ✅ | 27 |
| 9 | Dependency warning | ✅ | - |
| 9 | Progress hints | ✅ | - |

---

## 🔬 Research Vision

> How can instructional content for SQL learning be assembled and adapted dynamically from learner interaction patterns, error subtypes, and help-seeking behaviors?

The **"Automatic Textbook"** concept:
- **Accumulates**: Gathers explanations, examples, summaries from learner struggles
- **Reorganizes**: Structures content by concept coverage and error patterns  
- **Surfaces**: Delivers content on-demand when hints are insufficient
- **Personalizes**: Different learners see different content orderings and emphases

See [research/PROJECT_OVERVIEW.md](./research/PROJECT_OVERVIEW.md) for the full executive summary.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    INSTRUMENTATION LAYER                        │
│         (Problem, Query, Execution, Navigation)                 │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              EVENT INGESTION + VALIDATION                       │
│            (Schema, Immutable Store, Features)                  │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           ADAPTIVE ORCHESTRATION POLICY ENGINE                  │
│     State Vector → Trigger Function → Decision Events           │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              KNOWLEDGE BACKBONE SERVICES                        │
│    (Error Taxonomy, SQL-Engage Templates, Concept Graph)        │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              CONTENT ASSEMBLY PIPELINE                          │
│     (Instructional Units → "My Textbook" → RAG Query)           │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              CONTROLLED LLM GATEWAY                             │
│    (Retrieval-First → Templated Prompts → Strict Schema)        │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              RESEARCH DASHBOARD + ANALYTICS                     │
│    (Coverage, Escalation Heatmaps, Error Transitions)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📖 Documentation Coordination

**Rule**: Task-by-task progress entries belong only in `docs/runbooks/weekly-progress.md`.

**Agent Workflow**: See [AGENTS.md](../AGENTS.md) for detailed agent operating procedures, commit guidelines, and critical rules.

### Update Cadence

| Document | Update When... |
|----------|----------------|
| `docs/README.md` | Structure changes |
| `docs/runbooks/progress.md` | Architecture changes |
| `docs/runbooks/weekly-progress.md` | Every engineering task |
| `docs/research/*.md` | Research design changes |
| `docs/reports/*.md` | Test completion or new analysis |
| `AGENTS.md` | Workflow changes |

---

## 🔗 Quick Links

- [Main README](../README.md)
- [AGENTS.md](../AGENTS.md) - Agent workflow policy
- [package.json](../package.json) - Dependencies and scripts
- [playwright.config.ts](../playwright.config.ts) - E2E test configuration

---

*Last updated: 2026-03-03*  
*Status: Week 5 Complete — 696 total tests passing (316 unit + 380 E2E)*
