# 6-Week Implementation Plan: Adaptive Instructional Artifacts

**Project**: SQL-Adapt Learning System  
**Timeline**: Feb 27 – April 12, 2026  
**Goal**: Complete all 17 research components + experimental validation  
**Current Status**: ✅ **Week 5 Complete** (Components 1-9 ✅)

---

## Executive Summary

This plan transforms the SQL-Adapt system from a working prototype into a complete research platform capable of generating publishable evidence on adaptive instructional assembly.

### Week-by-Week Overview

| Week | Focus | Components | Key Deliverables | Status |
|------|-------|------------|------------------|--------|
| **Week 5** | Adaptive Personalization Foundation | 7, 8, 9 | Escalation profiles, Bandit framework, HDI calculator | ✅ Complete |
| **Week 6** | Learning Dynamics Core | 10, 11, 12 | Knowledge consolidation, Error trajectories, CSI | 🔄 In Progress |
| **Week 7** | Evaluation Infrastructure | 13, 14 | Counterfactual replay, Concept graph | 📋 Planned |
| **Week 8** | Quality & Experimentation | 15, 16 | RQS scoring, Experimental conditions | 📋 Planned |
| **Week 9** | Affective Layer & Integration | 17 | APS, Research Dashboard 2.0 | 📋 Planned |
| **Week 10-12** | Validation & Publication | All | Experiments, Analysis, Documentation | 📋 Planned |

### Test Summary

| Test Type | Count | Status |
|-----------|-------|--------|
| Unit Tests (Vitest) | 316 | ✅ Passing |
| E2E Tests (Playwright) | 380 | ✅ Passing |
| **Total** | **696** | ✅ **All Passing** |

---

## Detailed Week Plans

---

## Week 5: Adaptive Personalization Foundation ✅ COMPLETE

### Goals
Implement the three core personalization components: escalation policies, multi-armed bandit optimization, and dependency measurement.

### Component 7: Escalation Profiles ✅

**Implementation**: `apps/web/src/app/lib/escalation-profiles.ts`

**Deliverables**:
- [x] Four profile definitions (Fast, Slow, Adaptive, Explanation-first)
- [x] Profile selection with 3 strategies (Static, Diagnostic, Bandit)
- [x] Guidance ladder integration
- [x] Profile badge in LearningInterface
- [x] Debug controls in Settings
- [x] 53 unit tests passing

**Files Created**:
```
apps/web/src/app/lib/escalation-profiles.ts       # Profile definitions
apps/web/src/app/lib/escalation-profiles.test.ts  # 30 unit tests
```

---

### Component 8: Multi-Armed Bandit ✅

**Implementation**: `apps/web/src/app/lib/bandit-manager.ts`

**Deliverables**:
- [x] Thompson Sampling implementation
- [x] Per-learner bandit instances
- [x] Beta distribution sampling
- [x] Arm statistics and debug panel
- [x] Force arm selection (dev mode)
- [x] 60 unit tests passing

**Files Created**:
```
apps/web/src/app/lib/multi-armed-bandit.ts        # Core bandit algorithms
apps/web/src/app/lib/learner-bandit-manager.ts    # Per-learner bandit instances
apps/web/src/app/lib/multi-armed-bandit.test.ts   # 45 unit tests
```

---

### Component 9: Hint Dependency Index ✅

**Implementation**: `apps/web/src/app/lib/hdi-calculator.ts`

**Deliverables**:
- [x] 5 HDI component calculations (HPA, AED, ER, REAE, IWH)
- [x] Combined HDI score with weights
- [x] HDI debug utilities
- [x] Dependency warning toast (HDI > 0.8)
- [x] Progress hints every ~15 interactions
- [x] 69 unit tests passing

**Files Created**:
```
apps/web/src/app/lib/hdi-calculator.ts            # Core calculator
apps/web/src/app/lib/hdi-calculator.test.ts       # 16 unit tests
apps/web/src/app/lib/hdi-debug.ts                 # Debug utilities
apps/web/src/app/lib/hdi-debug.test.ts            # 27 unit tests
```

---

### Week 5 Integration ✅

**New Features Added**:
- Storage validation with safe getters/setters
- Toast notification system
- Confirmation dialogs for destructive actions
- Storage corruption recovery

