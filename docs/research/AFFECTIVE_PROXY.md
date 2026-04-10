# Affective Proxy Layer (APS)

**Component**: 17 of 17  
**Status**: 📋 Planned  
**Research Question**: Can we detect frustration from behavior patterns?

---

## Problem

We don't have physiological sensors (GSR, facial recognition, EEG), but **behavior reveals affect**.

**Goal**: Infer frustration/disengagement from interaction patterns to:
- Detect when learner is struggling emotionally
- Adjust pacing to prevent dropout
- Trigger encouragement or intervention

---

## Affective Proxy Signals

### Signal 1: Repeated Identical Errors

**Definition**: Same error code submitted 3+ times consecutively.

**Proxy for**: Confusion, not understanding feedback

```typescript
function calculateRepeatedIdenticalErrors(
  interactions: InteractionEvent[]
): number {
  const errors = interactions
    .filter(e => e.eventType === 'error')
    .map(e => ({ subtype: e.sqlEngageSubtype, code: e.code }));
  
  let maxStreak = 0;
  let currentStreak = 1;
  
  for (let i = 1; i < errors.length; i++) {
    if (errors[i].subtype === errors[i-1].subtype &&
        errors[i].code === errors[i-1].code) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  // Normalize: 0 repeats = 0.0, 5+ repeats = 1.0
  return Math.min(1.0, maxStreak / 5);
}
```

**Interpretation**:
- < 0.3: Processing feedback
- 0.3-0.6: Some confusion
- > 0.6: Frustration likely

---

### Signal 2: Rapid Escalation to L3

**Definition**: Reach L3 (highest hint) within 2 minutes.

**Proxy for**: Giving up, not engaging with hints

```typescript
function calculateRapidEscalationToL3(
  interactions: InteractionEvent[]
): number {
  const RAPID_THRESHOLD_MS = 2 * 60 * 1000;
  
  const l3Events = interactions
    .filter(e => e.eventType === 'guidance_escalate' && e.toRung === 3);
  
  if (l3Events.length === 0) return 0;
  
  // Find time to reach L3 for each problem
  const rapidCount = l3Events.filter(e => {
    const problemStart = interactions
      .filter(i => i.problemId === e.problemId)
      .sort((a, b) => a.timestamp - b.timestamp)[0]?.timestamp;
    
    return problemStart && (e.timestamp - problemStart) < RAPID_THRESHOLD_MS;
  }).length;
  
  return rapidCount / l3Events.length;
}

// Already normalized [0, 1]
```

---

### Signal 3: Rapid Problem Switching

**Definition**: Skip problem after 1-2 errors.

**Proxy for**: Avoidance, frustration, giving up

```typescript
function calculateProblemSwitchingRate(
  interactions: InteractionEvent[]
): number {
  const problems = groupBy(interactions, 'problemId');
  
  let switchedEarlyCount = 0;
  for (const [problemId, events] of Object.entries(problems)) {
    const errors = events.filter(e => e.eventType === 'error').length;
    const success = events.some(e => e.eventType === 'execution' && e.successful);
    
    // Switched early: 1-2 errors, no success, moved to new problem
    if (errors >= 1 && errors <= 2 && !success) {
      switchedEarlyCount++;
    }
  }
  
  return Object.keys(problems).length > 0
    ? switchedEarlyCount / Object.keys(problems).length
    : 0;
}

// Already normalized [0, 1]
```

---

### Signal 4: Long Idle Periods

**Definition**: No interaction for > 2 minutes.

**Proxy for**: Disengagement, distraction, frustration

```typescript
function calculateIdlePeriods(
  interactions: InteractionEvent[]
): number {
  const IDLE_THRESHOLD_MS = 2 * 60 * 1000;
  
  let idleCount = 0;
  for (let i = 1; i < interactions.length; i++) {
    const gap = interactions[i].timestamp - interactions[i-1].timestamp;
    if (gap > IDLE_THRESHOLD_MS) {
      idleCount++;
    }
  }
  
  // Normalize: 0 idles = 0.0, 3+ idles = 1.0
  return Math.min(1.0, idleCount / 3);
}
```

