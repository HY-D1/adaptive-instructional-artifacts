# Research Architecture: Adaptive Instructional Artifacts for SQL Learning

**Project Duration**: Feb 1 – April 30, 2026  
**Outcome**: Working "automatic textbook" prototype + experimental evidence  
**Last Updated**: 2026-03-03

---

## System Architecture Overview

The proposed system separates **"learning interaction capture"** from **"instruction orchestration"** and from **"content assembly,"** so each part remains independently testable and replayable.

### Why This Separation Matters

1. **SQL learning produces diverse error patterns** that arise over sequences of attempts (not just single submissions)
2. **Over-help (hint abuse)** is a known risk in ITS-style guidance systems
3. **Full-stack traceability** enables debugging, replay, and publishable claims

### Logical Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SQL-ADAPT SYSTEM ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    INSTRUMENTATION LAYER                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │ Problem     │  │ Query Edit  │  │ Execution   │  │ Navigation │ │   │
│  │  │ Selection   │  │ /Submit     │  │ Errors      │  │ /Time      │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │   │
│  │                              ↓                                      │   │
│  │                     Event Stream (JSONL)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                 EVENT INGESTION + VALIDATION                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ Schema      │  │ Immutable   │  │ Feature     │                  │   │
│  │  │ Validation  │  │ Event Store │  │ Extraction  │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              ADAPTIVE ORCHESTRATION POLICY ENGINE                   │   │
│  │                                                                     │   │
│  │   State Vector:  s = (e, t_stuck, h, p, c)                         │   │
│  │                    ↓                                                │   │
│  │   Trigger Function: escalate(s) = 𝟙[Σwᵢŝᵢ ≥ θ_profile]            │   │
│  │                    ↓                                                │   │
│  │   Decision Events: escalation_evaluated, escalation_triggered      │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    KNOWLEDGE BACKBONE SERVICES                      │   │
│  │  ┌─────────────────┐  ┌───────────────┐  ┌─────────────────────┐   │   │
│  │  │ Error Taxonomy  │  │ SQL-Engage    │  │ Concept Graph       │   │   │
│  │  │ + Concept Graph │  │ Template      │  │ (Prerequisites)     │   │   │
│  │  │                 │  │ Retrieval     │  │                     │   │   │
│  │  └─────────────────┘  └───────────────┘  └─────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              CONTENT ASSEMBLY PIPELINE                              │   │
│  │                                                                     │   │
│  │   Instructional Unit: {definition, examples, common_mistakes,      │   │
│  │                       provenance}                                   │   │
│  │                      ↓                                              │   │
│  │   "My Textbook" View + Ask My Textbook (RAG)                       │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              CONTROLLED LLM GATEWAY                                 │   │
│  │                                                                     │   │
│  │   Retrieval-First → Templated Prompts → Strict Schema → Logging    │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              RESEARCH DASHBOARD + ANALYTICS                         │   │
│  │                                                                     │   │
│  │   Coverage Trajectories │ Escalation Heatmaps │ Error Transitions  │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Research Component Architecture (17 Components)

### Phase 1: Core System (Weeks 1-4) ✅ Complete

| Component | Status | Description |
|-----------|--------|-------------|
| 1. Adaptive Orchestration | ✅ | Escalation logic (hint → explanation → textbook) |
| 2. Guidance Ladder | ✅ | 3-rung system (L1 micro-hint, L2 explanation, L3 reflective note) |
| 3. Automatic Textbook | ✅ | My Notes accumulation and deduplication |
| 4. Source Grounding | ✅ | PDF citation for all explanations |
| 5. SQL-Engage Integration | ✅ | 23 error subtypes mapped to 30 concepts |
| 6. Controlled LLM Use | ✅ | Retrieval-first, generation-second |

### Phase 2: Adaptive Personalization (Weeks 5-8) ✅ Week 5 Complete

| Component | Status | Key Innovation |
|-----------|--------|----------------|
| **7. Escalation Policies** | ✅ | Fast/Slow/Adaptive/Explanation-first profiles |
| **8. Multi-Armed Bandit** | ✅ | Online policy optimization via Thompson Sampling |
| **9. Hint Dependency Index** | ✅ | Measure learner reliance on scaffolding |
| 10. Knowledge Consolidation | 📋 | Spaced reinforcement, micro-checks |
| 11. Error Trajectory Modeling | 📋 | Error transition graphs |
| 12. Cognitive Load Proxy (CSI) | 📋 | Infer struggle from interaction patterns |