**Event Logging**: All 9 Week 5 event types implemented
- `profile_assigned` - Profile selection logged
- `escalation_triggered` - Escalation events logged
- `profile_adjusted` - Dynamic adjustments logged
- `bandit_arm_selected` - Arm selection logged
- `bandit_reward_observed` - Rewards logged
- `bandit_updated` - Arm statistics updates logged
- `hdi_calculated` - HDI calculations logged
- `hdi_trajectory_updated` - Trend analysis logged
- `dependency_intervention_triggered` - Interventions logged

**Test Reports**:
- `WEEK5_INDICATORS_TEST_REPORT.md` - UI/indicator testing
- `SETTINGS_PAGE_WEEK5_TEST_REPORT.md` - Debug controls testing
- `INTEGRATION_TEST_RESULTS.md` - End-to-end integration

---

## Week 6: Learning Dynamics Core 🔄 IN PROGRESS

### Component 10: Knowledge Consolidation

**Files to Create**:
```
apps/web/src/app/lib/reinforcement-scheduler.ts  # Spaced repetition
apps/web/src/app/lib/micro-check-generator.ts    # Quiz generation
apps/web/src/app/components/ReinforcementPrompt.tsx
```

**Implementation:**

1. **Schedule Reinforcement**
```typescript
export function scheduleReinforcement(
  unit: InstructionalUnit,
  learnerId: string
): ReinforcementSchedule {
  const DELAYS = [1, 3, 7]; // Days
  const now = Date.now();
  
  return {
    unitId: unit.id,
    learnerId,
    scheduledPrompts: DELAYS.map((delay, idx) => ({
      delayDays: delay,
      promptType: idx === 0 ? 'mcq' : 'sql_completion',
      status: 'pending',
      scheduledTime: now + delay * 24 * 60 * 60 * 1000
    }))
  };
}
```

2. **Generate Micro-Checks**
- MCQ from unit content
- SQL completion exercises
- Concept explanation prompts

**Events:**
- `reinforcement_scheduled`
- `reinforcement_prompt_shown`
- `reinforcement_response`

---

### Component 11: Error Trajectory Modeling

**Files to Create**:
```
apps/web/src/app/lib/error-trajectory.ts         # Sequence analysis
```

**Implementation:**

1. **Transition Graph**
```typescript
export function buildTransitionGraph(
  interactions: InteractionEvent[]
): ErrorTransitionGraph {
  const errors = interactions
    .filter(e => e.eventType === 'error')
    .map(e => e.sqlEngageSubtype || e.errorSubtypeId)
    .filter(Boolean) as string[];
  
  const edges = new Map<string, Map<string, number>>();
  
  for (let i = 0; i < errors.length - 1; i++) {
    const from = errors[i];
    const to = errors[i + 1];
    
    if (!edges.has(from)) edges.set(from, new Map());
    const fromEdges = edges.get(from)!;
    fromEdges.set(to, (fromEdges.get(to) || 0) + 1);
  }
  
  return { nodes: [...new Set(errors)], edges };
}
```

2. **Persistence Score**
```typescript
export function calculatePersistenceScore(errors: string[]): number {
  if (errors.length < 2) return 0;
  
  let streaks: number[] = [];
  let currentStreak = 1;
  
  for (let i = 1; i < errors.length; i++) {
    if (errors[i] === errors[i - 1]) {
      currentStreak++;
    } else {
      streaks.push(currentStreak);
      currentStreak = 1;
    }
  }
  streaks.push(currentStreak);
  
  const avgStreak = streaks.reduce((a, b) => a + b, 0) / streaks.length;
  return Math.min(1, (avgStreak - 1) / 2);
}
```

3. **Learner Typology**
```typescript
export function classifyLearnerType(
  persistenceScore: number,
  transitions: ErrorTransitionGraph
): 'persistent_misconception' | 'rapid_corrector' | 'oscillatory' | 'avoidance' | 'typical' {
  if (persistenceScore > 0.7) return 'persistent_misconception';
  if (persistenceScore < 0.3) return 'rapid_corrector';
  // Check for oscillation patterns...
  return 'typical';
}
```

