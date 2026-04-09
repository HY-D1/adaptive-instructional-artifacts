# Concept Graph & Mastery Propagation

**Component**: 14 of 17  
**Status**: 📋 Planned  
**Research Question**: How do prerequisite relationships affect learning?

---

## Problem

Current concept coverage is **flat**—each concept has an independent score. But knowledge is **structured**:

```
SELECT → WHERE → GROUP_BY → HAVING
  ↓        ↓         ↓
  JOIN → Subqueries → CTE
```

If a learner struggles with WHERE, they probably won't master GROUP_BY.

**Goal**: Model concept dependencies and use them to guide learning.

---

## Concept Dependency Graph (DAG)

### Node Definition

```typescript
interface ConceptNode {
  id: string;
  name: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];  // Concept IDs that must come first
  successors: string[];     // Concepts that depend on this
  estimatedMasteryTime: number;  // Minutes
}
```

### Edge Definition

```typescript
interface ConceptEdge {
  from: string;     // Prerequisite
  to: string;       // Dependent concept
  strength: number; // 0-1, how critical is the prerequisite?
  type: 'hard' | 'soft';  // Hard = must master, Soft = helpful
}
```

### SQL Concept Graph

```typescript
const SQL_CONCEPT_GRAPH: ConceptNode[] = [
  // Level 1: Foundations
  {
    id: 'select-basic',
    name: 'Basic SELECT',
    difficulty: 'beginner',
    prerequisites: [],
    successors: ['where-clause', 'order-by', 'distinct', 'alias'],
    estimatedMasteryTime: 15
  },
  {
    id: 'where-clause',
    name: 'WHERE Clause',
    difficulty: 'beginner',
    prerequisites: ['select-basic'],
    successors: ['joins', 'aggregation', 'subqueries'],
    estimatedMasteryTime: 20
  },
  
  // Level 2: Intermediate
  {
    id: 'joins',
    name: 'JOIN Operations',
    difficulty: 'intermediate',
    prerequisites: ['where-clause'],
    successors: ['subqueries', 'self-join', 'outer-join'],
    estimatedMasteryTime: 30
  },
  {
    id: 'aggregation',
    name: 'Aggregate Functions',
    difficulty: 'intermediate',
    prerequisites: ['where-clause'],
    successors: ['group-by', 'having-clause'],
    estimatedMasteryTime: 25
  },
  
  // Level 3: Advanced
  {
    id: 'group-by',
    name: 'GROUP BY',
    difficulty: 'intermediate',
    prerequisites: ['aggregation'],
    successors: ['having-clause', 'window-functions'],
    estimatedMasteryTime: 30
  },
  {
    id: 'subqueries',
    name: 'Subqueries',
    difficulty: 'advanced',
    prerequisites: ['joins', 'where-clause'],
    successors: ['correlated-subquery', 'cte'],
    estimatedMasteryTime: 35
  },
  
  // Level 4: Expert
  {
    id: 'window-functions',
    name: 'Window Functions',
    difficulty: 'advanced',
    prerequisites: ['group-by'],
    successors: [],
    estimatedMasteryTime: 40
  },
  {
    id: 'cte',
    name: 'Common Table Expressions',
    difficulty: 'advanced',
    prerequisites: ['subqueries'],
    successors: ['recursive-cte'],
    estimatedMasteryTime: 30
  }
];

const SQL_CONCEPT_EDGES: ConceptEdge[] = [
  { from: 'select-basic', to: 'where-clause', strength: 1.0, type: 'hard' },
  { from: 'where-clause', to: 'joins', strength: 0.9, type: 'hard' },
  { from: 'where-clause', to: 'aggregation', strength: 0.7, type: 'soft' },
  { from: 'aggregation', to: 'group-by', strength: 1.0, type: 'hard' },
  { from: 'group-by', to: 'having-clause', strength: 0.9, type: 'hard' },
  { from: 'joins', to: 'subqueries', strength: 0.8, type: 'soft' },
  { from: 'subqueries', to: 'cte', strength: 0.9, type: 'hard' }
];
```

### Visual Representation

```
[select-basic]
     ↓
[where-clause] ───────┐
     ↓                ↓
 [joins] ←────── [aggregation]
     ↓                ↓
[subqueries]      [group-by]
     ↓                ↓
   [cte]         [window-funcs]
```

---

## Mastery Propagation

### Current Mastery Score

```typescript
interface ConceptMastery {
  conceptId: string;
  score: number;        // 0-100 cumulative
  confidence: 'low' | 'medium' | 'high';
  lastUpdated: number;
}
```

