# Hint Dependency Index (HDI)

**Component**: 9 of 17  
**Status**: ✅ **Complete** (Week 5)  
**Research Question**: Are learners becoming dependent on scaffolding?

---

## Implementation Status

| Aspect | Status | Evidence |
|--------|--------|----------|
| 5 Component Calculations | ✅ Complete | `hdi-calculator.ts` |
| Combined HDI Score | ✅ Complete | `calculateHDI()` function |
| HDI Debug Utilities | ✅ Complete | `hdi-debug.ts` with 27 unit tests |
| Event Logging | ✅ Complete | `hdi_calculated`, `hdi_trajectory_updated`, `dependency_intervention_triggered` |
| UI Integration | ✅ Complete | LearningInterface profile badge, Settings page HDI display |
| Unit Tests | ✅ Complete | 96 tests passing (69 calculator + 27 debug) |

**Test Coverage**: 96 unit tests in `apps/web/src/app/lib/hdi-calculator.test.ts` (69) and `hdi-debug.test.ts` (27)

---

## Definition

**Hint Dependency Index (HDI)** is a multi-dimensional measure of learner reliance on instructional scaffolding. It captures not just frequency of hints, but depth of reliance and inability to recover independently.

**Key Insight**: Dependency ≠ Frequency. A learner who uses many hints but improves is not dependent. A learner who needs explanations for every problem is dependent.

---

## HDI Components

### Component 1: Hints Per Attempt (HPA)

```typescript
function calculateHPA(learnerHistory: LearnerHistory): number {
  const totalHints = learnerHistory.events
    .filter(e => e.eventType === 'hint_view')
    .length;
  
  const totalAttempts = learnerHistory.events
    .filter(e => e.eventType === 'execution')
    .length;
  
  return totalAttempts > 0 ? totalHints / totalAttempts : 0;
}

// Normalization: 0 hints = 0.0, 3+ hints per attempt = 1.0
function normalizeHPA(hpa: number): number {
  return Math.min(1.0, hpa / 3.0);
}
```

**Interpretation**:
- HPA < 0.3: Uses hints sparingly
- HPA 0.3-0.7: Moderate hint use
- HPA > 0.7: Heavy hint reliance

---

### Component 2: Average Escalation Depth (AED)

```typescript
function calculateAED(learnerHistory: LearnerHistory): number {
  const escalations = learnerHistory.events
    .filter(e => e.eventType === 'guidance_escalate');
  
  if (escalations.length === 0) return 0;
  
  const totalDepth = escalations.reduce((sum, e) => {
    // Depth: 1 (L1→L2) or 2 (L2→L3) or 3 (L3→explanation)
    return sum + (e.toRung - e.fromRung);
  }, 0);
  
  return totalDepth / escalations.length;
}

// Normalization: depth 1 = 0.33, depth 3 = 1.0
function normalizeAED(aed: number): number {
  return Math.min(1.0, aed / 3.0);
}
```

**Interpretation**:
- AED < 0.3: Stays at low rungs
- AED 0.3-0.7: Reaches explanation occasionally
- AED > 0.7: Frequently needs full explanations

---

### Component 3: Explanation Rate (ER)

```typescript
function calculateER(learnerHistory: LearnerHistory): number {
  const problemsAttempted = new Set(
    learnerHistory.events
      .filter(e => e.eventType === 'execution')
      .map(e => e.problemId)
  ).size;
  
  const problemsWithExplanation = new Set(
    learnerHistory.events
      .filter(e => e.eventType === 'explanation_view')
      .map(e => e.problemId)
  ).size;
  
  return problemsAttempted > 0 
    ? problemsWithExplanation / problemsAttempted 
    : 0;
}

// Already normalized [0, 1]
```

**Interpretation**:
- ER < 0.3: Solves most problems without explanation
- ER 0.3-0.7: Needs explanation for some problems
- ER > 0.7: Needs explanation for most problems

---

### Component 4: Repeated Error After Explanation (REAE)

