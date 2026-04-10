# Cognitive Load Proxy (CSI)

**Component**: 12 of 17  
**Status**: 📋 Planned  
**Research Question**: Can we detect cognitive overload from interaction patterns?

---

## Problem

We don't have physiological sensors (pupillometry, EEG, GSR), but **behavior reveals strain**.

**Goal**: Infer cognitive load from interaction patterns to:
- Detect when learner is overloaded
- Speed up escalation when struggling
- Prevent frustration

---

## Cognitive Strain Indicators (CSI Components)

### Indicator 1: Rapid Re-submission Frequency

**Definition**: Submitting code within 5 seconds of previous submission.

**Proxy for**: Panic, guessing, not processing feedback

```typescript
function calculateRapidResubmissionRate(
  interactions: InteractionEvent[]
): number {
  const RAPID_THRESHOLD_MS = 5000;
  
  const submissions = interactions
    .filter(e => e.eventType === 'execution')
    .sort((a, b) => a.timestamp - b.timestamp);
  
  let rapidCount = 0;
  for (let i = 1; i < submissions.length; i++) {
    const timeDiff = submissions[i].timestamp - submissions[i-1].timestamp;
    if (timeDiff < RAPID_THRESHOLD_MS) {
      rapidCount++;
    }
  }
  
  return submissions.length > 1 
    ? rapidCount / (submissions.length - 1)
    : 0;
}

// Normalization: 0% rapid = 0.0, 50%+ rapid = 1.0
function normalizeRapidRate(rate: number): number {
  return Math.min(1.0, rate / 0.5);
}
```

**Interpretation**:
- < 0.2: Taking time to process
- 0.2-0.5: Some rushing
- > 0.5: Panic/guessing behavior

---

### Indicator 2: Short Interval Repeated Errors

**Definition**: Same error within 10 seconds.

**Proxy for**: Not reading/understanding error messages

```typescript
function calculateShortIntervalRepeatedErrors(
  interactions: InteractionEvent[]
): number {
  const SHORT_INTERVAL_MS = 10000;
  
  const errors = interactions
    .filter(e => e.eventType === 'error')
    .sort((a, b) => a.timestamp - b.timestamp);
  
  let repeatedCount = 0;
  for (let i = 1; i < errors.length; i++) {
    const timeDiff = errors[i].timestamp - errors[i-1].timestamp;
    const sameSubtype = errors[i].sqlEngageSubtype === errors[i-1].sqlEngageSubtype;
    
    if (timeDiff < SHORT_INTERVAL_MS && sameSubtype) {
      repeatedCount++;
    }
  }
  
  return errors.length > 1 
    ? repeatedCount / (errors.length - 1)
    : 0;
}

// Already normalized [0, 1]
```

**Interpretation**:
- < 0.2: Processing errors
- 0.2-0.5: Some repetition
- > 0.5: Not learning from errors

---

### Indicator 3: Long Pause Before Escalation

**Definition**: Time between error and requesting help > 30 seconds.

**Proxy for**: Hesitation, uncertainty, reluctance to ask

```typescript
function calculateLongPauseBeforeHelp(
  interactions: InteractionEvent[]
): number {
  const LONG_PAUSE_MS = 30000;
  
  let longPauses = 0;
  let totalHelpRequests = 0;
  
  for (let i = 0; i < interactions.length; i++) {
    if (interactions[i].eventType === 'hint_request' ||
        interactions[i].eventType === 'explanation_view') {
      totalHelpRequests++;
      
      // Find preceding error
      const precedingErrors = interactions
        .slice(0, i)
        .filter(e => e.eventType === 'error');
      
      if (precedingErrors.length > 0) {
        const lastError = precedingErrors[precedingErrors.length - 1];
        const pauseTime = interactions[i].timestamp - lastError.timestamp;
        
        if (pauseTime > LONG_PAUSE_MS) {
          longPauses++;
        }
      }
    }
  }
  
  return totalHelpRequests > 0 
    ? longPauses / totalHelpRequests
    : 0;
}

// Already normalized [0, 1]
```

**Interpretation**:
- < 0.2: Confident in asking for help
- 0.2-0.5: Some hesitation
- > 0.5: Reluctant to seek help (or working independently)

---

### Indicator 4: Burst Error Clusters

**Definition**: 3+ errors within 60 seconds.

**Proxy for**: Cognitive overload, confusion

