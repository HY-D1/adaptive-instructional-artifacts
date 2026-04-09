# Goal Alignment Summary

**Date**: 2026-02-27  
**Project**: Adaptive Instructional Artifacts for SQL Learning  
**Goal**: Working "automatic textbook" prototype + experimental evidence by April 30

---

## Project Goal Understanding

### Core Research Vision (From Goal Document)
The project explores **dynamic instructional assembly** — instructional content that emerges from learner interaction data rather than being pre-authored or delivered through fixed sequences.

### Key Outcomes Required
1. **Adaptive Content Orchestration** - When to hint, escalate, or aggregate
2. **Automatic Textbook Prototype** - Dynamic assembly of personalized content
3. **HintWise Integration** - Hints as lowest-level instructional unit
4. **SQL-Engage Backbone** - Concept nodes, error mappings, validated feedback
5. **Controlled LLM Use** - Retrieval-first, generation-second
6. **Offline Replay** - Compare strategies on same traces

### Feb 25 Research Extensions (11 Additional Components)
7. **Escalation Policies** - Fast/Slow/Adaptive profiles
8. **Multi-Armed Bandit** - Online policy optimization
9. **HDI** - Hint Dependency Index
10. **Knowledge Consolidation** - Spaced reinforcement
11. **Error Trajectory** - Sequence modeling
12. **Cognitive Load Proxy** - CSI score
13. **Counterfactual Replay** - Off-policy evaluation
14. **Concept Graph** - Prerequisite modeling
15. **Self-Explanation** - RQS quality scoring
16. **Experimental Manipulations** - Toggle conditions
17. **Affective Proxy** - APS frustration detection

---

## Current State Assessment

### Already Implemented (✅)

| Component | Status | Evidence |
|-----------|--------|----------|
| 1. Adaptive Orchestration | ✅ Complete | `adaptive-orchestrator.ts` |
| 2. Automatic Textbook | ✅ Complete | `textbook-units.ts`, `AdaptiveTextbook.tsx` |
| 3. HintWise Integration | ✅ Complete | `enhanced-hint-service.ts` |
| 4. SQL-Engage Backbone | ✅ Complete | `sql-engage.ts`, `concept-registry.json` |
| 5. Controlled LLM Use | ✅ Complete | `llm-contracts.ts`, `content-generator.ts` |
| 6. Role-Based Access | ✅ Complete | `auth-guard.ts`, `StartPage.tsx` |

### Technical Achievements
- 138 @weekly E2E tests passing
- React 18 + TypeScript 5.8 + Vite 6.4 stack
- SQL.js in-browser SQLite execution
- Ollama LLM integration via proxy
- PDF retrieval and source grounding
- 3-rung guidance ladder (L1→L2→L3→Explanation)

---

## Alignment Analysis

### Where We Are vs. Goal

| Goal Requirement | Current State | Gap | Resolution |
|-----------------|---------------|-----|------------|
| Working prototype | ✅ Core system | Missing 11 components | 6-week plan addresses all |
| Experimental evidence | ❌ Not started | No experiments run | Weeks 10-12 dedicated |
| Adaptive orchestration | ✅ Basic | No profile learning | Week 5 implementation |
| Automatic textbook | ✅ Functional | No consolidation testing | Week 6 implementation |
| Offline replay | ⚠️ Toy only | No counterfactual analysis | Week 7 implementation |
| Controlled LLM use | ✅ Complete | - | Maintain |
| Comparative strategies | ❌ Not implemented | No A/B framework | Week 8 implementation |

### Critical Gaps Addressed

1. **Scaffolding Personalization** (Components 7-9)
   - Goal: "Personalized scaffolding pace modeling"
   - Solution: Fast/Slow/Adaptive profiles + Bandit learning + HDI measurement

2. **Learning Dynamics** (Components 10-12)
   - Goal: "Do saved textbook units help?"
   - Solution: Spaced reinforcement + Error trajectory + Cognitive load proxy

3. **Evaluation Methods** (Components 13-14)
   - Goal: "Offline replay and comparison"
   - Solution: Counterfactual replay engine + Concept graph

4. **Quality Metrics** (Components 15-17)
   - Goal: "Experimental evidence"
   - Solution: RQS scoring + Experimental toggles + Affective detection

---

## 6-Week Implementation Plan

### Philosophy
The plan prioritizes:
1. **Foundation first** - Core calculators and profiles
2. **Integration second** - Connect to existing system
3. **Validation third** - Experiments and evidence

