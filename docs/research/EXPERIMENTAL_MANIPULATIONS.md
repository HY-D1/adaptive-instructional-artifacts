# Experimental Interface Manipulations

**Component**: 16 of 17  
**Status**: 📋 Planned  
**Research Question**: Which components are essential for learning?

---

## Problem

Currently, everything is integrated. We cannot isolate components to test:
- Is the textbook helping?
- Is adaptive escalation better than static?
- Does immediate explanation work better than progressive hints?

**Goal**: Create clean baselines for controlled experiments.

---

## Toggle Conditions

### Condition 1: Textbook Disabled

```typescript
const textbookDisabled: ExperimentalCondition = {
  id: 'textbook_disabled',
  name: 'No Textbook Accumulation',
  description: 'Hints and explanations shown but not saved to My Notes',
  flags: {
    enableTextbook: false,
    enableSaveToNotes: false,
    showMyNotesTab: false
  },
  purpose: 'Test if textbook accumulation improves learning'
};
```

**UI Changes**:
- Hide "My Notes" tab
- Hide "Save to Notes" button
- Explanations shown but not persisted

---

### Condition 2: Adaptive Ladder Disabled

```typescript
const adaptiveLadderDisabled: ExperimentalCondition = {
  id: 'adaptive_ladder_disabled',
  name: 'Static Hint Sequence',
  description: 'Fixed hint sequence (L1 → L2 → L3) without escalation',
  flags: {
    enableAutoEscalation: false,
    enableEscalationTriggers: false,
    fixedHintSequence: true
  },
  purpose: 'Test if adaptive escalation improves over static'
};
```

**UI Changes**:
- "Next Hint" always shows next level hint
- No automatic explanation mode
- No escalation based on errors/time

---

### Condition 3: Immediate Explanation Mode

```typescript
const immediateExplanationMode: ExperimentalCondition = {
  id: 'immediate_explanation_mode',
  name: 'Explanation-First',
  description: 'Skip hint ladder, go straight to full explanation',
  flags: {
    skipHintLadder: true,
    showExplanationFirst: true,
    enableHints: false
  },
  purpose: 'Test if hints are necessary or if explanations suffice'
};
```

**UI Changes**:
- "Get Help" button shows full explanation immediately
- No L1/L2/L3 hints
- Source grounding still applies

---

### Condition 4: Static Hint Mode

```typescript
const staticHintMode: ExperimentalCondition = {
  id: 'static_hint_mode',
  name: 'SQL-Engage Only',
  description: 'Use static SQL-Engage hints, no LLM generation',
  flags: {
    useLLM: false,
    useSqlEngageOnly: true,
    enableEnhancedHints: false
  },
  purpose: 'Test if LLM-generated content adds value'
};
```

**UI Changes**:
- Hints from SQL-Engage dataset only
- No AI-generated content
- Deterministic, validated hints

---

### Condition 5: Fast Escalator Profile

```typescript
const fastEscalatorCondition: ExperimentalCondition = {
  id: 'fast_escalator_mode',
  name: 'Fast Escalation',
  description: 'Escalate after 2 errors (aggressive support)',
  flags: {
    escalationProfile: 'fast-escalator',
    escalationThreshold: 2,
    timeStuckThreshold: 2 * 60 * 1000
  },
  purpose: 'Test effect of aggressive scaffolding'
};
```

---

### Condition 6: Slow Escalator Profile

```typescript
const slowEscalatorCondition: ExperimentalCondition = {
  id: 'slow_escalator_mode',
  name: 'Slow Escalation',
  description: 'Escalate after 5 errors (productive struggle)',
  flags: {
    escalationProfile: 'slow-escalator',
    escalationThreshold: 5,
    timeStuckThreshold: 8 * 60 * 1000
  },
  purpose: 'Test effect of conservative scaffolding'
};
```

---

## Condition Assignment

### Random Assignment