```typescript
function calculateBurstErrorClusters(
  interactions: InteractionEvent[]
): number {
  const BURST_WINDOW_MS = 60000;
  const BURST_THRESHOLD = 3;
  
  const errors = interactions
    .filter(e => e.eventType === 'error')
    .sort((a, b) => a.timestamp - b.timestamp);
  
  let burstCount = 0;
  
  for (let i = 0; i < errors.length; i++) {
    const windowEnd = errors[i].timestamp + BURST_WINDOW_MS;
    const errorsInWindow = errors.filter(
      e => e.timestamp >= errors[i].timestamp && e.timestamp <= windowEnd
    ).length;
    
    if (errorsInWindow >= BURST_THRESHOLD) {
      burstCount++;
    }
  }
  
  // Normalize: 0 bursts = 0.0, 3+ bursts = 1.0
  return Math.min(1.0, burstCount / 3);
}
```

**Interpretation**:
- 0.0: Steady pace
- 0.3-0.6: Some clustering
- 1.0: Multiple overload episodes

---

### Indicator 5: High Escalation Density

**Definition**: > 2 escalations per problem.

**Proxy for**: Can't recover independently

```typescript
function calculateEscalationDensity(
  interactions: InteractionEvent[]
): number {
  const problems = groupBy(interactions, 'problemId');
  
  let highDensityCount = 0;
  for (const [problemId, events] of Object.entries(problems)) {
    const escalations = events.filter(
      e => e.eventType === 'guidance_escalate'
    ).length;
    
    if (escalations > 2) {
      highDensityCount++;
    }
  }
  
  return Object.keys(problems).length > 0
    ? highDensityCount / Object.keys(problems).length
    : 0;
}

// Already normalized [0, 1]
```

**Interpretation**:
- < 0.2: Independent problem solving
- 0.2-0.5: Needs some support
- > 0.5: Heavy reliance on scaffolding

---

## Cognitive Strain Index (CSI) Formula

```typescript
interface CSIWeights {
  rapidResubmission: number;
  shortIntervalErrors: number;
  longPauseBeforeHelp: number;
  burstErrorClusters: number;
  escalationDensity: number;
}

const DEFAULT_CSI_WEIGHTS: CSIWeights = {
  rapidResubmission: 0.25,
  shortIntervalErrors: 0.25,
  longPauseBeforeHelp: 0.15,
  burstErrorClusters: 0.20,
  escalationDensity: 0.15
};

function calculateCSI(
  interactions: InteractionEvent[],
  weights: CSIWeights = DEFAULT_CSI_WEIGHTS
): number {
  const rapid = normalizeRapidRate(
    calculateRapidResubmissionRate(interactions)
  );
  
  const shortInterval = calculateShortIntervalRepeatedErrors(interactions);
  
  const longPause = calculateLongPauseBeforeHelp(interactions);
  
  const burst = calculateBurstErrorClusters(interactions);
  
  const escalation = calculateEscalationDensity(interactions);
  
  const csi = 
    weights.rapidResubmission * rapid +
    weights.shortIntervalErrors * shortInterval +
    weights.longPauseBeforeHelp * longPause +
    weights.burstErrorClusters * burst +
    weights.escalationDensity * escalation;
  
  return Math.max(0, Math.min(1, csi));
}
```

---

## CSI Thresholds & Adaptive Responses

| CSI Level | Range | System Response |
|-----------|-------|-----------------|
| **Low** | 0.0 - 0.3 | Normal pacing |
| **Medium** | 0.4 - 0.6 | Faster escalation, encouragement |
| **High** | 0.7 - 1.0 | Immediate intervention |

### Adaptive Escalation Based on CSI

```typescript
function getAdaptiveEscalationThreshold(
  baseThreshold: number,
  csi: number
): number {
  // Higher CSI → Lower threshold (faster escalation)
  if (csi > 0.7) {
    return Math.max(2, baseThreshold - 2);  // Speed up significantly
  } else if (csi > 0.4) {
    return Math.max(2, baseThreshold - 1);  // Speed up moderately
  }
  return baseThreshold;  // Normal pacing
}

// Example usage
const baseThreshold = 3;
const currentCSI = calculateCSI(recentInteractions);
const adjustedThreshold = getAdaptiveEscalationThreshold(baseThreshold, currentCSI);
// CSI = 0.8 → threshold = 1 (very fast escalation)
// CSI = 0.5 → threshold = 2 (moderate speed)
// CSI = 0.2 → threshold = 3 (normal)
```

### High CSI Interventions

```typescript
function handleHighCSI(
  learnerId: string,
  csi: number
): void {
  if (csi > 0.8) {
    // Immediate help
    triggerImmediateExplanation(learnerId);
    showMessage(learnerId, 
      "It looks like this is challenging. Here's a detailed explanation.");
  } else if (csi > 0.6) {
    // Speed up escalation
    enableFastEscalation(learnerId);
    showMessage(learnerId,
      "You're working hard! Don't hesitate to ask for help if you need it.");
  }
  
  logEvent({
    eventType: 'csi_intervention_triggered',
    learnerId,
    csi,
    interventionType: csi > 0.8 ? 'immediate_help' : 'fast_escalation'
  });
}
```