**Events:**
- `error_trajectory_analyzed`
- `learner_type_reclassified`

---

### Component 12: Cognitive Load Proxy (CSI)

**Files to Create**:
```
apps/web/src/app/lib/csi-calculator.ts           # Cognitive strain index
```

**Implementation:**

```typescript
export function calculateCSI(history: InteractionEvent[]): {
  csi: number;
  level: 'low' | 'medium' | 'high';
  components: CSIComponents;
} {
  const rapid = calculateRapidResubmissionRate(history);
  const shortInterval = calculateShortIntervalRepeatedErrors(history);
  const longPause = calculateLongPauseBeforeHelp(history);
  const burst = calculateBurstErrorClusters(history);
  const escalation = calculateEscalationDensity(history);
  
  const csi = Math.max(0, Math.min(1,
    0.25 * rapid + 0.25 * shortInterval + 0.15 * longPause + 0.20 * burst + 0.15 * escalation
  ));
  
  return {
    csi,
    level: csi < 0.3 ? 'low' : csi < 0.6 ? 'medium' : 'high',
    components: { rapid, shortInterval, longPause, burst, escalation }
  };
}
```

**Events:**
- `csi_calculated`
- `csi_escalation_adjusted`
- `csi_intervention_triggered`

---

## Week 7: Evaluation Infrastructure

### Component 13: Counterfactual Replay

**Files to Create**:
```
scripts/replay-counterfactual.mjs                # Replay engine
apps/web/src/app/lib/replay-metrics.ts           # Metric calculation
```

**Implementation:**

1. **Replay Engine**
```typescript
export function replayTrace(
  trace: ReplayInput,
  policy: EscalationPolicy
): DecisionPoint[] {
  const decisionPoints: DecisionPoint[] = [];
  const context = createEmptyContext();
  
  for (const event of trace.events) {
    updateContext(context, event);
    
    if (isDecisionPoint(event)) {
      const policyDecision = evaluatePolicy(policy, context);
      decisionPoints.push({
        timestamp: event.timestamp,
        problemId: event.problemId,
        context: { ...context },
        actualDecision: getActualDecision(trace, event.timestamp),
        policyDecision
      });
    }
  }
  
  return decisionPoints;
}
```

2. **Evaluation Metrics**
```typescript
export function calculateReplayMetrics(
  decisionPoints: DecisionPoint[],
  trace: ReplayInput
): ReplayMetrics {
  return {
    explanationsShown: countExplanations(decisionPoints),
    avgEscalationDepth: calculateAvgEscalationDepth(decisionPoints),
    simulatedHDI: calculateSimulatedHDI(decisionPoints, trace),
    simulatedCoverage: calculateSimulatedCoverage(decisionPoints),
    estimatedTimeToSuccess: estimateTimeToSuccess(decisionPoints, trace)
  };
}
```

**CLI:**
```bash
npm run replay:counterfactual --learner=learner-123 --policies=all
```

---

### Component 14: Concept Graph

**Files to Create**:
```
apps/web/src/app/data/concept-graph.ts           # Dependency DAG
apps/web/src/app/lib/mastery-propagation.ts      # Score propagation
```

**Implementation:**

1. **Graph Structure**
```typescript
export const SQL_CONCEPT_GRAPH: ConceptGraph = {
  nodes: [
    { id: 'select-basic', prerequisites: [], successors: ['where-clause'] },
    { id: 'where-clause', prerequisites: ['select-basic'], successors: ['joins', 'aggregation'] },
    { id: 'joins', prerequisites: ['where-clause'], successors: ['subqueries'] },
    { id: 'aggregation', prerequisites: ['where-clause'], successors: ['group-by'] },
    { id: 'group-by', prerequisites: ['aggregation'], successors: ['having-clause'] }
  ],
  edges: [
    { from: 'select-basic', to: 'where-clause', strength: 1.0, type: 'hard' },
    { from: 'where-clause', to: 'joins', strength: 0.9, type: 'hard' },
    { from: 'aggregation', to: 'group-by', strength: 1.0, type: 'hard' }
  ]
};
```

