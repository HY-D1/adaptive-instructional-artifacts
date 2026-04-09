# Adaptive Instructional Artifacts for SQL Learning Using Interaction Traces

**Project Duration**: February 1 – April 30, 2026  
**Outcome**: Working "automatic adaptive textbook" prototype + experimental evidence  
**Last Updated**: 2026-03-03

---

## Executive Summary

This project delivers a working **"automatic adaptive textbook"** prototype and experimental evidence by building an instructional layer that accumulates, reorganizes, and resurfaces explanations, examples, and summaries from learner interaction traces—rather than relying on static chapters or only real-time hints.

The design explicitly supports **reflective, on-demand instruction** (e.g., "My Notes / My Textbook") that is triggered when short hints are repeatedly insufficient, while still preserving productive struggle and avoiding over-scaffolding.

### Core Innovation

Traditional SQL learning relies on static textbooks or fixed hint sequences. This project explores **dynamic instructional assembly**—content that emerges from learner interaction data rather than being pre-authored.

| Traditional | Adaptive Instructional Artifacts |
|-------------|----------------------------------|
| Static chapters | Dynamic content assembly from traces |
| Fixed hint sequences | Personalized escalation profiles |
| One-size-fits-all | Multi-armed bandit optimization |
| Pre-authored explanations | LLM-generated, retrieval-grounded content |
| Assumed help effectiveness | Measured dependency (HDI) |

---

## Foundation Infrastructure

This project builds on established lab systems and datasets:

| System | Purpose | Integration Role |
|--------|---------|------------------|
| **Cybernetic Sabotage** | Interactive SQL game environment | Provides interaction traces, browser-side SQL/WASM execution |
| **HintWise** | Adaptive hint generation | L0/L1 instructional unit producer in orchestration layer |
| **SQL-Engage** | Validated error/feedback dataset | Knowledge backbone, concept taxonomy, feedback templates |
| **SQLBeyond** | Gamified SQL learning platform | Multi-tier hint system patterns, AI assistant architecture |

### SQL-Engage as Knowledge Backbone

The SQL-Engage dataset provides structured SQL errors with associated feedback targets and intended learning outcomes:

```typescript
// SQL-Engage Schema Fields
interface SQLEngageRecord {
  error_type: string;              // High-level error category
  error_subtype: string;           // Specific error pattern
  emotion: string;                 // Affective state (if available)
  feedback_target: string;         // What to address
  intended_learning_outcome: string; // Target concept
  // ... additional fields for retrieval and templating
}
```

This schema enables:
- **Error subtype → concept node mapping**
- **Feedback template retrieval**
- **Prerequisite relationship inference**

---

## Research Questions

### Primary Question

> How can instructional content for SQL learning be assembled and adapted dynamically from learner interaction patterns, error subtypes, and help-seeking behaviors?

### Secondary Questions

| # | Research Question | How We Address It |
|---|-------------------|-------------------|
| RQ1 | Does slower escalation increase retention? | Compare delayed reinforcement across profiles |
| RQ2 | Does fast escalation create dependency? | HDI trajectory analysis by profile |
| RQ3 | Are high-performers harmed by aggressive support? | Interaction: diagnostic score × profile effectiveness |
| RQ4 | Does adaptive outperform static? | Bandit vs. static assignment comparison |
| RQ5 | Can we measure help-seeking quality? | HDI as multi-dimensional dependency index |
| RQ6 | When should the system intervene? | CSI + HDI threshold experiments |

---

## The "Automatic Textbook" Concept

An adaptive instructional artifact that:

1. **Accumulates**: Gathers explanations, examples, summaries from learner struggles
2. **Reorganizes**: Structures content by concept coverage and error patterns
3. **Surfaces**: Delivers content on-demand when hints are insufficient
4. **Personalizes**: Different learners see different content orderings and emphases

### Key Design Principles

#### 1. Reflective, Not Interruptive

Content emerges from learner struggles, not pre-scheduled delivery:

```
Learner Error → Hint Request → Progressive Escalation → Textbook Unit Creation
                                                    ↓
                                           On-demand review ("My Textbook")
```

#### 2. Preserve Productive Struggle

The guidance ladder (L1→L2→L3→LLM) ensures learners attempt recovery before receiving comprehensive help:

| Level | Content | Purpose |
|-------|---------|---------|
| L1 | Micro-hint (≤100 chars) | Point to missing concept |
| L2 | Strategic hint | How to approach (no final answer) |
| L3 | Error diagnosis | Corrective explanation (compact) |
| LLM | Textbook-style unit | Full explanation + example + common mistakes |

#### 3. Avoid Over-Scaffolding

The **Hint Dependency Index (HDI)** monitors whether learners are becoming dependent:

```
HDI = f(hints per attempt, escalation depth, explanation rate, 
         repeated errors after help, improvement without hints)
```

High HDI (> 0.6) triggers interventions to promote independence.

---

## Full-Stack Traceability

Every learner action and every system decision must be logged with a stable schema for:

- **Debuggability**: Trace system behavior to understand decisions
- **Replayability**: Re-run traces with different policies
- **Publishability**: Meet artifact/reproducibility standards

### Two-Layer Logging

| Layer | Purpose | Examples |
|-------|---------|----------|
| **Research Events** | Pedagogical what-happened | `hint_requested`, `escalation_triggered`, `textbook_unit_created` |
| **Operational Telemetry** | Technical how-it-happened | API latencies, schema validation failures, LLM request failures |

Correlation via shared `trace_id` per session.

---

## Expected Outcomes

By project completion (April 30, 2026):

### 1. Working Automatic Textbook Prototype

- Dynamic content assembly from learner traces
- Personalized "My Notes" with concept tracking
- Reflective (not interruptive) delivery
- Source-grounded explanations with citations

### 2. Experimental Evidence

- Comparative analysis: hint-only vs. adaptive strategies
- Replay-based evidence for policy effectiveness
- Concept coverage evolution metrics
- HDI trajectory analysis by escalation profile

### 3. Publication-Ready Components

- System architecture description
- Method for dynamic instructional assembly
- Results on personalized scaffolding
- Counterfactual evaluation methodology
- Artifact bundle for reproducibility

---

## Documentation Structure

| Document | Purpose |
|----------|---------|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | **This file** — Executive summary, research vision |
| [RESEARCH_ARCHITECTURE.md](./RESEARCH_ARCHITECTURE.md) | Logical components, 17 research components |
| [LOGGING_SPECIFICATION.md](./LOGGING_SPECIFICATION.md) | Canonical event schema, reproducibility contract |
| [ARTIFACT_PACKAGING.md](./ARTIFACT_PACKAGING.md) | Artifact bundle requirements, FAIR principles |
| [ESCALATION_POLICIES.md](./ESCALATION_POLICIES.md) | Profile definitions, assignment strategies |
| [MULTI_ARMED_BANDIT.md](./MULTI_ARMED_BANDIT.md) | Thompson sampling, online optimization |
| [HDI.md](./HDI.md) | Hint Dependency Index specification |
| [KNOWLEDGE_CONSOLIDATION.md](./KNOWLEDGE_CONSOLIDATION.md) | Spaced reinforcement, micro-checks |
| [ERROR_TRAJECTORY.md](./ERROR_TRAJECTORY.md) | Error transition modeling |
| [COGNITIVE_LOAD_PROXY.md](./COGNITIVE_LOAD_PROXY.md) | Cognitive Strain Index (CSI) |
| [COUNTERFACTUAL_REPLAY.md](./COUNTERFACTUAL_REPLAY.md) | Offline policy evaluation |
| [CONCEPT_GRAPH.md](./CONCEPT_GRAPH.md) | Prerequisite relationships |
| [SELF_EXPLANATION.md](./SELF_EXPLANATION.md) | Reflection Quality Score (RQS) |
| [EXPERIMENTAL_MANIPULATIONS.md](./EXPERIMENTAL_MANIPULATIONS.md) | A/B conditions, toggles |
| [AFFECTIVE_PROXY.md](./AFFECTIVE_PROXY.md) | Frustration detection (APS) |

---

## Implementation Timeline

| Phase | Dates | Components | Key Deliverables |
|-------|-------|------------|------------------|
| **Week 5** | Feb 27-Mar 6 | 7, 8, 9 | Escalation profiles, Bandit, HDI ✅ |
| **Week 6** | Mar 7-13 | 10, 11, 12 | Knowledge consolidation, Error trajectories, CSI |
| **Week 7** | Mar 14-20 | 13, 14 | Counterfactual replay, Concept graph |
| **Week 8** | Mar 21-27 | 15, 16 | RQS scoring, Experimental conditions |
| **Week 9** | Mar 28-Apr 3 | 17 | APS, Research Dashboard 2.0 |
| **Weeks 10-12** | Apr 4-30 | All | Experiments, analysis, publication |

---

## Research Guardrails

### Valid Claims (Evidence-Supported)

- ✓ "Under Policy X, the system would escalate at interaction N"
- ✓ "Policy Y generates explanatory notes for subtypes A, B, C"
- ✓ "Concept coverage differs between hint-only and adaptive conditions"
- ✓ "HDI predicts help-seeking patterns with X% accuracy"
- ✓ "Profile A produces higher escalation rate than Profile B"

### Invalid Claims (Require Additional Study)

- ✗ "Learners improve more with adaptive hints" (needs pre/post assessment)
- ✗ "Policy Z is educationally superior" (needs controlled experiment)
- ✗ "Students prefer adaptive content" (needs user study)

### Offline Replay Limitations

- Shows **what the system would do**, not learning outcomes
- Enables **policy behavior comparison**, not causal effectiveness claims
- Supports **system development**, not educational evaluation

---

*Last updated: 2026-03-03*  
*Status: Week 5 Complete — 696 total tests passing (316 unit + 380 E2E)*