```typescript
function assignCondition(learnerId: string): ExperimentalCondition {
  // Use hash of learnerId for deterministic assignment
  const hash = hashCode(learnerId);
  const conditions = [
    textbookDisabled,
    adaptiveLadderDisabled,
    immediateExplanationMode,
    staticHintMode,
    fastEscalatorCondition,
    slowEscalatorCondition,
    controlCondition  // Default full system
  ];
  
  return conditions[hash % conditions.length];
}
```

### Session-Level Persistence

```typescript
function setSessionCondition(
  learnerId: string,
  condition: ExperimentalCondition
): void {
  // Store in session storage
  sessionStorage.setItem(
    `experimental_condition_${learnerId}`,
    JSON.stringify({
      conditionId: condition.id,
      assignedAt: Date.now()
    })
  );
  
  logEvent({
    eventType: 'experimental_condition_assigned',
    learnerId,
    conditionId: condition.id,
    conditionName: condition.name
  });
}

function getSessionCondition(learnerId: string): ExperimentalCondition {
  const stored = sessionStorage.getItem(`experimental_condition_${learnerId}`);
  if (stored) {
    return JSON.parse(stored);
  }
  return assignAndStoreCondition(learnerId);
}
```

---

## Feature Flag System

```typescript
interface FeatureFlags {
  enableTextbook: boolean;
  enableSaveToNotes: boolean;
  enableAutoEscalation: boolean;
  enableLLM: boolean;
  skipHintLadder: boolean;
  escalationProfile: string;
}

const CONDITION_FLAGS: Record<string, FeatureFlags> = {
  'textbook_disabled': {
    enableTextbook: false,
    enableSaveToNotes: false,
    enableAutoEscalation: true,
    enableLLM: true,
    skipHintLadder: false,
    escalationProfile: 'adaptive-medium'
  },
  'adaptive_ladder_disabled': {
    enableTextbook: true,
    enableSaveToNotes: true,
    enableAutoEscalation: false,
    enableLLM: true,
    skipHintLadder: false,
    escalationProfile: 'static'
  },
  'immediate_explanation_mode': {
    enableTextbook: true,
    enableSaveToNotes: true,
    enableAutoEscalation: false,
    enableLLM: true,
    skipHintLadder: true,
    escalationProfile: 'immediate'
  },
  'static_hint_mode': {
    enableTextbook: true,
    enableSaveToNotes: true,
    enableAutoEscalation: true,
    enableLLM: false,
    skipHintLadder: false,
    escalationProfile: 'adaptive-medium'
  },
  'fast_escalator_mode': {
    enableTextbook: true,
    enableSaveToNotes: true,
    enableAutoEscalation: true,
    enableLLM: true,
    skipHintLadder: false,
    escalationProfile: 'fast-escalator'
  },
  'slow_escalator_mode': {
    enableTextbook: true,
    enableSaveToNotes: true,
    enableAutoEscalation: true,
    enableLLM: true,
    skipHintLadder: false,
    escalationProfile: 'slow-escalator'
  },
  'control': {
    enableTextbook: true,
    enableSaveToNotes: true,
    enableAutoEscalation: true,
    enableLLM: true,
    skipHintLadder: false,
    escalationProfile: 'adaptive-medium'
  }
};

function getFeatureFlags(conditionId: string): FeatureFlags {
  return CONDITION_FLAGS[conditionId] || CONDITION_FLAGS['control'];
}
```

---

## UI Adaptation

```typescript
function adaptUIFromCondition(condition: ExperimentalCondition): void {
  const flags = getFeatureFlags(condition.id);
  
  // Textbook tab
  const textbookTab = document.getElementById('textbook-tab');
  if (textbookTab) {
    textbookTab.style.display = flags.enableTextbook ? 'block' : 'none';
  }
  
  // Save to Notes button
  const saveButton = document.getElementById('save-to-notes-btn');
  if (saveButton) {
    saveButton.style.display = flags.enableSaveToNotes ? 'block' : 'none';
  }
  
  // Hint system behavior
  if (flags.skipHintLadder) {
    overrideNextHintButtonToShowExplanation();
  }
  
  // Log UI state
  logEvent({
    eventType: 'ui_adapted_to_condition',
    conditionId: condition.id,
    visibleElements: ['textbook-tab', 'save-button', 'hint-ladder'],
    hiddenElements: flags.enableTextbook ? [] : ['textbook-tab']
  });
}
```