### Propagation Rule

If learner has low mastery in prerequisite, **reduce confidence** in dependent concepts.

```typescript
function propagateMastery(
  masteryScores: Map<string, ConceptMastery>,
  conceptGraph: ConceptGraph
): Map<string, ConceptMastery> {
  const propagated = new Map(masteryScores);
  
  // Topological sort (prerequisites first)
  const sortedConcepts = topologicalSort(conceptGraph);
  
  for (const conceptId of sortedConcepts) {
    const concept = conceptGraph.getNode(conceptId);
    const currentMastery = propagated.get(conceptId);
    
    // Check prerequisites
    let minPrerequisiteMastery = 100;
    for (const prereqId of concept.prerequisites) {
      const prereqMastery = propagated.get(prereqId);
      if (prereqMastery) {
        minPrerequisiteMastery = Math.min(
          minPrerequisiteMastery,
          prereqMastery.score
        );
      }
    }
    
    // If prerequisites weak, reduce confidence
    if (minPrerequisiteMastery < 50) {
      const adjustedScore = Math.min(
        currentMastery?.score || 0,
        minPrerequisiteMastery + 20  // Cap at prereq + 20
      );
      
      propagated.set(conceptId, {
        ...currentMastery,
        score: adjustedScore,
        confidence: 'low',
        propagationNote: `Capped by prerequisite mastery: ${minPrerequisiteMastery}`
      });
    }
  }
  
  return propagated;
}
```

### Example Propagation

```
Initial scores:
  select-basic: 90 (high)
  where-clause: 85 (high)
  joins: 30 (low)
  group-by: 60 (medium)

After propagation:
  select-basic: 90 (high)
  where-clause: 85 (high)
  joins: 30 (low) [no change, but blocks subqueries]
  group-by: 50 (low) [capped: joins is weak prerequisite]
  subqueries: 20 (low) [capped: both joins and where weak]
```

---

## Blocked Node Detection

Detect when learner is struggling on advanced concept but hasn't mastered prerequisites.

```typescript
interface BlockedNode {
  conceptId: string;
  learnerMastery: number;
  requiredPrerequisite: string;
  prerequisiteMastery: number;
  gap: number;  // How far from threshold
  recommendation: string;
}

function detectBlockedNodes(
  learnerHistory: LearnerHistory,
  conceptGraph: ConceptGraph
): BlockedNode[] {
  const blocked: BlockedNode[] = [];
  const masteryScores = calculateMasteryScores(learnerHistory);
  
  for (const [conceptId, mastery] of masteryScores) {
    // Check if struggling on this concept
    if (mastery.score < 40 && mastery.confidence === 'low') {
      const concept = conceptGraph.getNode(conceptId);
      
      // Find weak prerequisites
      for (const prereqId of concept.prerequisites) {
        const prereqMastery = masteryScores.get(prereqId);
        
        if (!prereqMastery || prereqMastery.score < 60) {
          blocked.push({
            conceptId,
            learnerMastery: mastery.score,
            requiredPrerequisite: prereqId,
            prerequisiteMastery: prereqMastery?.score || 0,
            gap: 60 - (prereqMastery?.score || 0),
            recommendation: `Review ${prereqId} before continuing with ${conceptId}`
          });
        }
      }
    }
  }
  
  return blocked.sort((a, b) => b.gap - a.gap);  // Biggest gaps first
}
```

### Intervention

```typescript
function handleBlockedNode(
  learnerId: string,
  blocked: BlockedNode
): void {
  // Log the violation
  logEvent({
    eventType: 'prerequisite_violation_detected',
    learnerId,
    conceptId: blocked.conceptId,
    requiredPrerequisite: blocked.requiredPrerequisite,
    gap: blocked.gap
  });
  
  // Recommend prerequisite review
  showNotification(learnerId, {
    title: 'Prerequisite Review Recommended',
    message: blocked.recommendation,
    action: {
      label: 'Review Prerequisite',
      handler: () => navigateToConcept(blocked.requiredPrerequisite)
    }
  });
  
  // Temporarily block advanced problems
  temporarilyBlockConcept(learnerId, blocked.conceptId);
}
```

---

## Learning Path Recommendation

### Optimal Path Calculation

