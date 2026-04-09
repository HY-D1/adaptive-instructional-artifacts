# Error Trajectory Modeling

**Component**: 11 of 17  
**Status**: 📋 Planned  
**Research Question**: What error sequences predict mastery vs struggle?

---

## Problem

Current system tracks error counts, not error **sequences**. But learning is dynamic:

```
Learner A: SELECT_error → SELECT_error → SELECT_error (stuck)
Learner B: SELECT_error → WHERE_error → JOIN_error (progressing)
Learner C: JOIN_error → JOIN_error → GROUP_error → JOIN_error (oscillating)
```

**Goal**: Model error trajectories to predict learning outcomes and personalize intervention.

---

## Error Transition Graph

### Building the Graph

```typescript
interface ErrorTransitionGraph {
  nodes: string[];  // Error subtypes
  edges: Map<string, Map<string, number>>;  // from -> to -> count
  transitionProbabilities: Map<string, Map<string, number>>;
}

function buildTransitionGraph(
  interactions: InteractionEvent[]
): ErrorTransitionGraph {
  const graph: ErrorTransitionGraph = {
    nodes: [],
    edges: new Map(),
    transitionProbabilities: new Map()
  };
  
  // Extract error sequence
  const errors = interactions
    .filter(e => e.eventType === 'error')
    .map(e => e.sqlEngageSubtype || e.errorSubtypeId)
    .filter(Boolean);
  
  // Build edges
  for (let i = 0; i < errors.length - 1; i++) {
    const from = errors[i];
    const to = errors[i + 1];
    
    if (!graph.edges.has(from)) {
      graph.edges.set(from, new Map());
    }
    
    const fromEdges = graph.edges.get(from);
    fromEdges.set(to, (fromEdges.get(to) || 0) + 1);
  }
  
  // Calculate probabilities
  for (const [from, toMap] of graph.edges) {
    const total = Array.from(toMap.values()).reduce((a, b) => a + b, 0);
    graph.transitionProbabilities.set(from, new Map());
    
    for (const [to, count] of toMap) {
      graph.transitionProbabilities.get(from).set(to, count / total);
    }
  }
  
  graph.nodes = [...new Set(errors)];
  return graph;
}
```

### Example Transition Matrix

```
              TO →
FROM ↓        incomplete  select_usage  join_missing  group_misuse
incomplete        0.3          0.4           0.1           0.2
select_usage      0.1          0.2           0.5           0.2
join_missing      0.2          0.1           0.4           0.3
group_misuse      0.1          0.2           0.3           0.4
```

**Interpretation**: High diagonal = persistence (same error repeats). High off-diagonal = progression or oscillation.

---

## Persistence Score

### Definition

Average consecutive occurrences of the same error subtype.

```typescript
function calculatePersistenceScore(
  interactions: InteractionEvent[]
): number {
  const errors = interactions
    .filter(e => e.eventType === 'error')
    .map(e => e.sqlEngageSubtype || e.errorSubtypeId);
  
  let totalConsecutive = 0;
  let streakCount = 0;
  let currentStreak = 1;
  
  for (let i = 1; i < errors.length; i++) {
    if (errors[i] === errors[i - 1]) {
      currentStreak++;
    } else {
      totalConsecutive += currentStreak;
      streakCount++;
      currentStreak = 1;
    }
  }
  
  // Don't forget last streak
  totalConsecutive += currentStreak;
  streakCount++;
  
  return streakCount > 0 ? totalConsecutive / streakCount : 0;
}

// Normalization
// 1.0 = no persistence (always different errors)
// 3.0+ = high persistence (stuck on same error)
function normalizePersistence(score: number): number {
  return Math.min(1.0, (score - 1) / 2);
}
```

**Interpretation**:
- Persistence < 0.3: Low persistence (exploring different errors)
- Persistence 0.3-0.7: Moderate persistence (some stuck patterns)
- Persistence > 0.7: High persistence (stuck on specific concept)

---

## Escalation Path Patterns

### Metric: Escalations Before Correction