```typescript
function calculateREAE(learnerHistory: LearnerHistory): number {
  // Find errors that occurred after viewing explanation
  const errorsAfterExplanation = learnerHistory.events
    .filter((e, index) => {
      if (e.eventType !== 'error') return false;
      
      // Check if explanation was viewed before this error
      const previousEvents = learnerHistory.events.slice(0, index);
      const lastExplanation = previousEvents
        .reverse()
        .find(pe => pe.eventType === 'explanation_view');
      
      return lastExplanation !== undefined;
    });
  
  const totalErrors = learnerHistory.events
    .filter(e => e.eventType === 'error')
    .length;
  
  return totalErrors > 0 
    ? errorsAfterExplanation.length / totalErrors 
    : 0;
}

// Normalization: already [0, 1]
```

**Interpretation**:
- REAE < 0.3: Explanation helps prevent further errors
- REAE 0.3-0.7: Explanation helps partially
- REAE > 0.7: Explanation doesn't prevent errors (not internalizing)

---

### Component 5: Improvement Without Hint Rate (IWH)

This component has **negative weight** (higher is better, reduces HDI).

```typescript
function calculateIWH(learnerHistory: LearnerHistory): number {
  // Find sequences: error → success without hint in between
  let improvementsWithoutHint = 0;
  let totalErrorSequences = 0;
  
  for (let i = 0; i < learnerHistory.events.length - 1; i++) {
    if (learnerHistory.events[i].eventType === 'error') {
      totalErrorSequences++;
      
      // Check if next success had no hint in between
      const subsequentEvents = learnerHistory.events.slice(i + 1);
      const nextSuccess = subsequentEvents.find(
        e => e.eventType === 'execution' && e.successful
      );
      const hintBetween = subsequentEvents.slice(
        0, 
        subsequentEvents.indexOf(nextSuccess)
      ).some(e => e.eventType === 'hint_view');
      
      if (nextSuccess && !hintBetween) {
        improvementsWithoutHint++;
      }
    }
  }
  
  return totalErrorSequences > 0 
    ? improvementsWithoutHint / totalErrorSequences 
    : 0;
}

// Already normalized [0, 1]
```

**Interpretation**:
- IWH < 0.3: Always needs hint after error
- IWH 0.3-0.7: Sometimes recovers independently
- IWH > 0.7: Often recovers without help

---

## HDI Formula

```typescript
interface HDIWeights {
  hpa: number;
  aed: number;
  er: number;
  reae: number;
  iwh: number;  // Negative weight
}

const DEFAULT_HDI_WEIGHTS: HDIWeights = {
  hpa: 0.3,
  aed: 0.133,
  er: 0.3,
  reae: 0.133,
  iwh: 0.134  // Positive weight: (1 - iwh) in formula inverts this metric
};

function calculateHDI(
  learnerHistory: LearnerHistory,
  weights: HDIWeights = DEFAULT_HDI_WEIGHTS
): number {
  const hpa = normalizeHPA(calculateHPA(learnerHistory));
  const aed = normalizeAED(calculateAED(learnerHistory));
  const er = calculateER(learnerHistory);
  const reae = calculateREAE(learnerHistory);
  const iwh = calculateIWH(learnerHistory);
  
  const rawHDI = 
    weights.hpa * hpa +
    weights.aed * aed +
    weights.er * er +
    weights.reae * reae +
    (1 - components.iwh) * WEIGHTS.iwh;  // Inverted: higher IWH reduces HDI
  
  // Normalize to [0, 1]
  return Math.max(0, Math.min(1, rawHDI));
}
```

---

## HDI Thresholds

| Level | HDI Range | Interpretation | Intervention |
|-------|-----------|----------------|--------------|
| **Low** | 0.0 - 0.3 | Independent learner | Maintain current approach |
| **Medium** | 0.3 - 0.6 | Moderate reliance | Monitor closely |
| **High** | 0.6 - 1.0 | Potential dependency | **Trigger intervention** |

---

## Intervention Triggers

When HDI > 0.6, trigger one of:

### Intervention 1: Dependency Warning Toast

```typescript
// Implemented in LearningInterface.tsx
// Shows toast: "You're doing great! 💪 Try solving the next one without hints"
// Auto-dismisses after 5 seconds
```