### Phase 3: Learning Dynamics (Weeks 9-10) 📋 Planned

| Component | Status | Research Question |
|-----------|--------|-------------------|
| 13. Counterfactual Replay | 📋 | Compare policies on same learner traces |
| 14. Concept Graph & Mastery | 📋 | Prerequisite propagation |
| 15. Self-Explanation Detection | 📋 | Reflection Quality Score (RQS) |

### Phase 4: Experimental Evaluation (Weeks 11-12) 📋 Planned

| Component | Status | Purpose |
|-----------|--------|---------|
| 16. Experimental Manipulations | 📋 | Controlled A/B conditions |
| 17. Affective Proxy Layer (APS) | 📋 | Frustration detection from behavior |

---

## Core Design Principles

### 1. Retrieval-First, Generation-Second

```
Learner Error → SQL-Engage Lookup → Textbook Chunk Retrieval → LLM Generation (if needed)
```

- **Always** check validated dataset first
- **Always** retrieve source passages before LLM call
- **Never** generate without grounding

### 2. Controlled LLM Use

| Aspect | Constraint |
|--------|------------|
| Prompt Templates | 3 fixed templates (rung1, rung2, rung3) |
| Output Structure | JSON with validated fields |
| Source Citation | Mandatory sourceRefIds[] |
| Fallback | Deterministic SQL-Engage content |
| Logging | Complete input/output/version trace |

### 3. Comprehensive Logging

Every decision is logged for replay and analysis:

```typescript
// Escalation decision log
{
  schema_version: "1.0.0",
  event_id: "uuid-v7",
  trace_id: "session-abc-123",
  ts: "2026-03-03T10:00:00Z",
  eventType: 'guidance_escalate',
  fromRung: 1,
  toRung: 2,
  trigger: 'rung_exhausted',
  evidence: {
    errorCount: 3,
    timeSpentMs: 120000,
    hintCount: 3
  },
  learnerProfileId: 'learner-123',
  strategy: 'adaptive-medium'
}
```

### 4. Offline Replay Capability

All traces can be replayed with different policies:

```bash
# Compare strategies on same learner trace
npm run replay:counterfactual --learner=learner-123 \
  --policy=aggressive --policy=conservative --policy=adaptive
```

---

## Component 7: Escalation Policies ✅

**Status**: Complete (Week 5)  
**Research Question**: How does scaffolding pace affect learning outcomes?

### Four Profile Definitions

| Profile | Threshold | Triggers | Best For |
|---------|-----------|----------|----------|
| **Fast Escalator** | escalate: 2, aggregate: 4 | timeStuck: 2min, rungExhausted: 2 | Impatient learners, time-constrained |
| **Slow Escalator** | escalate: 5, aggregate: 8 | timeStuck: 8min, rungExhausted: 4 | Methodical learners, beginners |
| **Adaptive Escalator** | escalate: 3, aggregate: 6 | timeStuck: 5min, rungExhausted: 3 | Most learners (default) |
| **Explanation-First** | escalate: 1, aggregate: 3 | timeStuck: 1min, rungExhausted: 1 | Advanced learners, HDI ≥ 0.7 |

### Profile Assignment Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Static** | Random/hash assignment at start | Baseline condition |
| **Diagnostic** | Based on initial performance | Quick personalization |
| **Bandit** | Thompson sampling | Online optimization |

→ **See**: [ESCALATION_POLICIES.md](./ESCALATION_POLICIES.md)

---

## Component 8: Multi-Armed Bandit ✅

**Status**: Complete (Week 5)  
**Research Question**: Can the system learn optimal profile assignment?

### Thompson Sampling Implementation

```typescript
// Beta(α, β) per arm
interface BanditArm {
  id: string;           // Profile ID
  alpha: number;        // Success count + prior
  beta: number;         // Failure count + prior
  pullCount: number;
  cumulativeReward: number;
}

// Selection: sample from Beta(α, β), pick highest
const samples = arms.map(arm => sampleBeta(arm.alpha, arm.beta));
const selectedArm = arms[argmax(samples)];
```

### Reward Function