---

## Integration with Affective Proxy (APS)

CSI and Affective Proxy Score (APS) are related but distinct:

| Aspect | CSI | APS |
|--------|-----|-----|
| **Measures** | Cognitive overload | Frustration/disengagement |
| **Indicators** | Rapid errors, bursts | Repeated identical errors, switching |
| **Response** | Speed up help | Change strategy |
| **Overlap** | High CSI often → High APS | |

**Combined Decision**:
```typescript
function getCombinedIntervention(
  csi: number,
  aps: number
): Intervention {
  if (csi > 0.7 && aps > 0.7) {
    return { type: 'immediate_comprehensive_help' };
  } else if (csi > 0.7) {
    return { type: 'speed_up_escalation' };
  } else if (aps > 0.7) {
    return { type: 'change_strategy' };
  }
  return { type: 'none' };
}
```

---

## Logging Schema

### Event: `csi_calculated`

```typescript
{
  eventType: 'csi_calculated',
  timestamp: number,
  learnerId: string,
  csi: number,  // 0-1
  level: 'low' | 'medium' | 'high',
  components: {
    rapidResubmission: number;
    shortIntervalErrors: number;
    longPauseBeforeHelp: number;
    burstErrorClusters: number;
    escalationDensity: number;
  },
  calculationWindow: {
    startTime: number;
    endTime: number;
    eventCount: number;
  }
}
```

### Event: `csi_escalation_adjusted`

```typescript
{
  eventType: 'csi_escalation_adjusted',
  timestamp: number,
  learnerId: string,
  csi: number,
  baseThreshold: number,
  adjustedThreshold: number,
  reason: string;
}
```

---

## Analysis Queries

### CSI vs learning outcomes

```javascript
db.events.aggregate([
  { $match: { eventType: 'csi_calculated' } },
  { $lookup: {
    from: 'sessions',
    localField: 'learnerId',
    foreignField: 'learnerId',
    as: 'session'
  }},
  { $group: {
    _id: { 
      csiLevel: { 
        $cond: [
          { $gte: ['$csi', 0.7] }, 'high',
          { $cond: [{ $gte: ['$csi', 0.4] }, 'medium', 'low'] }
        ]
      }
    },
    avgCompletionRate: { $avg: '$session.completionRate' },
    avgTimeToSuccess: { $avg: '$session.timeToSuccess' },
    count: { $sum: 1 }
  }}
]);
```

### Does CSI predict escalation need?

```javascript
// Does high CSI correlate with needing explanation?
db.events.aggregate([
  { $match: { eventType: 'csi_calculated' } },
  { $lookup: {
    from: 'events',
    let: { learnerId: '$learnerId', csiTime: '$timestamp' },
    pipeline: [
      { $match: {
        $expr: {
          $and: [
            { $eq: ['$learnerId', '$$learnerId'] },
            { $eq: ['$eventType', 'explanation_view'] },
            { $gt: ['$timestamp', '$$csiTime'] },
            { $lt: [{ $subtract: ['$timestamp', '$$csiTime'] }, 60000] }
          ]
        }
      }}
    ],
    as: 'subsequentExplanation'
  }},
  { $project: {
    csi: 1,
    neededExplanation: { $gt: [{ $size: '$subsequentExplanation' }, 0] }
  }},
  { $group: {
    _id: { $gte: ['$csi', 0.7] },
    explanationRate: { $avg: { $cond: ['$neededExplanation', 1, 0] } }
  }}
]);
```

---

## Research Questions

1. **Does high CSI predict explanation need?**
   - Test: CSI > 0.7 → explanation within 1 minute?

2. **Does adaptive pacing based on CSI improve outcomes?**
   - Compare: Fixed threshold vs CSI-adjusted threshold

3. **What is the optimal CSI threshold for intervention?**
   - Balance: Helping vs creating dependency

4. **Do CSI patterns vary by concept difficulty?**
   - Advanced concepts → higher baseline CSI?

---

## Implementation Roadmap

### Week 7: Core CSI
- [ ] Implement all 5 indicators
- [ ] CSI calculation function
- [ ] Threshold-based interventions

### Week 8: Integration
- [ ] Connect to escalation policy
- [ ] Real-time CSI monitoring
- [ ] Dashboard visualization

### Week 9: Validation
- [ ] Correlation with outcomes
- [ ] Threshold optimization
- [ ] A/B test adaptive vs fixed