### Week-by-Week Breakdown

```
Week 5 (Feb 27-Mar 6)
├── Escalation Profiles
│   ├── Fast Escalator (2 errors)
│   ├── Slow Escalator (5 errors)
│   └── Adaptive Escalator (history-based)
├── Multi-Armed Bandit
│   ├── Thompson Sampling
│   ├── Reward function
│   └── Per-learner instances
└── HDI Calculator
    ├── 5 components
    ├── Thresholds
    └── Interventions

Week 6 (Mar 7-13)
├── Knowledge Consolidation
│   ├── Spaced reinforcement (1-3-7 days)
│   ├── Micro-checks (MCQ, SQL)
│   └── Retention measurement
├── Error Trajectory
│   ├── Transition graphs
│   ├── Persistence scores
│   └── Learner typology
└── Cognitive Load (CSI)
    ├── 5 indicators
    ├── Real-time calculation
    └── Adaptive thresholds

Week 7 (Mar 14-20)
├── Counterfactual Replay
│   ├── Trace reconstruction
│   ├── Policy simulation
│   └── Metric calculation
└── Concept Graph
    ├── DAG structure
    ├── Mastery propagation
    └── Blocked node detection

Week 8 (Mar 21-27)
├── RQS (Self-Explanation)
│   ├── 6 quality components
    ├── Thresholds
    └── Interventions
└── Experimental Conditions
    ├── 6 toggle conditions
    ├── Feature flags
    └── Assignment logic

Week 9 (Mar 28-Apr 3)
├── Affective Proxy (APS)
│   ├── 6 frustration signals
    ├── Thresholds
    └── Interventions
└── Dashboard 2.0
    ├── Learner clustering
    ├── Escalation heatmaps
    ├── Error matrices
    └── Policy comparison

Weeks 10-12 (Apr 4-30)
├── Experiments
│   ├── Textbook effectiveness (N=50/group)
│   ├── Escalation speed (N=30/group)
│   └── Immediate vs progressive (N=40/group)
├── Analysis
│   ├── Statistical tests
│   ├── Correlation matrices
│   └── Effect sizes
└── Publication
    ├── Figures
    ├── Tables
    └── Methods documentation
```

---

## File Coordination

### Documentation Alignment
All documentation files have been reviewed and aligned:

| Document | Alignment Status |
|----------|-----------------|
| `docs/RESEARCH_ARCHITECTURE.md` | ✅ Updated with 6-week roadmap |
| `docs/progress.md` | ✅ Milestones updated |
| `docs/6_WEEK_IMPLEMENTATION_PLAN.md` | ✅ Created (29KB detailed plan) |
| `docs/IMPLEMENTATION_COORDINATION.md` | ✅ Created (12KB coordination guide) |
| `AGENTS.md` | ✅ Feb 25 extensions documented |
| `docs/ESCALATION_POLICIES.md` | ✅ Component 7 spec |
| `docs/MULTI_ARMED_BANDIT.md` | ✅ Component 8 spec |
| `docs/HDI.md` | ✅ Component 9 spec |
| `docs/KNOWLEDGE_CONSOLIDATION.md` | ✅ Component 10 spec |
| `docs/ERROR_TRAJECTORY.md` | ✅ Component 11 spec |
| `docs/COGNITIVE_LOAD_PROXY.md` | ✅ Component 12 spec |
| `docs/COUNTERFACTUAL_REPLAY.md` | ✅ Component 13 spec |
| `docs/CONCEPT_GRAPH.md` | ✅ Component 14 spec |
| `docs/SELF_EXPLANATION.md` | ✅ Component 15 spec |
| `docs/EXPERIMENTAL_MANIPULATIONS.md` | ✅ Component 16 spec |
| `docs/AFFECTIVE_PROXY.md` | ✅ Component 17 spec |

### Code File Plan

#### New Lib Files (16 files)
```
apps/web/src/app/lib/
├── escalation-profiles.ts       # Component 7
├── adaptive-threshold.ts        # Component 7
├── multi-armed-bandit.ts        # Component 8
├── reward-calculator.ts         # Component 8
├── hdi-calculator.ts            # Component 9
├── reinforcement-scheduler.ts   # Component 10
├── micro-check-generator.ts     # Component 10
├── error-trajectory.ts          # Component 11
├── csi-calculator.ts            # Component 12
├── replay-metrics.ts            # Component 13
├── concept-graph.ts             # Component 14
├── mastery-propagation.ts       # Component 14
├── rqs-calculator.ts            # Component 15
├── experimental-conditions.ts   # Component 16
└── aps-calculator.ts            # Component 17
```