```typescript
function analyzeEscalationPath(
  interactions: InteractionEvent[],
  problemId: string
): {
  maxRungReached: number;
  escalationsBeforeSuccess: number;
  explanationFrequency: number;
  path: Array<{ from: number; to: number; trigger: string }>;
} {
  const problemEvents = interactions.filter(e => e.problemId === problemId);
  
  const escalations = problemEvents
    .filter(e => e.eventType === 'guidance_escalate');
  
  const success = problemEvents
    .filter(e => e.eventType === 'execution' && e.successful)
    .length > 0;
  
  const explanations = problemEvents
    .filter(e => e.eventType === 'explanation_view')
    .length;
  
  return {
    maxRungReached: Math.max(...escalations.map(e => e.toRung), 1),
    escalationsBeforeSuccess: success ? escalations.length : -1,
    explanationFrequency: explanations,
    path: escalations.map(e => ({
      from: e.fromRung,
      to: e.toRung,
      trigger: e.trigger
    }))
  };
}
```

### Pattern Types

| Pattern | Description | Interpretation |
|---------|-------------|----------------|
| **L1→L2→success** | Quick escalation, then success | Responsive to hints |
| **L1→L1→L1→L2→L3** | Slow progression through ladder | Needs more support |
| **L1→L3 (skip)** | Rapid escalation | High struggle or impatience |
| **L3→explanation→success** | Needs full explanation | Concept gap |
| **L3→explanation→error** | Explanation didn't help | Deeper issue |

---

## Learner Typology Clustering

### Cluster 1: Persistent Misconception

**Signature**:
- High persistence score (> 0.7)
- Same error subtype 3+ times consecutively
- High escalation before success

**Example Pattern**:
```
JOIN_missing → JOIN_missing → JOIN_missing → explanation → JOIN_missing
```

**Intervention**: Targeted concept review, prerequisite check

---

### Cluster 2: Rapid Corrector

**Signature**:
- Low persistence score (< 0.3)
- Few repeated subtypes
- Low escalation before success

**Example Pattern**:
```
SELECT_error → WHERE_error → JOIN_error → success
```

**Intervention**: Continue current approach, offer challenges

---

### Cluster 3: Oscillatory Behavior

**Signature**:
- Medium persistence (0.3-0.7)
- Cycling between 2-3 error types
- Multiple escalations

**Example Pattern**:
```
JOIN_missing → GROUP_misuse → JOIN_missing → GROUP_misuse → ...
```

**Intervention**: Stabilize with focused practice, break the cycle

---

### Cluster 4: Avoidance Pattern

**Signature**:
- Short error sequences
- Problem switching after 1-2 errors
- Low escalation (abandons before help)

**Example Pattern**:
```
JOIN_missing → [switch problem] → SELECT_error → [switch problem]
```

**Intervention**: Encourage persistence, reduce problem switching

---

## Implementation

### Error Trajectory Analyzer

```typescript
class ErrorTrajectoryAnalyzer {
  analyze(
    learnerHistory: LearnerHistory,
    windowSize: number = 10  // Last N errors
  ): TrajectoryAnalysis {
    const recentErrors = learnerHistory.events
      .filter(e => e.eventType === 'error')
      .slice(-windowSize);
    
    return {
      transitionGraph: buildTransitionGraph(recentErrors),
      persistenceScore: calculatePersistenceScore(recentErrors),
      dominantPattern: this.identifyPattern(recentErrors),
      learnerType: this.classifyLearner(recentErrors),
      recommendedIntervention: this.recommendIntervention(recentErrors)
    };
  }
  
  private identifyPattern(errors: InteractionEvent[]): string {
    const subtypes = errors.map(e => e.sqlEngageSubtype);
    
    // Check for persistence
    if (this.isPersistent(subtypes)) return 'persistent';
    
    // Check for oscillation
    if (this.isOscillatory(subtypes)) return 'oscillatory';
    
    // Check for progression
    if (this.isProgressive(subtypes)) return 'progressive';
    
    return 'mixed';
  }
  
  private classifyLearner(errors: InteractionEvent[]): LearnerType {
    const persistence = calculatePersistenceScore(errors);
    
    if (persistence > 0.7) return 'persistent_misconception';
    if (persistence < 0.3) return 'rapid_corrector';
    if (this.isOscillatory(errors)) return 'oscillatory';
    if (this.isAvoidance(errors)) return 'avoidance';
    
    return 'typical';
  }
  
  private recommendIntervention(errors: InteractionEvent[]): Intervention {
    const type = this.classifyLearner(errors);
    
    switch (type) {
      case 'persistent_misconception':
        return {
          type: 'targeted_review',
          conceptId: this.getMostCommonError(errors),
          message: 'Let\'s review the fundamentals of this concept.'
        };
        
      case 'oscillatory':
        return {
          type: 'focused_practice',
          conceptId: this.getCycleConcepts(errors),
          message: 'Let\'s practice this pattern until it sticks.'
        };
        
      case 'avoidance':
        return {
          type: 'persistence_encouragement',
          message: 'You\'re close! Try one more time before moving on.'
        };
        
      default:
        return { type: 'none' };
    }
  }
}
```