### Intervention 2: Progress Hint

```typescript
// Shows every ~15 interactions based on HDI trend:
// - HDI decreasing: "Your independence is growing! 🌱"
// - HDI increasing (> 0.5): "Take your time, read hints carefully"
// - Low HDI (< 0.3): "Great job solving independently! 🌟"
```

### Intervention 3: Switch to Slow Escalator

```typescript
function switchToSlowEscalator(learnerId: string): void {
  // Force more struggle before help
  updateLearnerProfile(learnerId, {
    escalationProfile: 'slow-escalator'
  });
  
  logEvent({
    eventType: 'dependency_intervention_triggered',
    interventionType: 'profile_switch_slow',
    triggerHDI: 0.8,
    learnerId
  });
}
```

---

## Implementation Files

| File | Purpose | Lines |
|------|---------|-------|
| `apps/web/src/app/lib/hdi-calculator.ts` | Core HDI calculation | ~262 |
| `apps/web/src/app/lib/hdi-calculator.test.ts` | Unit tests (43 tests) | ~300 |
| `apps/web/src/app/lib/hdi-debug.ts` | Debug utilities | ~215 |
| `apps/web/src/app/lib/hdi-debug.test.ts` | Debug tests (27 tests) | ~180 |
| `apps/web/src/app/pages/LearningInterface.tsx` | HDI display, interventions | ~50 |
| `apps/web/src/app/pages/SettingsPage.tsx` | HDI debug panel | ~80 |

---

## HDI Trajectory Analysis

Track HDI over time to detect trends:

```typescript
interface HDITrajectory {
  learnerId: string;
  measurements: Array<{
    timestamp: number;
    hdi: number;
    windowEvents: number;  // Events in calculation window
  }>;
  trend: 'increasing' | 'stable' | 'decreasing';
  slope: number;  // HDI change per day
}

function analyzeHDITrajectory(
  learnerHistory: LearnerHistory,
  windowDays: number = 7
): HDITrajectory {
  const measurements = [];
  
  // Calculate HDI for each day
  for (let day = 0; day < windowDays; day++) {
    const dayStart = Date.now() - (windowDays - day) * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    
    const dayEvents = learnerHistory.events.filter(
      e => e.timestamp >= dayStart && e.timestamp < dayEnd
    );
    
    const dayHDI = calculateHDI({ events: dayEvents });
    measurements.push({
      timestamp: dayStart,
      hdi: dayHDI,
      windowEvents: dayEvents.length
    });
  }
  
  // Calculate trend
  const firstHDI = measurements[0]?.hdi || 0;
  const lastHDI = measurements[measurements.length - 1]?.hdi || 0;
  const slope = (lastHDI - firstHDI) / windowDays;
  
  const trend = slope > 0.05 ? 'increasing' :
                slope < -0.05 ? 'decreasing' : 'stable';
  
  return { learnerId: learnerHistory.learnerId, measurements, trend, slope };
}
```

---

## Logging Schema

### Event: `hdi_calculated`

```typescript
{
  eventType: 'hdi_calculated',
  timestamp: number,
  learnerId: string,
  hdi: number,  // 0-1
  level: 'low' | 'medium' | 'high',
  components: {
    hpa: number,
    aed: number,
    er: number,
    reae: number,
    iwh: number
  },
  calculationWindow: {
    startTime: number,
    endTime: number,
    eventCount: number
  }
}
```

### Event: `hdi_trajectory_updated`

```typescript
{
  eventType: 'hdi_trajectory_updated',
  timestamp: number,
  learnerId: string,
  trend: 'increasing' | 'stable' | 'decreasing',
  slope: number,
  currentHDI: number,
  previousHDI: number,
  delta: number
}
```

### Event: `dependency_intervention_triggered`

```typescript
{
  eventType: 'dependency_intervention_triggered',
  timestamp: number,
  learnerId: string,
  interventionType: 'toast_warning' | 'progress_hint' | 'profile_switch',
  triggerHDI: number,
  hdiTrajectory: 'increasing' | 'stable' | 'decreasing',
  componentsAtTrigger: {
    hpa: number,
    aed: number,
    er: number,
    reae: number,
    iwh: number
  }
}
```

