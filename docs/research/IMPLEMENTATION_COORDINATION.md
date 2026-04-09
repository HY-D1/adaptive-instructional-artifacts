# Implementation Coordination Guide

**Project**: Adaptive Instructional Artifacts for SQL Learning  
**Coordination Date**: 2026-02-27  
**Plan Version**: 6-Week Sprint (Feb 27 - Apr 12)

---

## Goal Alignment Summary

### Original Goal (User Request)
> Working "automatic textbook" prototype + experimental evidence by April 30

### Current State (Week 4 Complete)
- ✅ Components 1-6: Core system functional
- ✅ 138 @weekly tests passing
- ✅ Role-based access control
- ✅ Guidance ladder with 3 rungs
- ✅ Automatic textbook with deduplication
- ✅ Source grounding with PDF citations

### Target State (Week 12)
- ✅ All 17 components implemented
- ✅ 3 escalation profiles (fast/slow/adaptive)
- ✅ Multi-armed bandit optimization
- ✅ HDI dependency measurement
- ✅ Counterfactual replay evaluation
- ✅ Research Dashboard 2.0
- ✅ Experimental validation complete

---

## Coordination Matrix

### Files Already Aligned

| File | Status | Notes |
|------|--------|-------|
| `docs/RESEARCH_ARCHITECTURE.md` | ✅ Aligned | Documents all 17 components |
| `docs/ESCALATION_POLICIES.md` | ✅ Aligned | Component 7 spec complete |
| `docs/MULTI_ARMED_BANDIT.md` | ✅ Aligned | Component 8 spec complete |
| `docs/HDI.md` | ✅ Aligned | Component 9 spec complete |
| `docs/ERROR_TRAJECTORY.md` | ✅ Aligned | Component 11 spec complete |
| `docs/COGNITIVE_LOAD_PROXY.md` | ✅ Aligned | Component 12 spec complete |
| `docs/COUNTERFACTUAL_REPLAY.md` | ✅ Aligned | Component 13 spec complete |
| `docs/CONCEPT_GRAPH.md` | ✅ Aligned | Component 14 spec complete |
| `docs/SELF_EXPLANATION.md` | ✅ Aligned | Component 15 spec complete |
| `docs/EXPERIMENTAL_MANIPULATIONS.md` | ✅ Aligned | Component 16 spec complete |
| `docs/AFFECTIVE_PROXY.md` | ✅ Aligned | Component 17 spec complete |
| `docs/KNOWLEDGE_CONSOLIDATION.md` | ✅ Aligned | Component 10 spec complete |
| `AGENTS.md` | ✅ Aligned | Updated with Feb 25 extensions |

### Files Requiring Updates

| File | Action | Priority |
|------|--------|----------|
| `apps/web/src/app/types/index.ts` | Add new event types and interfaces | P0 - Week 5 Day 1 |
| `apps/web/src/app/lib/guidance-ladder.ts` | Integrate escalation profiles | P0 - Week 5 |
| `apps/web/src/app/lib/adaptive-orchestrator.ts` | Add profile-aware logic | P0 - Week 5 |
| `docs/progress.md` | Update milestones and status | P1 - Week 5 |
| `docs/weekly-progress.md` | Archive old entries, start fresh | P1 - Week 5 |

### New Files to Create (Priority Order)

#### Week 5 Priority (P0)
```
apps/web/src/app/lib/escalation-profiles.ts
apps/web/src/app/lib/multi-armed-bandit.ts
apps/web/src/app/lib/hdi-calculator.ts
apps/web/src/app/lib/reward-calculator.ts
apps/web/src/app/lib/adaptive-threshold.ts
```

#### Week 6 Priority (P1)
```
apps/web/src/app/lib/reinforcement-scheduler.ts
apps/web/src/app/lib/micro-check-generator.ts
apps/web/src/app/lib/error-trajectory.ts
apps/web/src/app/lib/csi-calculator.ts
apps/web/src/app/components/ReinforcementPrompt.tsx
```

#### Week 7 Priority (P2)
```
scripts/replay-counterfactual.mjs
apps/web/src/app/lib/replay-metrics.ts
apps/web/src/app/lib/concept-graph.ts
apps/web/src/app/lib/mastery-propagation.ts
```

#### Week 8 Priority (P3)
```
apps/web/src/app/lib/rqs-calculator.ts
apps/web/src/app/lib/experimental-conditions.ts
```

#### Week 9 Priority (P4)
```
apps/web/src/app/lib/aps-calculator.ts
apps/web/src/app/components/ResearchDashboardV2.tsx
apps/web/src/app/components/visualizations/*.tsx
```

---

## Component Dependencies