```typescript
function recommendLearningPath(
  learnerHistory: LearnerHistory,
  conceptGraph: ConceptGraph,
  targetConcept: string
): string[] {
  const masteryScores = calculateMasteryScores(learnerHistory);
  
  // Find all prerequisites of target
  const prerequisites = getAllPrerequisites(conceptGraph, targetConcept);
  
  // Filter to those not yet mastered
  const neededPrerequisites = prerequisites.filter(
    p => (masteryScores.get(p)?.score || 0) < 70
  );
  
  // Sort by:
  // 1. Direct prerequisites first
  // 2. Estimated mastery time (shorter first)
  // 3. Current mastery (lower first - biggest gap)
  
  return neededPrerequisites.sort((a, b) => {
    const aDirect = conceptGraph.getNode(targetConcept).prerequisites.includes(a);
    const bDirect = conceptGraph.getNode(targetConcept).prerequisites.includes(b);
    
    if (aDirect && !bDirect) return -1;
    if (!aDirect && bDirect) return 1;
    
    const aTime = conceptGraph.getNode(a).estimatedMasteryTime;
    const bTime = conceptGraph.getNode(b).estimatedMasteryTime;
    return aTime - bTime;
  });
}

// Example
const path = recommendLearningPath(learner, graph, 'window-functions');
// Returns: ['group-by', 'aggregation'] (if not mastered)
```

---

## Logging Schema

### Event: `mastery_propagated`

```typescript
{
  eventType: 'mastery_propagated',
  timestamp: number,
  learnerId: string,
  conceptId: string,
  originalScore: number,
  propagatedScore: number,
  reason: string,
  limitingPrerequisite?: string
}
```

### Event: `prerequisite_violation_detected`

```typescript
{
  eventType: 'prerequisite_violation_detected',
  timestamp: number,
  learnerId: string,
  conceptId: string,
  requiredPrerequisite: string,
  learnerMastery: number,
  prerequisiteMastery: number,
  gap: number,
  interventionTriggered: boolean
}
```

### Event: `learning_path_recommended`

```typescript
{
  eventType: 'learning_path_recommended',
  timestamp: number,
  learnerId: string,
  targetConcept: string,
  recommendedPath: string[],
  currentMastery: Record<string, number>,
  estimatedTimeMinutes: number
}
```

---

## Analysis Queries

### Prerequisite effectiveness

```javascript
// Do learners with strong prerequisites learn faster?
db.events.aggregate([
  { $match: { eventType: 'prerequisite_violation_detected' } },
  { $lookup: {
    from: 'events',
    localField: 'learnerId',
    foreignField: 'learnerId',
    as: 'subsequentProgress'
  }},
  { $project: {
    gap: '$gap',
    timeToMaster: {
      $subtract: [
        { $min: '$subsequentProgress.timestamp' },
        '$timestamp'
      ]
    }
  }},
  { $group: {
    _id: { $gte: ['$gap', 30] },  // Big gap vs small gap
    avgTimeToMaster: { $avg: '$timeToMaster' }
  }}
]);
```

### Concept graph coverage

```javascript
// Which concepts are most commonly blocked?
db.events.aggregate([
  { $match: { eventType: 'prerequisite_violation_detected' } },
  { $group: {
    _id: '$conceptId',
    violationCount: { $sum: 1 },
    avgGap: { $avg: '$gap' }
  }},
  { $sort: { violationCount: -1 } }
]);
```

---

## Integration with Other Components

| Component | Integration |
|-----------|-------------|
| Adaptive Orchestration | Check prerequisites before escalating |
| Automatic Textbook | Organize notes by concept hierarchy |
| Error Trajectory | Blocked nodes explain persistent errors |
| Research Dashboard | Visualize concept graph coverage |

---

## Research Questions

1. **Does prerequisite mastery predict success?**
   - Test: Compare learners with/without strong prerequisites

2. **Should we enforce prerequisite order?**
   - A/B: Blocked vs free navigation

3. **What is the optimal concept graph?**
   - Validate edge strengths empirically

4. **Do different learner types need different paths?**
   - Rapid correctors vs persistent misconceptions

---

## Implementation Roadmap

### Week 9: Graph Structure
- [ ] Define concept nodes and edges
- [ ] Graph validation (acyclic check)
- [ ] Prerequisite lookup functions

### Week 10: Propagation & Detection
- [ ] Mastery propagation algorithm
- [ ] Blocked node detection
- [ ] Learning path recommendation

### Week 11: Integration
- [ ] Connect to orchestration
- [ ] UI for concept graph
- [ ] Prerequisite warnings

### Week 12: Validation
- [ ] Correlation with outcomes
- [ ] Graph refinement
- [ ] Publication analysis
