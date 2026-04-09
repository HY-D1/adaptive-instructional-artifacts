# Counterfactual Replay Evaluation

**Component**: 13 of 17  
**Status**: 📋 Planned  
**Research Question**: What would have happened with a different policy?

---

## Concept

We log full learner traces. That means we can **reconstruct**:
- When errors occurred
- When hints were shown
- When escalation happened
- When explanations were triggered

**Replay**: Take the same learner trace and simulate what would have happened under a **different escalation policy**.

**Key Principle**: We are NOT changing the learner's behavior. We are changing only the system's decisions.

---

## Why This Matters

Traditional A/B testing requires:
- Random assignment
- Parallel groups
- Time
- Risk of suboptimal experiences

**Counterfactual Replay**:
- Uses existing data
- Compares any number of policies
- No risk to learners
- Generate evidence for publication

**Research Value**: Off-policy evaluation. Very few tutoring systems allow this kind of counterfactual analysis.

---

## Replay Inputs

### Required Data for Each Learner

```typescript
interface ReplayInput {
  learnerId: string;
  events: Array<{
    id: string;
    timestamp: number;
    eventType: string;
    problemId: string;
    errorSubtypeId?: string;
    successful?: boolean;
    // ... other relevant fields
  }>;
  metadata: {
    startTime: number;
    endTime: number;
    totalProblems: number;
    finalSuccess: boolean;
  };
}

// Example trace
const exampleTrace: ReplayInput = {
  learnerId: 'learner-123',
  events: [
    { id: 'e1', timestamp: 0, eventType: 'execution', problemId: 'p1' },
    { id: 'e2', timestamp: 5000, eventType: 'error', problemId: 'p1', errorSubtypeId: 'join_missing' },
    { id: 'e3', timestamp: 8000, eventType: 'hint_request', problemId: 'p1' },
    { id: 'e4', timestamp: 12000, eventType: 'error', problemId: 'p1', errorSubtypeId: 'join_missing' },
    { id: 'e5', timestamp: 15000, eventType: 'explanation_view', problemId: 'p1' },
    { id: 'e6', timestamp: 20000, eventType: 'execution', problemId: 'p1', successful: true },
    // ... more events
  ],
  metadata: { startTime: 0, endTime: 300000, totalProblems: 5, finalSuccess: true }
};
```

---

## Alternative Policies

### Policy 1: Aggressive Escalation

```typescript
const aggressivePolicy: EscalationPolicy = {
  name: 'aggressive',
  description: 'Escalate quickly to minimize struggle',
  thresholds: {
    escalate: 2,      // After 2 errors → explanation
    aggregate: 4
  },
  triggers: {
    timeStuck: 2 * 60 * 1000,     // 2 minutes
    rungExhausted: 2               // After 2 hints
  },
  skipHintLadder: false
};
```

### Policy 2: Conservative Escalation

```typescript
const conservativePolicy: EscalationPolicy = {
  name: 'conservative',
  description: 'Force productive struggle before help',
  thresholds: {
    escalate: 5,      // After 5 errors → explanation
    aggregate: 8
  },
  triggers: {
    timeStuck: 8 * 60 * 1000,     // 8 minutes
    rungExhausted: 4               // After 4 hints
  },
  skipHintLadder: false
};
```

### Policy 3: Explanation-First

```typescript
const explanationFirstPolicy: EscalationPolicy = {
  name: 'explanation-first',
  description: 'Skip hint ladder, go straight to explanation',
  thresholds: {
    escalate: 1,      // First error → explanation
    aggregate: 3
  },
  triggers: {
    timeStuck: 1 * 60 * 1000,
    rungExhausted: 1
  },
  skipHintLadder: true  // Key difference
};
```

### Policy 4: Hint-Only

```typescript
const hintOnlyPolicy: EscalationPolicy = {
  name: 'hint-only',
  description: 'Never escalate to explanation',
  thresholds: {
    escalate: Infinity,  // Never escalate
    aggregate: Infinity
  },
  triggers: {
    timeStuck: Infinity,
    rungExhausted: Infinity
  },
  skipHintLadder: false
};
```