---

## Analysis Queries

### Average HDI by escalation profile

```javascript
db.events.aggregate([
  { $match: { eventType: 'hdi_calculated' } },
  { $lookup: {
    from: 'profiles',
    localField: 'learnerId',
    foreignField: 'learnerId',
    as: 'profile'
  }},
  { $group: {
    _id: '$profile.escalationProfile',
    avgHDI: { $avg: '$hdi' },
    highDependencyRate: { 
      $avg: { $cond: [{ $gte: ['$hdi', 0.6] }, 1, 0] }
    }
  }}
]);
```

### HDI trend prediction

```javascript
// Find learners whose HDI is increasing
// and predict when they'll hit high dependency
db.events.aggregate([
  { $match: { eventType: 'hdi_trajectory_updated' } },
  { $match: { trend: 'increasing', slope: { $gt: 0.05 } } },
  { $project: {
    learnerId: 1,
    currentHDI: 1,
    slope: 1,
    daysToHigh: { 
      $divide: [{ $subtract: [0.6, '$currentHDI'] }, '$slope'] 
    }
  }}
]);
```

### Intervention effectiveness

```javascript
// Compare HDI before and after intervention
db.events.aggregate([
  { $match: { eventType: 'dependency_intervention_triggered' } },
  { $lookup: {
    from: 'events',
    let: { learnerId: '$learnerId', triggerTime: '$timestamp' },
    pipeline: [
      { $match: { 
        $expr: { 
          $and: [
            { $eq: ['$learnerId', '$$learnerId'] },
            { $eq: ['$eventType', 'hdi_calculated'] },
            { $gt: ['$timestamp', '$$triggerTime'] }
          ]
        }
      }},
      { $sort: { timestamp: 1 } },
      { $limit: 1 }
    ],
    as: 'postInterventionHDI'
  }},
  { $group: {
    _id: '$interventionType',
    avgHDIReduction: { 
      $avg: { 
        $subtract: ['$triggerHDI', { $arrayElemAt: ['$postInterventionHDI.hdi', 0] }] 
      }
    }
  }}
]);
```

---

## Integration with Other Components

| Component | Integration |
|-----------|-------------|
| Escalation Policies | Use HDI to select profile (high HDI → slow escalator) |
| Multi-Armed Bandit | Include HDI in reward (penalty for increasing HDI) |
| Counterfactual Replay | Compare HDI trajectories across policies |
| Experimental Manipulations | HDI as dependent variable |

---

## Research Questions

1. **Does fast escalation increase HDI?**
   - Hypothesis: Fast escalator → higher HDI → dependency

2. **Can we predict HDI from early behavior?**
   - First 3 problems predictive of final HDI?

3. **Which intervention reduces HDI most effectively?**
   - Compare toast warning vs profile switch vs progress hints

4. **Is there an optimal HDI?**
   - Too low = no scaffolding benefit
   - Too high = dependency
   - Sweet spot for learning?

---

## Test Coverage

### Unit Tests (43 tests)

| Test Suite | Count | File |
|------------|-------|------|
| HDI Calculator | 16 | `hdi-calculator.test.ts` |
| HDI Debug Utilities | 27 | `hdi-debug.test.ts` |

### E2E Tests

| Test Suite | Count | File |
|------------|-------|------|
| Week 5 Indicators | 11 | `week5-indicators.spec.ts` |
| Settings HDI Panel | 8 | `settings-page-week5.spec.ts` |

---

## References

- Implementation: `apps/web/src/app/lib/hdi-calculator.ts`
- Tests: `apps/web/src/app/lib/hdi-calculator.test.ts`
- Debug utilities: `apps/web/src/app/lib/hdi-debug.ts`
- UI Integration: `apps/web/src/app/pages/LearningInterface.tsx`

---

*Last updated: 2026-03-02*  
*Status: Week 5 Complete — 96 unit tests passing*