```
R = α·𝟙[solved] - β·hint_depth_used - γ·dependency_signal + δ·delayed_recall_gain
```

| Component | Weight | Source |
|-----------|--------|--------|
| solved | α = 0.4 | problem_ended success |
| hint_depth_used | β = 0.2 | max rung reached |
| dependency_signal | γ = 0.2 | HDI component |
| delayed_recall_gain | δ = 0.2 | spaced reinforcement |

→ **See**: [MULTI_ARMED_BANDIT.md](./MULTI_ARMED_BANDIT.md)

---

## Component 9: Hint Dependency Index (HDI) ✅

**Status**: Complete (Week 5)  
**Research Question**: Are learners becoming dependent on scaffolding?

### Five-Component Formula

```
HDI = σ(w₁x̂₁ + w₂x̂₂ + w₃x̂₃ + w₄x̂₄ - w₅x̂₅)

where:
  x₁ = hints per attempt (HPA)
  x₂ = average escalation depth (AED)
  x₃ = explanation rate (ER)
  x₄ = repeated error after explanation (REAE)
  x₅ = improvement without hint (IWH) [negative weight]
```

### HDI Thresholds

| Level | Range | Interpretation | Intervention |
|-------|-------|----------------|--------------|
| Low | 0.0 - 0.3 | Independent learner | Maintain approach |
| Medium | 0.3 - 0.6 | Moderate reliance | Monitor closely |
| High | 0.6 - 1.0 | Potential dependency | **Trigger intervention** |

→ **See**: [HDI.md](./HDI.md)

---

## Component 10: Knowledge Consolidation & Spaced Reinforcement

**Status**: Planned (Week 6)  
**Research Question**: Do saved textbook units improve retention?

### Spaced Reinforcement Flow

```
textbook_unit_saved (GROUP BY note)
         ↓
reinforcement_scheduled (3 days, 7 days delays)
         ↓
reinforcement_prompt_shown
         ↓
reinforcement_response (correct/incorrect, time)
         ↓
concept_mastery_update
```

### Implementation Requirements

1. When `textbook_unit_saved`, create `reinforcement_scheduled` events
2. Fixed delays: 3 days, 7 days
3. Log: response correctness, response time
4. Tie results back to concept mastery updates

→ **See**: [KNOWLEDGE_CONSOLIDATION.md](./KNOWLEDGE_CONSOLIDATION.md)

---

## Component 11: Error Trajectory Modeling

**Status**: Planned (Week 6)  
**Research Question**: What error sequences predict mastery?

### Error Transition Graph

```
JOIN_missing → GROUP_BY_misuse → JOIN_missing (persistence loop)
```

### Computed Metrics

| Metric | Description |
|--------|-------------|
| Transition matrix | P(error_B \| error_A) per learner |
| Persistence score | Average consecutive same-subtype errors |
| Escalation path patterns | How many L3 before correction? |

### Learner Typologies

| Type | Pattern | Intervention |
|------|---------|--------------|
| Persistent misconception | High subtype repetition | Targeted concept review |
| Rapid correction | Few repeated errors | Continue current approach |
| Oscillatory | Switching subtypes | Stabilize with focused practice |

→ **See**: [ERROR_TRAJECTORY.md](./ERROR_TRAJECTORY.md)

---

## Component 12: Cognitive Load Proxy (CSI)

**Status**: Planned (Week 6)  
**Research Question**: Can we detect cognitive strain from behavior?

### Cognitive Strain Indicators

| Indicator | Proxy For | Detection |
|-----------|-----------|-----------|
| Rapid re-submission frequency | Panic/guessing | < 5s between submissions |
| Short interval repeated errors | Not processing feedback | Same error < 10s |
| Long pause before escalation | Hesitation/uncertainty | > 30s before asking help |
| Burst error clusters | Overload | 3+ errors in 60s |
| High escalation density | Can't recover independently | > 2 escalations per problem |

### Adaptive Use

- High CSI → Speed up escalation (reduce struggle)
- Low CSI → Maintain current pace
- CSI spike → Immediate intervention

→ **See**: [COGNITIVE_LOAD_PROXY.md](./COGNITIVE_LOAD_PROXY.md)

---

## Component 13: Counterfactual Replay Evaluation

**Status**: Planned (Week 7)  
**Research Question**: What would have happened under different policies?

### Key Principle