---

## Replay Algorithm

### Decision Point Reconstruction

```typescript
interface DecisionPoint {
  timestamp: number;
  problemId: string;
  context: {
    errorCount: number;
    hintCount: number;
    timeSpentMs: number;
    lastErrorSubtype?: string;
  };
  actualDecision: 'show_hint' | 'show_explanation' | 'add_to_textbook';
  policyDecision: 'show_hint' | 'show_explanation' | 'add_to_textbook';
}

function replayTrace(
  trace: ReplayInput,
  policy: EscalationPolicy
): DecisionPoint[] {
  const decisionPoints: DecisionPoint[] = [];
  const context = createEmptyContext();
  
  for (const event of trace.events) {
    // Update context based on event
    updateContext(context, event);
    
    // Check if this is a decision point
    if (isDecisionPoint(event)) {
      const policyDecision = evaluatePolicy(policy, context);
      
      decisionPoints.push({
        timestamp: event.timestamp,
        problemId: event.problemId,
        context: { ...context },
        actualDecision: getActualDecision(trace, event.timestamp),
        policyDecision
      });
      
      // Simulate policy effect on context
      if (policyDecision === 'show_explanation') {
        context.explanationShown = true;
        context.hintCount = 0;  // Reset for next cycle
      }
    }
  }
  
  return decisionPoints;
}

function isDecisionPoint(event: ReplayEvent): boolean {
  // Decision points are:
  // - Error events (should we show hint or escalate?)
  // - Hint requests (should we provide hint or escalate?)
  // - Time-based (periodic check)
  return ['error', 'hint_request'].includes(event.eventType);
}

function evaluatePolicy(
  policy: EscalationPolicy,
  context: Context
): 'show_hint' | 'show_explanation' | 'add_to_textbook' {
  // Check escalation threshold
  if (context.errorCount >= policy.thresholds.escalate) {
    return 'show_explanation';
  }
  
  // Check time stuck
  if (context.timeSpentMs >= policy.triggers.timeStuck) {
    return 'show_explanation';
  }
  
  // Check rung exhausted
  if (context.hintCount >= policy.triggers.rungExhausted) {
    return 'show_explanation';
  }
  
  // Default: show hint
  return 'show_hint';
}
```

---

## Evaluation Metrics

All metrics must be **computable from logs**.

### Metric 1: Total Explanations Shown

```typescript
function countExplanations(decisionPoints: DecisionPoint[]): number {
  return decisionPoints.filter(
    dp => dp.policyDecision === 'show_explanation'
  ).length;
}
```

### Metric 2: Average Escalation Depth

```typescript
function calculateAvgEscalationDepth(
  decisionPoints: DecisionPoint[]
): number {
  const escalations = decisionPoints.filter(
    dp => dp.policyDecision === 'show_explanation'
  );
  
  // Depth is based on context at decision point
  const depths = escalations.map(dp => {
    if (dp.context.errorCount >= 5) return 3;  // Deep escalation
    if (dp.context.errorCount >= 3) return 2;  // Moderate
    return 1;  // Early escalation
  });
  
  return depths.length > 0 
    ? depths.reduce((a, b) => a + b, 0) / depths.length
    : 0;
}
```

### Metric 3: Simulated Dependency Index (HDI)

```typescript
function calculateSimulatedHDI(
  decisionPoints: DecisionPoint[],
  trace: ReplayInput
): number {
  // Reconstruct what interactions would have occurred
  const simulatedInteractions = simulateInteractions(
    decisionPoints,
    trace
  );
  
  // Calculate HDI on simulated trace
  return calculateHDI(simulatedInteractions);
}
```

### Metric 4: Simulated Coverage Score

```typescript
function calculateSimulatedCoverage(
  decisionPoints: DecisionPoint[]
): number {
  // Count unique concepts that would have been covered
  const coveredConcepts = new Set(
    decisionPoints
      .filter(dp => dp.policyDecision === 'show_explanation')
      .map(dp => dp.context.lastErrorSubtype)
      .filter(Boolean)
  );
  
  return coveredConcepts.size;
}
```