2. **Mastery Propagation**
```typescript
export function propagateMastery(
  masteryScores: Map<string, ConceptMastery>,
  graph: ConceptGraph
): Map<string, ConceptMastery> {
  const propagated = new Map(masteryScores);
  const sorted = topologicalSort(graph);
  
  for (const conceptId of sorted) {
    const concept = graph.getNode(conceptId);
    const current = propagated.get(conceptId);
    
    let minPrereqMastery = 100;
    for (const prereqId of concept.prerequisites) {
      const prereq = propagated.get(prereqId);
      if (prereq) minPrereqMastery = Math.min(minPrereqMastery, prereq.score);
    }
    
    if (minPrereqMastery < 50) {
      const adjusted = Math.min(current?.score || 0, minPrereqMastery + 20);
      propagated.set(conceptId, { ...current, score: adjusted, confidence: 'low' });
    }
  }
  
  return propagated;
}
```

3. **Blocked Node Detection**
```typescript
export function detectBlockedNodes(
  history: InteractionEvent[],
  graph: ConceptGraph
): BlockedNode[] {
  const blocked: BlockedNode[] = [];
  const mastery = calculateMasteryScores(history);
  
  for (const [conceptId, m] of mastery) {
    if (m.score < 40 && m.confidence === 'low') {
      const concept = graph.getNode(conceptId);
      for (const prereqId of concept.prerequisites) {
        const prereq = mastery.get(prereqId);
        if (!prereq || prereq.score < 60) {
          blocked.push({ conceptId, prerequisite: prereqId, gap: 60 - (prereq?.score || 0) });
        }
      }
    }
  }
  
  return blocked.sort((a, b) => b.gap - a.gap);
}
```

**Events:**
- `mastery_propagated`
- `prerequisite_violation_detected`
- `learning_path_recommended`

---

## Week 8: Quality & Experimentation

### Component 15: Self-Explanation Detection (RQS)

**Files to Create**:
```
apps/web/src/app/lib/rqs-calculator.ts           # Reflection quality
```

**Implementation:**

```typescript
export function calculateRQS(
  learnerNote: string,
  systemExplanation: string
): { rqs: number; level: 'high' | 'medium' | 'low'; breakdown: RQSBreakdown } {
  const length = calculateLengthScore(learnerNote);
  const lexical = calculateLexicalOverlap(learnerNote, systemExplanation);
  const keywords = calculateKeywordScore(learnerNote);
  const example = calculateExampleScore(learnerNote);
  const structure = calculateStructureScore(learnerNote);
  
  const rqs = Math.max(0, Math.min(1,
    0.15 * length + 0.20 * lexical + 0.25 * 0.5 + // paraphrase placeholder
    0.15 * keywords + 0.15 * example + 0.10 * structure
  ));
  
  return {
    rqs,
    level: rqs > 0.7 ? 'high' : rqs > 0.4 ? 'medium' : 'low',
    breakdown: { length, lexical, keywords, example, structure }
  };
}
```

**Events:**
- `rqs_calculated`
- `rqs_intervention_triggered`

---

### Component 16: Experimental Manipulations

**Files to Create**:
```
apps/web/src/app/lib/experimental-conditions.ts  # Toggle system
```

**Implementation:**

```typescript
export const EXPERIMENTAL_CONDITIONS: Record<string, FeatureFlags> = {
  'control': {
    enableTextbook: true, enableSaveToNotes: true, enableAutoEscalation: true,
    enableLLM: true, skipHintLadder: false, escalationProfile: 'adaptive-medium'
  },
  'textbook_disabled': {
    enableTextbook: false, enableSaveToNotes: false, enableAutoEscalation: true,
    enableLLM: true, skipHintLadder: false, escalationProfile: 'adaptive-medium'
  },
  'immediate_explanation': {
    enableTextbook: true, enableSaveToNotes: true, enableAutoEscalation: false,
    enableLLM: true, skipHintLadder: true, escalationProfile: 'immediate'
  },
  'static_hints': {
    enableTextbook: true, enableSaveToNotes: true, enableAutoEscalation: true,
    enableLLM: false, skipHintLadder: false, escalationProfile: 'adaptive-medium'
  },
  'fast_escalator': {
    enableTextbook: true, enableSaveToNotes: true, enableAutoEscalation: true,
    enableLLM: true, skipHintLadder: false, escalationProfile: 'fast-escalator'
  },
  'slow_escalator': {
    enableTextbook: true, enableSaveToNotes: true, enableAutoEscalation: true,
    enableLLM: true, skipHintLadder: false, escalationProfile: 'slow-escalator'
  }
};

export function assignCondition(learnerId: string): string {
  const hash = hashCode(learnerId);
  const conditions = Object.keys(EXPERIMENTAL_CONDITIONS);
  return conditions[hash % conditions.length];
}
```