```
Component 7 (Escalation Profiles)
├── Used by: Guidance Ladder, Orchestrator
├── Uses: None
└── Blocks: Bandit (needs profiles)

Component 8 (Multi-Armed Bandit)
├── Used by: Orchestrator
├── Uses: Profiles, Reward Calculator
└── Blocks: None

Component 9 (HDI)
├── Used by: Bandit reward, Dashboard
├── Uses: Event history
└── Blocks: None

Component 10 (Knowledge Consolidation)
├── Used by: Dashboard
├── Uses: Textbook units
└── Blocks: None

Component 11 (Error Trajectory)
├── Used by: Dashboard, Interventions
├── Uses: Event history
└── Blocks: None

Component 12 (CSI)
├── Used by: Escalation, Interventions
├── Uses: Event history
└── Blocks: None

Component 13 (Counterfactual Replay)
├── Used by: Research analysis
├── Uses: All components
└── Blocks: None (can be done in parallel)

Component 14 (Concept Graph)
├── Used by: Orchestrator, Recommendations
├── Uses: Concept registry
└── Blocks: None

Component 15 (RQS)
├── Used by: Textbook quality
├── Uses: Textbook units
└── Blocks: None

Component 16 (Experimental)
├── Used by: All components
├── Uses: Feature flags
└── Blocks: None (foundation layer)

Component 17 (APS)
├── Used by: Interventions
├── Uses: Event history
└── Blocks: None
```

---

## Implementation Order

### Phase 1: Foundation (Week 5)
1. **Update types** - Add all new interfaces
2. **Escalation profiles** - Define three profiles
3. **Guidance ladder integration** - Use profile thresholds
4. **Bandit framework** - Thompson sampling implementation
5. **HDI calculator** - All 5 components
6. **Event logging** - Ensure all events captured

### Phase 2: Dynamics (Week 6)
1. **Reinforcement scheduler** - Spaced repetition logic
2. **Micro-check generator** - MCQ and SQL completion
3. **Error trajectory** - Transition graphs
4. **CSI calculator** - All 5 indicators
5. **Intervention triggers** - HDI/CSI-based responses

### Phase 3: Evaluation (Week 7)
1. **Counterfactual replay** - Trace reconstruction
2. **Replay metrics** - Policy comparison
3. **Concept graph** - DAG structure
4. **Mastery propagation** - Score adjustment
5. **Blocked node detection** - Prerequisite checking

### Phase 4: Experimentation (Week 8)
1. **RQS calculator** - Reflection quality scoring
2. **Experimental conditions** - Toggle system
3. **Feature flags** - Conditional UI rendering
4. **Assignment logic** - Random stratification

### Phase 5: Integration (Week 9)
1. **APS calculator** - Affective signals
2. **Dashboard V2** - All visualizations
3. **Combined interventions** - CSI + APS
4. **Real-time monitoring** - Live metrics

### Phase 6: Validation (Weeks 10-12)
1. **Unit tests** - All calculators
2. **E2E tests** - Full flows
3. **Experiments** - 3 conditions
4. **Analysis** - Statistical tests
5. **Documentation** - Publication package

---

## Critical Path

The critical path for project completion:

```
Week 5: Types → Profiles → Bandit → HDI
           ↓
Week 6: CSI → Error Trajectory → Reinforcement
           ↓
Week 7: Concept Graph → Replay Engine
           ↓
Week 8: RQS → Experimental Conditions
           ↓
Week 9: APS → Dashboard V2
           ↓
Week 10-12: Tests → Experiments → Analysis
```

**Critical Dependencies:**
- Profiles must be done before Bandit integration
- CSI must be done before adaptive escalation
- Replay needs all escalation logic
- Dashboard needs all calculators

---

## Testing Coordination

### Test File Naming Convention
```
{component-name}.spec.ts        # E2E tests
{component-name}.test.ts        # Unit tests
week{N}-{feature}.spec.ts       # Weekly deliverable tests
```

### Test Tags
```
@weekly        # Part of regression suite
@no-external   # No Ollama/PDF needed
@integration   # Needs external services
@flaky         # Known timing issues
@research      # Research component tests
```

### Test Coverage Targets
- Unit tests: 80% coverage for calculators
- E2E tests: All user flows
- Research tests: All component integrations

---

## Documentation Updates Required

### During Week 5
- [ ] Update `docs/progress.md` with new milestones
- [ ] Create `docs/week5-deliverables.md`
- [ ] Update component status in `docs/RESEARCH_ARCHITECTURE.md`

### During Week 6-7
- [ ] Create `docs/week6-7-deliverables.md`
- [ ] Document replay methodology
- [ ] Update dashboard documentation