### Metric 5: Simulated Time-to-Success Proxy

```typescript
function estimateTimeToSuccess(
  decisionPoints: DecisionPoint[],
  trace: ReplayInput
): number {
  // Assumption: Explanation helps solve faster
  const EXPLANATION_TIME_SAVINGS_MS = 30000;  // 30 seconds
  
  let estimatedTime = trace.metadata.endTime - trace.metadata.startTime;
  
  // Adjust based on policy decisions
  for (const dp of decisionPoints) {
    if (dp.policyDecision === 'show_explanation' &&
        dp.actualDecision !== 'show_explanation') {
      // This explanation would have helped
      estimatedTime -= EXPLANATION_TIME_SAVINGS_MS;
    } else if (dp.policyDecision !== 'show_explanation' &&
               dp.actualDecision === 'show_explanation') {
      // This explanation wouldn't have been shown
      estimatedTime += EXPLANATION_TIME_SAVINGS_MS;
    }
  }
  
  return Math.max(0, estimatedTime);
}
```

---

## Policy Comparison Report

```typescript
interface PolicyComparisonReport {
  learnerId: string;
  policies: Array<{
    name: string;
    metrics: {
      explanationsShown: number;
      avgEscalationDepth: number;
      simulatedHDI: number;
      simulatedCoverage: number;
      estimatedTimeToSuccess: number;
    };
    decisionPoints: DecisionPoint[];
  }>;
  winner: string;  // Best policy by composite score
  confidence: number;
}

function generateComparisonReport(
  trace: ReplayInput,
  policies: EscalationPolicy[]
): PolicyComparisonReport {
  const policyResults = policies.map(policy => {
    const decisionPoints = replayTrace(trace, policy);
    
    return {
      name: policy.name,
      metrics: {
        explanationsShown: countExplanations(decisionPoints),
        avgEscalationDepth: calculateAvgEscalationDepth(decisionPoints),
        simulatedHDI: calculateSimulatedHDI(decisionPoints, trace),
        simulatedCoverage: calculateSimulatedCoverage(decisionPoints),
        estimatedTimeToSuccess: estimateTimeToSuccess(decisionPoints, trace)
      },
      decisionPoints
    };
  });
  
  // Determine winner by composite score
  const winner = determineWinner(policyResults);
  
  return {
    learnerId: trace.learnerId,
    policies: policyResults,
    winner: winner.name,
    confidence: winner.confidence
  };
}

function determineWinner(
  policyResults: PolicyResult[]
): { name: string; confidence: number } {
  // Composite scoring
  // Lower explanations + lower HDI + higher coverage + lower time = better
  
  const scores = policyResults.map(p => {
    const normalizedExplanations = p.metrics.explanationsShown / 10;  // Assume max 10
    const normalizedHDI = p.metrics.simulatedHDI;
    const normalizedCoverage = p.metrics.simulatedCoverage / 10;
    const normalizedTime = p.metrics.estimatedTimeToSuccess / (5 * 60 * 1000);
    
    // Lower is better for explanations, HDI, time
    // Higher is better for coverage
    return {
      name: p.name,
      score: (1 - normalizedExplanations) * 0.25 +
             (1 - normalizedHDI) * 0.35 +
             normalizedCoverage * 0.20 +
             (1 - normalizedTime) * 0.20
    };
  });
  
  scores.sort((a, b) => b.score - a.score);
  
  // Confidence based on margin of victory
  const margin = scores[0].score - scores[1].score;
  const confidence = Math.min(1, margin * 5);  // Scale up
  
  return { name: scores[0].name, confidence };
}
```

---

## CLI Tool

```bash
# Replay a single learner trace
npm run replay:counterfactual --learner=learner-123 \
  --policy=aggressive --policy=conservative --policy=adaptive

# Batch replay all learners
npm run replay:batch --input=exports/weekly-demo \
  --policies=all --output=results/replay-analysis.json

# Generate comparison report
npm run replay:report --input=results/replay-analysis.json \
  --format=html --output=reports/policy-comparison.html
```