---

## Logging Schema

### Event: `error_trajectory_analyzed`

```typescript
{
  eventType: 'error_trajectory_analyzed',
  timestamp: number,
  learnerId: string,
  windowSize: number,
  analysis: {
    persistenceScore: number,
    dominantPattern: string,
    learnerType: string,
    topTransitions: Array<{
      from: string;
      to: string;
      probability: number;
    }>,
    mostCommonError: string
  },
  recommendedIntervention?: {
    type: string;
    conceptId?: string;
    message?: string;
  }
}
```

### Event: `learner_type_reclassified`

```typescript
{
  eventType: 'learner_type_reclassified',
  timestamp: number,
  learnerId: string,
  previousType: string;
  newType: string;
  triggerEvents: string[];  // Event IDs that triggered reclassification
  confidence: number;  // 0-1 based on sample size
}
```

---

## Visualization

### Error Transition Graph

```
[incomplete_query] ←──────┐
      ↓                   │
[select_usage] ──→ [join_missing] ←──────┐
      ↓                   ↓              │
[where_clause] ←── [group_misuse] ───────┘
```

**Arrow thickness** = transition probability

### Learner Trajectory Timeline

```
Time →
Problem 1:  Error ──→ Hint ──→ Error ──→ Escalate ──→ Success
Subtype:   JOIN        JOIN      JOIN        L2→L3        ✓

Problem 2:  Error ──→ Hint ──→ Success
Subtype:   WHERE       WHERE       ✓

Problem 3:  Error ──→ Hint ──→ Error ──→ Error ──→ Escalate
Subtype:   GROUP       GROUP      GROUP      GROUP       L3
```

---

## Analysis Queries

### Transition probabilities by learner type

```javascript
db.events.aggregate([
  { $match: { eventType: 'error_trajectory_analyzed' } },
  { $unwind: '$analysis.topTransitions' },
  { $group: {
    _id: { 
      learnerType: '$analysis.learnerType',
      from: '$analysis.topTransitions.from',
      to: '$analysis.topTransitions.to'
    },
    avgProbability: { $avg: '$analysis.topTransitions.probability' },
    count: { $sum: 1 }
  }}
]);
```

### Predict success from trajectory

```javascript
// Do early trajectory patterns predict final success?
db.events.aggregate([
  { $match: { eventType: 'error_trajectory_analyzed' } },
  { $lookup: {
    from: 'sessions',
    localField: 'learnerId',
    foreignField: 'learnerId',
    as: 'session'
  }},
  { $project: {
    persistenceScore: '$analysis.persistenceScore',
    learnerType: '$analysis.learnerType',
    finalSuccess: '$session.successful'
  }},
  { $group: {
    _id: '$learnerType',
    successRate: { $avg: { $cond: ['$finalSuccess', 1, 0] } },
    avgPersistence: { $avg: '$persistenceScore' }
  }}
]);
```

---

## Research Questions

1. **Which error sequences predict mastery?**
   - Progressive patterns vs persistent patterns

2. **Can we detect struggling learners early?**
   - How many errors needed to classify learner type?

3. **Do interventions change trajectories?**
   - Does targeted review reduce persistence?

4. **Are trajectories concept-specific?**
   - Different patterns for JOIN vs GROUP BY?

---

## Implementation Roadmap

### Week 8: Core Analysis
- [ ] Transition graph builder
- [ ] Persistence score calculator
- [ ] Pattern identification

### Week 9: Classification
- [ ] Learner typology clustering
- [ ] Intervention recommendations
- [ ] Real-time analysis

### Week 10: Validation
- [ ] Predictive accuracy testing
- [ ] Intervention effectiveness
- [ ] Dashboard visualizations