---

## Experimental Designs

### Design 1: Textbook Effectiveness

**Conditions**:
- Treatment: Full system (textbook enabled)
- Control: Textbook disabled

**Metrics**:
- Completion rate
- Error rate
- Concept coverage
- Delayed retention (1 week)

**Hypothesis**: Textbook group has better retention.

---

### Design 2: Adaptive vs Static

**Conditions**:
- Treatment: Adaptive escalation
- Control: Static hint sequence

**Metrics**:
- Time to success
- HDI (dependency)
- Learner satisfaction
- Completion rate

**Hypothesis**: Adaptive group has lower HDI, similar completion.

---

### Design 3: Immediate vs Progressive

**Conditions**:
- Treatment: Immediate explanation
- Control: Progressive hint ladder

**Metrics**:
- Time to success
- Concept coverage
- HDI
- Satisfaction

**Hypothesis**: Progressive group has better retention but longer time.

---

### Design 4: Escalation Speed

**Conditions**:
- Fast escalator (2 errors)
- Slow escalator (5 errors)
- Adaptive (dynamic)

**Metrics**:
- HDI trajectory
- Completion rate
- Retention
- Satisfaction

**Hypothesis**: Adaptive outperforms both static profiles.

---

## Logging Schema

### Event: `experimental_condition_assigned`

```typescript
{
  eventType: 'experimental_condition_assigned',
  timestamp: number,
  learnerId: string,
  conditionId: string,
  conditionName: string,
  assignmentMethod: 'random' | 'stratified' | 'admin',
  flags: FeatureFlags
}
```

### Event: `experimental_condition_changed`

```typescript
{
  eventType: 'experimental_condition_changed',
  timestamp: number,
  learnerId: string,
  previousCondition: string,
  newCondition: string,
  reason: string
}
```

### Event: `feature_flag_checked`

```typescript
{
  eventType: 'feature_flag_checked',
  timestamp: number,
  learnerId: string,
  flagName: string,
  flagValue: boolean | string,
  context: string  // Which component checked the flag
}
```

---

## Analysis Queries

### Compare outcomes by condition

```javascript
db.events.aggregate([
  { $match: { eventType: 'experimental_condition_assigned' } },
  { $lookup: {
    from: 'sessions',
    localField: 'learnerId',
    foreignField: 'learnerId',
    as: 'session'
  }},
  { $group: {
    _id: '$conditionId',
    avgCompletionRate: { $avg: '$session.completionRate' },
    avgHDI: { $avg: '$session.hdi' },
    avgTimeToSuccess: { $avg: '$session.timeToSuccess' },
    count: { $sum: 1 }
  }}
]);
```

### Statistical significance

```javascript
// Use proper statistical tests
const results = {
  textbook: { mean: 0.85, std: 0.15, n: 50 },
  noTextbook: { mean: 0.72, std: 0.18, n: 48 }
};

// T-test for difference in means
const tStatistic = calculateTTest(results.textbook, results.noTextbook);
const pValue = getPValue(tStatistic);

console.log(`Textbook effect: t=${tStatistic}, p=${pValue}`);
```

---

## Ethical Considerations

1. **Informed Consent**: Learners should know they're in an experiment
2. **Equity**: Ensure all learners get effective learning eventually
3. **Harm Prevention**: Monitor for negative outcomes in any condition
4. **Debriefing**: Explain condition assignment after study

---

## Implementation Roadmap

### Week 10: Flag System
- [ ] Define all feature flags
- [ ] Condition-to-flags mapping
- [ ] Assignment logic

### Week 11: UI Adaptation
- [ ] Conditional rendering
- [ ] UI state logging
- [ ] Testing all conditions

### Week 12: Analysis
- [ ] Outcome comparison
- [ ] Statistical testing
- [ ] Results reporting