**We are NOT changing the learner's behavior. We are changing only the system's decisions.**

### Replay Inputs

- Ordered events with timestamps
- Error subtype sequence
- Hint request events
- Explicit "decision points" (`escalation_evaluated`)
- Action probabilities (propensities) for OPE

### Alternative Policies

| Policy | Threshold |
|--------|-----------|
| Aggressive escalation | threshold = 2 errors |
| Conservative escalation | threshold = 5 errors |
| Explanation-first | Skip hint ladder |

### Evaluation Metrics

- Total explanations shown
- Average escalation depth
- Simulated dependency index
- Simulated coverage score
- Simulated time-to-success

→ **See**: [COUNTERFACTUAL_REPLAY.md](./COUNTERFACTUAL_REPLAY.md)

---

## Component 14: Concept Graph & Mastery Propagation

**Status**: Planned (Week 7)  
**Research Question**: How do prerequisite relationships affect learning?

### Concept Dependency Graph (DAG)

```
SELECT → WHERE → GROUP_BY → HAVING
  ↓        ↓         ↓
  JOIN → Subqueries → CTE
```

### Mastery Propagation Rules

- Low mastery in WHERE → Reduce confidence in GROUP_BY
- Mastery in prerequisite < 0.5 → Block advanced concept practice

→ **See**: [CONCEPT_GRAPH.md](./CONCEPT_GRAPH.md)

---

## Component 15: Self-Explanation Detection (RQS)

**Status**: Planned (Week 8)  
**Research Question**: What makes a good reflective note?

### Reflection Quality Score (RQS)

| Feature | Measurement |
|---------|-------------|
| Length | Token count |
| Paraphrase | Lexical overlap with system text |
| Concept keywords | Number of SQL terms included |
| Example presence | Contains SQL code block? |
| Structure | Headers, bullets, organization |

```
RQS = w₁·paraphrase_similarity + w₂·concept_keywords + w₃·has_example + w₄·length_optimal
```

→ **See**: [SELF_EXPLANATION.md](./SELF_EXPLANATION.md)

---

## Component 16: Experimental Interface Manipulations

**Status**: Planned (Week 8)  
**Research Question**: What is the baseline for comparison?

### Session-Level Toggles

| Flag | Effect |
|------|--------|
| `textbook_disabled` | No My Notes accumulation |
| `adaptive_ladder_disabled` | Fixed hint sequence (no escalation) |
| `immediate_explanation_mode` | Skip to explanation immediately |
| `bandit_disabled` | Fixed profile assignment |
| `fast_escalator_profile` | Use aggressive escalation |
| `slow_escalator_profile` | Use conservative escalation |

### Experimental Designs Enabled

- With vs without textbook
- Adaptive vs static hints
- Immediate explanation vs progressive ladder
- Fast vs slow escalation

→ **See**: [EXPERIMENTAL_MANIPULATIONS.md](./EXPERIMENTAL_MANIPULATIONS.md)

---

## Component 17: Affective Proxy Layer (APS)

**Status**: Planned (Week 9)  
**Research Question**: Can we infer frustration from behavior?

### Affective Proxy Signals

| Signal | Indicates | Detection Pattern |
|--------|-----------|-------------------|
| Repeated identical errors | Confusion | Same code submitted 3+ times |
| Rapid escalation to L3 | Giving up | Reach L3 in < 2 minutes |
| Rapid problem switching | Avoidance | Skip after 1 error |
| Long idle periods | Disengagement | No interaction > 2 minutes |
| Burst error clusters | Frustration | 5+ errors in 2 minutes |

### Adaptive Responses

| APS Level | System Response |
|-----------|-----------------|
| High (> 0.7) | Immediate explanation, simplify problem |
| Medium (0.4-0.7) | Faster escalation, encouragement |
| Low (< 0.4) | Normal pacing |

→ **See**: [AFFECTIVE_PROXY.md](./AFFECTIVE_PROXY.md)

---

## Implementation Roadmap

### Week 5 (Feb 27 - Mar 6): Adaptive Personalization Foundation ✅
- [x] Update TypeScript types with new event definitions
- [x] Implement escalation profiles (Fast/Slow/Adaptive/Explanation-first)
- [x] Build multi-armed bandit with Thompson Sampling
- [x] Create HDI calculator with 5 components
- [x] Add profile assignment and event logging