**Events:**
- `experimental_condition_assigned`
- `feature_flag_checked`

---

## Week 9: Affective Layer & Dashboard

### Component 17: Affective Proxy Layer

**Files to Create**:
```
apps/web/src/app/lib/aps-calculator.ts           # Affective proxy
```

**Implementation:**

```typescript
export function calculateAPS(history: InteractionEvent[]): {
  aps: number;
  level: 'low' | 'medium' | 'high';
  components: APSComponents;
} {
  const repeated = calculateRepeatedIdenticalErrors(history);
  const rapid = calculateRapidEscalationToL3(history);
  const switching = calculateProblemSwitchingRate(history);
  const idle = calculateIdlePeriods(history);
  const bursts = calculateErrorBursts(history);
  const dismissal = calculateHelpDismissalRate(history);
  
  const aps = Math.max(0, Math.min(1,
    0.20 * repeated + 0.15 * rapid + 0.25 * switching + 
    0.10 * idle + 0.20 * bursts + 0.10 * dismissal
  ));
  
  return {
    aps,
    level: aps < 0.3 ? 'low' : aps < 0.6 ? 'medium' : 'high',
    components: { repeated, rapid, switching, idle, bursts, dismissal }
  };
}
```

**Adaptive Response:**
```typescript
export function respondToAffectiveState(learnerId: string, aps: number): void {
  if (aps > 0.8) {
    triggerImmediateHelp(learnerId);
    showEncouragement(learnerId, "This is a tough one! Let's break it down.");
  } else if (aps > 0.6) {
    showEncouragement(learnerId, "You're making progress! Keep trying.");
    enableFasterEscalation(learnerId);
  }
}
```

---

### Research Dashboard 2.0

**Files to Create**:
```
apps/web/src/app/components/ResearchDashboardV2.tsx
apps/web/src/app/components/visualizations/
  - LearnerClusteringView.tsx
  - EscalationHeatmap.tsx
  - ErrorTransitionMatrix.tsx
  - ConceptMasteryTimeline.tsx
  - PolicyComparisonPanel.tsx
```

**Visualizations:**

1. **Learner Clustering View**
   - Scatter plot: HDI vs CSI
   - Color: Learner type (persistent, rapid corrector, oscillatory)
   - Size: Total interactions

2. **Escalation Heatmap**
   - X-axis: Problems
   - Y-axis: Learners
   - Color: Escalation frequency

3. **Error Transition Matrix**
   - Grid: Error subtypes
   - Values: Transition probabilities
   - Highlight: Persistent loops

4. **Concept Mastery Timeline**
   - X-axis: Time
   - Y-axis: Concepts
   - Lines: Mastery progression per learner

5. **Policy Comparison Panel**
   - Bar charts: Metrics by policy
   - Statistical tests: Significance indicators
   - Winner highlighting

---

## Week 10-12: Validation & Publication

### Experimental Protocol

**Experiment 1: Textbook Effectiveness**
- Treatment: Full system with textbook
- Control: Textbook disabled
- N: 50 per group
- Duration: 2 weeks
- Metrics: Retention at 7 days, completion rate, HDI

**Experiment 2: Escalation Speed**
- Conditions: Fast, Slow, Adaptive
- N: 30 per group
- Duration: 1 week
- Metrics: HDI trajectory, completion rate, satisfaction

**Experiment 3: Immediate vs Progressive**
- Treatment: Progressive hint ladder
- Control: Immediate explanation
- N: 40 per group
- Metrics: Time to success, retention, concept coverage

### Analysis Pipeline

```bash
# Generate all reports
npm run analyze:all --output=reports/

# Specific analyses
npm run analyze:hdi-by-profile
npm run analyze:bandit-convergence
npm run analyze:replay-comparison
npm run analyze:correlation-matrix
```