---

### Signal 5: Burst Error Clusters

**Definition**: 5+ errors within 2 minutes.

**Proxy for**: Overwhelm, frustration

```typescript
function calculateErrorBursts(
  interactions: InteractionEvent[]
): number {
  const BURST_WINDOW_MS = 2 * 60 * 1000;
  const BURST_THRESHOLD = 5;
  
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
  
  return Math.min(1.0, burstCount / 2);
}
```

---

### Signal 6: Help Request Dismissal

**Definition**: Request help but dismiss without using it.

**Proxy for**: Hesitation, frustration with help quality

```typescript
function calculateHelpDismissalRate(
  interactions: InteractionEvent[]
): number {
  const helpRequests = interactions.filter(
    e => e.eventType === 'hint_request' || e.eventType === 'explanation_view'
  );
  
  const dismissals = interactions.filter(
    e => e.eventType === 'hint_dismiss' || e.eventType === 'help_close'
  );
  
  return helpRequests.length > 0
    ? dismissals.length / helpRequests.length
    : 0;
}

// Already normalized [0, 1]
```

---

## Affective Proxy Score (APS) Formula

```typescript
interface APSWeights {
  repeatedIdenticalErrors: number;
  rapidEscalation: number;
  problemSwitching: number;
  idlePeriods: number;
  errorBursts: number;
  helpDismissal: number;
}

const DEFAULT_APS_WEIGHTS: APSWeights = {
  repeatedIdenticalErrors: 0.20,
  rapidEscalation: 0.15,
  problemSwitching: 0.25,
  idlePeriods: 0.10,
  errorBursts: 0.20,
  helpDismissal: 0.10
};

function calculateAPS(
  interactions: InteractionEvent[],
  weights: APSWeights = DEFAULT_APS_WEIGHTS
): number {
  const repeated = calculateRepeatedIdenticalErrors(interactions);
  const rapid = calculateRapidEscalationToL3(interactions);
  const switching = calculateProblemSwitchingRate(interactions);
  const idle = calculateIdlePeriods(interactions);
  const bursts = calculateErrorBursts(interactions);
  const dismissal = calculateHelpDismissalRate(interactions);
  
  const aps =
    weights.repeatedIdenticalErrors * repeated +
    weights.rapidEscalation * rapid +
    weights.problemSwitching * switching +
    weights.idlePeriods * idle +
    weights.errorBursts * bursts +
    weights.helpDismissal * dismissal;
  
  return Math.max(0, Math.min(1, aps));
}
```

---

## APS Thresholds & Responses

| APS Level | Range | Interpretation | System Response |
|-----------|-------|----------------|-----------------|
| **Low** | 0.0 - 0.3 | Engaged, progressing | Normal pacing |
| **Medium** | 0.4 - 0.6 | Some frustration | Encouragement, check-in |
| **High** | 0.7 - 1.0 | High frustration | Immediate intervention |

### Adaptive Responses

```typescript
function respondToAffectiveState(
  learnerId: string,
  aps: number
): void {
  if (aps > 0.8) {
    // High frustration - immediate intervention
    triggerImmediateHelp(learnerId);
    showEncouragement(learnerId, 
      "This is a tough one! Let's break it down together.");
    
  } else if (aps > 0.6) {
    // Medium frustration - encouragement
    showEncouragement(learnerId,
      "You're making progress! Keep trying, you're close.");
    enableFasterEscalation(learnerId);
    
  } else if (aps > 0.4) {
    // Early signs - subtle support
    showProgressIndicator(learnerId);
  }
  
  logEvent({
    eventType: 'affective_intervention_triggered',
    learnerId,
    aps,
    responseType: aps > 0.8 ? 'immediate_help' :
                  aps > 0.6 ? 'encouragement' : 'subtle_support'
  });
}
```

---

## APS vs CSI

| Aspect | APS | CSI |
|--------|-----|-----|
| **Measures** | Frustration/disengagement | Cognitive overload |
| **Indicators** | Switching, idleness, rapid escalation | Rapid errors, bursts, escalation |
| **Response** | Emotional support, encouragement | Speed up help, simplify |
| **Overlap** | Both use error patterns | |