---

## Logging Schema

### Event: `replay_started`

```typescript
{
  eventType: 'replay_started',
  timestamp: number,
  replayId: string;
  learnerId: string;
  policies: string[];
  traceLength: number;
  traceTimeSpan: number;
}
```

### Event: `replay_decision_point`

```typescript
{
  eventType: 'replay_decision_point',
  timestamp: number,
  replayId: string;
  policy: string;
  decisionPoint: {
    timestamp: number;
    problemId: string;
    context: Context;
    policyDecision: string;
    actualDecision: string;
    matchesActual: boolean;
  }
}
```

### Event: `replay_completed`

```typescript
{
  eventType: 'replay_completed',
  timestamp: number,
  replayId: string;
  learnerId: string;
  results: {
    policy: string;
    metrics: {
      explanationsShown: number;
      avgEscalationDepth: number;
      simulatedHDI: number;
      simulatedCoverage: number;
      estimatedTimeToSuccess: number;
    };
    decisionPointCount: number;
    agreementWithActual: number;  // % of decisions matching actual
  }[];
}
```

---

## Research Applications

### Application 1: Policy Optimization

```typescript
// Find best policy across all learners
const allTraces = loadAllTraces();
const policies = [aggressivePolicy, conservativePolicy, adaptivePolicy];

const aggregateResults = policies.map(policy => {
  const results = allTraces.map(trace => replayTrace(trace, policy));
  
  return {
    policy: policy.name,
    avgExplanations: average(results.map(r => r.metrics.explanationsShown)),
    avgHDI: average(results.map(r => r.metrics.simulatedHDI)),
    avgCoverage: average(results.map(r => r.metrics.simulatedCoverage)),
    winRate: results.filter(r => r.winner === policy.name).length / results.length
  };
});

// Output: "Adaptive policy wins 65% of traces, with 20% lower HDI than aggressive"
```

### Application 2: Learner Type Matching

```typescript
// Which policy works best for each learner type?
const tracesByType = groupTracesByLearnerType(allTraces);

for (const [type, traces] of Object.entries(tracesByType)) {
  const results = policies.map(policy => ({
    policy: policy.name,
    avgScore: average(traces.map(t => replayTrace(t, policy).compositeScore))
  }));
  
  console.log(`${type} learners: Best policy is ${maxBy(results, 'avgScore').policy}`);
}

// Output:
// "Persistent misconception learners: Best policy is aggressive"
// "Rapid corrector learners: Best policy is conservative"
```

### Application 3: Threshold Tuning

```typescript
// Grid search over threshold values
const thresholdValues = [2, 3, 4, 5];
const results = [];

for (const threshold of thresholdValues) {
  const policy = createPolicyWithThreshold(threshold);
  const scores = allTraces.map(t => replayTrace(t, policy).compositeScore);
  results.push({ threshold, avgScore: average(scores) });
}

// Find optimal threshold
const optimal = maxBy(results, 'avgScore');
console.log(`Optimal escalation threshold: ${optimal.threshold}`);
```

---

## Limitations & Caveats

1. **Simulated Interactions**: We assume explanations help, but actual effect may vary
2. **Learner Adaptation**: Real learners might change behavior with different policies
3. **Context Loss**: Some context (frustration, fatigue) not captured in logs
4. **Multiple Policies**: Can only compare policies, not test novel interventions

---

## Implementation Roadmap

### Week 9: Core Replay
- [ ] Replay algorithm implementation
- [ ] Policy definitions
- [ ] Decision point reconstruction

### Week 10: Metrics & Analysis
- [ ] All 5 evaluation metrics
- [ ] Policy comparison reports
- [ ] CLI tool

### Week 11: Batch Processing
- [ ] Batch replay all traces
- [ ] Aggregate analysis
- [ ] Visualization

### Week 12: Publication
- [ ] Methodology documentation
- [ ] Results summary
- [ ] Claims validation