### Publication Package

**Figures:**
1. System architecture diagram
2. Guidance ladder flowchart
3. HDI trajectory examples
4. Bandit convergence plot
5. Policy comparison heatmap
6. Concept dependency graph

**Tables:**
1. Component implementation status
2. Experimental conditions summary
3. Statistical test results
4. Correlation matrix

**Claims:**
1. "Adaptive escalation reduces dependency compared to static thresholds"
2. "Bandit optimization converges to optimal policy within N interactions"
3. "HDI predicts long-term learning outcomes with X% accuracy"
4. "Counterfactual replay enables policy comparison without new studies"

---

## File Alignment Checklist

### Core Types (apps/web/src/app/types/index.ts)
Add new types:
- [x] `EscalationProfile` - Week 5 ✅
- [x] `BanditArm`, `MultiArmedBanditState` - Week 5 ✅
- [x] `HDIResult`, `HDIComponents` - Week 5 ✅
- [ ] `CSIResult`, `CSIComponents` - Week 6
- [ ] `APSResult`, `APSComponents` - Week 9
- [ ] `ErrorTransitionGraph` - Week 6
- [ ] `ReinforcementSchedule` - Week 6
- [ ] `RQSResult` - Week 8
- [ ] `ExperimentalCondition`, `FeatureFlags` - Week 8
- [ ] `ReplayInput`, `DecisionPoint`, `ReplayMetrics` - Week 7
- [ ] `ConceptGraph`, `ConceptNode`, `ConceptEdge` - Week 7

### Event Types (add to InteractionEvent)
- [x] `profile_assigned` - Week 5 ✅
- [x] `escalation_triggered` - Week 5 ✅
- [x] `profile_adjusted` - Week 5 ✅
- [x] `bandit_arm_selected` - Week 5 ✅
- [x] `bandit_reward_observed` - Week 5 ✅
- [x] `bandit_updated` - Week 5 ✅
- [x] `hdi_calculated` - Week 5 ✅
- [x] `hdi_trajectory_updated` - Week 5 ✅
- [x] `dependency_intervention_triggered` - Week 5 ✅
- [ ] `csi_calculated` - Week 6
- [ ] `csi_escalation_adjusted` - Week 6
- [ ] `csi_intervention_triggered` - Week 6
- [ ] `aps_calculated` - Week 9
- [ ] `affective_intervention_triggered` - Week 9
- [ ] `error_trajectory_analyzed` - Week 6
- [ ] `learner_type_reclassified` - Week 6
- [ ] `mastery_propagated` - Week 7
- [ ] `prerequisite_violation_detected` - Week 7
- [ ] `learning_path_recommended` - Week 7
- [ ] `reinforcement_scheduled` - Week 6
- [ ] `reinforcement_prompt_shown` - Week 6
- [ ] `reinforcement_response` - Week 6
- [ ] `rqs_calculated` - Week 8
- [ ] `experimental_condition_assigned` - Week 8
- [ ] `replay_started`, `replay_decision_point`, `replay_completed` - Week 7

### Lib Files Status

```
apps/web/src/app/lib/
├── escalation-profiles.ts          ✅ Component 7 (Week 5)
├── adaptive-threshold.ts           📋 Component 7 (Future)
├── multi-armed-bandit.ts           ✅ Component 8 (Week 5)
├── learner-bandit-manager.ts       ✅ Component 8 (Week 5)
├── reward-calculator.ts            ✅ Component 8 (Week 5)
├── hdi-calculator.ts               ✅ Component 9 (Week 5)
├── hdi-debug.ts                    ✅ Component 9 (Week 5)
├── reinforcement-scheduler.ts      📋 Component 10 (Week 6)
├── micro-check-generator.ts        📋 Component 10 (Week 6)
├── error-trajectory.ts             📋 Component 11 (Week 6)
├── csi-calculator.ts               📋 Component 12 (Week 6)
├── replay-metrics.ts               📋 Component 13 (Week 7)
├── concept-graph.ts                📋 Component 14 (Week 7)
├── mastery-propagation.ts          📋 Component 14 (Week 7)
├── rqs-calculator.ts               📋 Component 15 (Week 8)
├── experimental-conditions.ts      📋 Component 16 (Week 8)
└── aps-calculator.ts               📋 Component 17 (Week 9)
```