### During Week 8-9
- [ ] Create `docs/week8-9-deliverables.md`
- [ ] Document experimental conditions
- [ ] Update visualization guides

### During Week 10-12
- [ ] Create `docs/experimental-results.md`
- [ ] Document statistical methods
- [ ] Prepare publication figures
- [ ] Update `README.md` with final status

---

## Event Logging Checklist

Ensure these events are logged for each component:

### Component 7 (Escalation)
- [ ] `profile_assigned`
- [ ] `escalation_triggered`
- [ ] `profile_adjusted`

### Component 8 (Bandit)
- [ ] `bandit_arm_selected`
- [ ] `bandit_reward_observed`
- [ ] `bandit_updated`

### Component 9 (HDI)
- [ ] `hdi_calculated`
- [ ] `hdi_trajectory_updated`
- [ ] `dependency_intervention_triggered`

### Component 10 (Consolidation)
- [ ] `reinforcement_scheduled`
- [ ] `reinforcement_prompt_shown`
- [ ] `reinforcement_response`

### Component 11 (Trajectory)
- [ ] `error_trajectory_analyzed`
- [ ] `learner_type_reclassified`

### Component 12 (CSI)
- [ ] `csi_calculated`
- [ ] `csi_escalation_adjusted`
- [ ] `csi_intervention_triggered`

### Component 13 (Replay)
- [ ] `replay_started`
- [ ] `replay_decision_point`
- [ ] `replay_completed`

### Component 14 (Graph)
- [ ] `mastery_propagated`
- [ ] `prerequisite_violation_detected`
- [ ] `learning_path_recommended`

### Component 15 (RQS)
- [ ] `rqs_calculated`
- [ ] `rqs_intervention_triggered`

### Component 16 (Experimental)
- [ ] `experimental_condition_assigned`
- [ ] `feature_flag_checked`

### Component 17 (APS)
- [ ] `aps_calculated`
- [ ] `affective_intervention_triggered`

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bandit converges too slowly | Medium | Medium | Use ε-greedy with decay |
| HDI calculation performance | Low | Low | Cache incrementally |
| Replay processing time | Medium | Medium | Parallel processing |
| Event log size | Medium | Low | Rotation/archival |
| Dashboard performance | Low | Medium | Lazy loading |
| Statistical significance | High | High | Extend data collection |
| Integration complexity | Medium | Medium | Incremental testing |

---

## Communication Plan

### Weekly Sync Points
- **Monday**: Week planning, dependency check
- **Wednesday**: Mid-week progress review
- **Friday**: Week completion, test verification

### Checkpoint Documentation
- Update `docs/weekly-progress.md` after each task
- Tag commits with week number (e.g., `week5-profiles`)
- Run full test suite before Friday EOD

### Handoff Documentation
- Document blockers immediately
- Update coordination file with status
- Tag failing tests with `@flaky` and explanation

---

## Success Metrics

### Implementation Metrics
- [ ] 17/17 components implemented
- [ ] 200+ total tests (138 @weekly + new)
- [ ] 80%+ unit test coverage
- [ ] 0 critical bugs
- [ ] All CI gates passing

### Research Metrics
- [ ] 3 escalation profiles functional
- [ ] Bandit converges within 20 problems
- [ ] HDI calculates in < 100ms
- [ ] Replay processes 100 traces/minute
- [ ] Dashboard renders < 2 seconds

### Experimental Metrics
- [ ] 3 experiments completed
- [ ] N ≥ 30 per condition
- [ ] Statistical power ≥ 0.80
- [ ] Effect sizes calculable
- [ ] Publication figures generated

---

## Quick Reference

### Essential Commands
```bash
# Development
npm run dev                          # Start dev server
npm run build                        # Verify build
npm run test:e2e:weekly             # Run regression
npm run test:unit                   # Run unit tests

# Research
npm run replay:counterfactual       # Run replay
npm run analyze:all                 # Generate reports
npm run demo:weekly                 # Create artifacts

# Validation
npm run verify:weekly               # Full verification
npm run gate:acceptance             # Acceptance checks
```

### Key Files Quick Access
```
Types:           apps/web/src/app/types/index.ts
Storage:         apps/web/src/app/lib/storage.ts
Events:          apps/web/src/app/lib/session-events.ts
Orchestrator:    apps/web/src/app/lib/adaptive-orchestrator.ts
Guidance:        apps/web/src/app/lib/guidance-ladder.ts
Textbook:        apps/web/src/app/lib/textbook-units.ts
```

---

*Last updated: 2026-02-27*  
*Next review: 2026-03-06 (Week 5 checkpoint)*