**Combined Use**:
```typescript
function getHolisticIntervention(
  aps: number,
  csi: number
): Intervention {
  if (aps > 0.7 && csi > 0.7) {
    // Both high: Major struggle
    return {
      type: 'comprehensive_support',
      actions: ['immediate_explanation', 'encouragement', 'offer_break']
    };
  } else if (aps > 0.7) {
    // High APS only: Emotional support
    return { type: 'encouragement' };
  } else if (csi > 0.7) {
    // High CSI only: Cognitive support
    return { type: 'speed_up_escalation' };
  }
  return { type: 'none' };
}
```

---

## Logging Schema

### Event: `aps_calculated`

```typescript
{
  eventType: 'aps_calculated',
  timestamp: number,
  learnerId: string,
  aps: number,  // 0-1
  level: 'low' | 'medium' | 'high',
  components: {
    repeatedIdenticalErrors: number;
    rapidEscalation: number;
    problemSwitching: number;
    idlePeriods: number;
    errorBursts: number;
    helpDismissal: number;
  },
  calculationWindow: {
    startTime: number;
    endTime: number;
    eventCount: number;
  }
}
```

### Event: `affective_intervention_triggered`

```typescript
{
  eventType: 'affective_intervention_triggered',
  timestamp: number,
  learnerId: string,
  aps: number,
  interventionType: 'immediate_help' | 'encouragement' | 'subtle_support' | 'offer_break',
  triggerSignal: string,  // Which component triggered
  message?: string
}
```

---

## Analysis Queries

### APS vs dropout rate

```javascript
db.events.aggregate([
  { $match: { eventType: 'aps_calculated' } },
  { $lookup: {
    from: 'sessions',
    localField: 'learnerId',
    foreignField: 'learnerId',
    as: 'session'
  }},
  { $group: {
    _id: {
      apsLevel: {
        $cond: [
          { $gte: ['$aps', 0.7] }, 'high',
          { $cond: [{ $gte: ['$aps', 0.4] }, 'medium', 'low'] }
        ]
      }
    },
    dropoutRate: { $avg: '$session.didDropout' },
    avgSessionLength: { $avg: '$session.duration' }
  }}
]);
```

### Does APS predict help need?

```javascript
// Does high APS predict requesting explanation?
db.events.aggregate([
  { $match: { eventType: 'aps_calculated' } },
  { $lookup: {
    from: 'events',
    let: { learnerId: '$learnerId', apsTime: '$timestamp' },
    pipeline: [
      { $match: {
        $expr: {
          $and: [
            { $eq: ['$learnerId', '$$learnerId'] },
            { $eq: ['$eventType', 'explanation_view'] },
            { $gt: ['$timestamp', '$$apsTime'] },
            { $lt: [{ $subtract: ['$timestamp', '$$apsTime'] }, 60000] }
          ]
        }
      }}
    ],
    as: 'subsequentHelp'
  }},
  { $project: {
    aps: 1,
    soughtHelp: { $gt: [{ $size: '$subsequentHelp' }, 0] }
  }},
  { $group: {
    _id: { $gte: ['$aps', 0.7] },
    helpSeekingRate: { $avg: { $cond: ['$soughtHelp', 1, 0] } }
  }}
]);
```

---

## Research Questions

1. **Does high APS predict dropout?**
   - Test: APS > 0.7 → session abandonment?

2. **Do affective interventions help?**
   - Compare: APS trajectory with/without interventions

3. **Can we predict frustration before it peaks?**
   - Early warning signals

4. **Do different learner types show different affective patterns?**
   - Rapid correctors vs persistent misconceptions

---

## Implementation Roadmap

### Week 11: Core APS
- [ ] Implement all 6 signals
- [ ] APS calculation function
- [ ] Threshold-based interventions

### Week 12: Integration
- [ ] Combine with CSI
- [ ] Real-time monitoring
- [ ] Dashboard visualization