### Script Files to Create
```
scripts/
├── replay-counterfactual.mjs       📋 Component 13 (Week 7)
├── analyze-hdi.mjs                 📋 Analysis script
├── analyze-bandit.mjs              📋 Analysis script
├── analyze-csi.mjs                 📋 Analysis script
└── generate-reports.mjs            📋 Report generation
```

### Component Files to Create/Update
```
apps/web/src/app/components/
├── ReinforcementPrompt.tsx         📋 Component 10 (Week 6)
├── ResearchDashboardV2.tsx         📋 Dashboard 2.0 (Week 9)
└── visualizations/
    ├── LearnerClusteringView.tsx   📋 Week 9
    ├── EscalationHeatmap.tsx       📋 Week 9
    ├── ErrorTransitionMatrix.tsx   📋 Week 9
    ├── ConceptMasteryTimeline.tsx  📋 Week 9
    └── PolicyComparisonPanel.tsx   📋 Week 9
```

---

## Testing Strategy

### Unit Tests (Vitest)
- [x] `escalation-profiles.test.ts` - 30 tests ✅
- [x] `multi-armed-bandit.test.ts` - 45 tests ✅
- [x] `hdi-calculator.test.ts` - 43 tests ✅
- [ ] `csi-calculator.test.ts` - Week 6
- [ ] `aps-calculator.test.ts` - Week 9
- [ ] `error-trajectory.test.ts` - Week 6
- [ ] `rqs-calculator.test.ts` - Week 8
- [ ] `concept-graph.test.ts` - Week 7

### E2E Tests (Playwright)
- [x] `week5-*.spec.ts` - Week 5 components ✅
- [ ] `escalation-profiles.spec.ts` - @weekly
- [ ] `bandit-assignment.spec.ts` - @weekly
- [ ] `hdi-calculation.spec.ts` - @weekly
- [ ] `experimental-conditions.spec.ts` - @weekly
- [ ] `research-dashboard-v2.spec.ts` - @weekly

### Integration Tests
- [x] End-to-end escalation flow with profiles - Week 5 ✅
- [x] Bandit learning over multiple problems - Week 5 ✅
- [x] HDI intervention triggering - Week 5 ✅
- [ ] Counterfactual replay batch processing - Week 7

---

## Risk Mitigation

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| Bandit convergence slow | Medium | Implement ε-greedy with decay | ✅ Mitigated |
| HDI calculation expensive | Low | Cache results, compute incrementally | ✅ Mitigated |
| Replay takes too long | Medium | Parallel processing, sampling | 📋 Planned |
| Too many events logged | Low | Implement log rotation | 📋 Planned |
| UI becomes cluttered | Medium | Progressive disclosure, tabs | ✅ Mitigated |
| Statistical power insufficient | High | Plan for longer collection period | 📋 Monitoring |

---

## Success Criteria

By end of Week 12:

1. **All 17 components implemented** - 9/17 Complete (53%)
2. **696+ tests passing** - 316 unit + 380 E2E ✅
3. **Research Dashboard 2.0 functional** - 📋 Week 9
4. **3 experiments completed** - 📋 Weeks 10-12
5. **Publication-ready figures generated** - 📋 Week 12
6. **All documentation updated** - 🔄 In Progress

---

## Timeline Gantt Chart

```
Week:  5        6        7        8        9        10-12
      ├────────┼────────┼────────┼────────┼────────┼────────┤
C7    ████████✅
C8    ████████✅
C9    ████████✅
C10            ████
C11            ████████
C12            ████
C13                     ████████
C14                     ████████
C15                              ████████
C16                              ████████
C17                                       ████████
Tests ████████████████████████████████████████████✅
Dashboard                             ████████████████
Validation                                       ████████████████
```

**Legend:**
- `█` Planned work
- `✅` Complete

---

*Plan created: 2026-02-27*  
*Last updated: 2026-03-02*  
*Status: Week 5 Complete — 696 total tests passing (316 unit + 380 E2E)*