### Week 6 (Mar 7-13): Learning Dynamics Core 📋
- [ ] Implement knowledge consolidation with spaced reinforcement
- [ ] Build error trajectory analyzer with transition graphs
- [ ] Create CSI calculator with 5 cognitive indicators
- [ ] Add intervention triggers for HDI/CSI thresholds

### Week 7 (Mar 14-20): Evaluation Infrastructure 📋
- [ ] Build counterfactual replay engine
- [ ] Implement concept dependency graph (DAG)
- [ ] Add mastery propagation algorithm
- [ ] Create blocked node detection

### Week 8 (Mar 21-27): Quality & Experimentation 📋
- [ ] Implement RQS calculator for reflection quality
- [ ] Build experimental conditions framework
- [ ] Add feature flag system for A/B testing

### Week 9 (Mar 28-Apr 3): Affective Layer & Dashboard 📋
- [ ] Implement APS calculator for frustration detection
- [ ] Build Research Dashboard 2.0 with visualizations
- [ ] Add learner clustering, escalation heatmaps
- [ ] Create concept mastery timeline

### Weeks 10-12 (Apr 4-30): Validation & Publication 📋
- [ ] Run 3 controlled experiments
- [ ] Generate statistical analysis reports
- [ ] Create publication-ready figures
- [ ] Document methodology and results

---

## Research Dashboard 2.0

New visualizations for learning dynamics:

| Visualization | Data Source | Insight |
|---------------|-------------|---------|
| Learner clustering | HDI, CSI, persistence | Identify learner types |
| Escalation heatmaps | guidance_escalate events | Where do learners struggle? |
| Error transition matrices | error events with subtypes | Common error sequences |
| Concept mastery timeline | coverage_change events | Learning progression |
| Policy comparison panel | Counterfactual replay results | Which policy works best? |
| Dependency trend lines | HDI over time | Is scaffolding creating dependency? |

---

## Expected Outcomes

By project end (April 30, 2026):

1. **Working Prototype**: Automatic textbook with all 17 research components
2. **Experimental Evidence**: Comparative results across escalation policies
3. **Publication-Ready Components**:
   - System architecture description
   - Method for dynamic instructional assembly
   - Results on personalized scaffolding
   - Counterfactual evaluation methodology

---

## Key Research Claims

The architecture enables testing these publishable claims:

1. **Adaptive assembly beats static delivery**: Dynamic textbooks outperform pre-authored hints
2. **Personalized pacing matters**: Fast/slow escalation profiles affect learning differently
3. **Dependency can be measured**: HDI predicts long-term learning outcomes
4. **Struggle is productive only to a point**: CSI identifies when to intervene
5. **Counterfactual evaluation works**: Replay enables policy comparison without new studies

---

## Document Index

| Document | Component | Status |
|----------|-----------|--------|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | All | Complete |
| [ESCALATION_POLICIES.md](./ESCALATION_POLICIES.md) | 7 | Complete |
| [MULTI_ARMED_BANDIT.md](./MULTI_ARMED_BANDIT.md) | 8 | Complete |
| [HDI.md](./HDI.md) | 9 | Complete |
| [KNOWLEDGE_CONSOLIDATION.md](./KNOWLEDGE_CONSOLIDATION.md) | 10 | Draft |
| [ERROR_TRAJECTORY.md](./ERROR_TRAJECTORY.md) | 11 | Draft |
| [COGNITIVE_LOAD_PROXY.md](./COGNITIVE_LOAD_PROXY.md) | 12 | Draft |
| [COUNTERFACTUAL_REPLAY.md](./COUNTERFACTUAL_REPLAY.md) | 13 | Draft |
| [CONCEPT_GRAPH.md](./CONCEPT_GRAPH.md) | 14 | Draft |
| [SELF_EXPLANATION.md](./SELF_EXPLANATION.md) | 15 | Draft |
| [EXPERIMENTAL_MANIPULATIONS.md](./EXPERIMENTAL_MANIPULATIONS.md) | 16 | Draft |
| [AFFECTIVE_PROXY.md](./AFFECTIVE_PROXY.md) | 17 | Draft |

---

*Last updated: 2026-03-03*  
*Status: Week 5 Complete — 696 total tests passing (316 unit + 380 E2E)*