#### New Scripts (5 files)
```
scripts/
├── replay-counterfactual.mjs    # Component 13
├── analyze-hdi.mjs
├── analyze-bandit.mjs
├── analyze-csi.mjs
└── generate-reports.mjs
```

#### Updated Files
```
apps/web/src/app/
├── types/index.ts               # Add new event types
├── lib/guidance-ladder.ts       # Integrate profiles
├── lib/adaptive-orchestrator.ts # Add profile logic
└── components/ResearchDashboard.tsx # Upgrade to V2
```

---

## Success Criteria Alignment

### Goal Requirements → Success Criteria

| Goal Requirement | Success Criterion | Measurement |
|-----------------|-------------------|-------------|
| Working prototype | 17 components functional | Component checklist |
| Adaptive orchestration | 3 escalation profiles | Profile switching |
| Automatic textbook | Spaced reinforcement works | Retention metrics |
| Experimental evidence | 3 experiments complete | N ≥ 30 per group |
| Offline replay | Replay engine functional | 100 traces/minute |
| Comparative strategies | A/B testing possible | 6 toggle conditions |

### Research Questions Addressed

From the original goal document:

1. **"Does slower escalation increase retention?"**
   - Solution: Compare Fast vs Slow vs Adaptive (Week 8 experiment)

2. **"Does fast escalation reduce persistence but create dependency?"**
   - Solution: HDI trajectory tracking (Component 9)

3. **"Are high-performing learners harmed by aggressive support?"**
   - Solution: Bandit per-learner optimization (Component 8)

4. **"What counts as escalation trigger?"**
   - Solution: Log all triggers with context (Components 7, 12, 17)

5. **"Can we measure dependency?"**
   - Solution: HDI with 5 components (Component 9)

6. **"Do saved notes help learning?"**
   - Solution: Spaced reinforcement with retention tests (Component 10)

7. **"Can we detect frustration?"**
   - Solution: APS with 6 behavioral signals (Component 17)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Timeline slip | Medium | High | Weekly checkpoints, parallel work |
| Integration bugs | Medium | Medium | Incremental testing |
| Insufficient data | Medium | High | Extend collection period |
| Performance issues | Low | Medium | Optimization sprints |
| Scope creep | High | High | Strict prioritization |

---

## Expected Outcomes

By April 30, 2026:

### Deliverables
1. ✅ Working automatic textbook with all 17 components
2. ✅ 200+ automated tests (138 @weekly + new)
3. ✅ 3 controlled experiments with N ≥ 30 per condition
4. ✅ Research Dashboard 2.0 with 5 visualizations
5. ✅ Publication-ready figures and tables
6. ✅ Complete event logs for replay

### Research Claims Supported
1. "Adaptive escalation reduces dependency compared to static thresholds"
2. "Bandit optimization converges to optimal policy within 20 problems"
3. "HDI predicts long-term learning outcomes"
4. "Counterfactual replay enables policy comparison without new studies"
5. "Spaced reinforcement improves retention of textbook content"

---

## Next Steps (Immediate Actions)

### This Week (Week 5 Start)
1. [ ] Update `apps/web/src/app/types/index.ts` with new event types
2. [ ] Implement `escalation-profiles.ts`
3. [ ] Implement `multi-armed-bandit.ts`
4. [ ] Implement `hdi-calculator.ts`
5. [ ] Update `guidance-ladder.ts` to use profiles

### Coordination
- Review detailed plan: `docs/6_WEEK_IMPLEMENTATION_PLAN.md`
- Check dependencies: `docs/IMPLEMENTATION_COORDINATION.md`
- Monitor progress: `docs/weekly-progress.md`

---

## Summary

**The project is well-aligned with the goal.**

- ✅ Core prototype functional (Components 1-6)
- 🔄 Extensions planned (Components 7-17)
- 📋 Experimental validation scheduled (Weeks 10-12)
- ✅ All documentation coordinated
- ✅ 6-week plan created with clear milestones

**The path to a publishable research system is clear and achievable.**

---

*Alignment analysis completed: 2026-02-27*  
*Plan ready for execution*
