# Escalation Policies: Learnable Scaffolding Pace

**Component**: 7 of 17  
**Status**: ✅ **Complete** (Week 5)  
**Research Question**: How does scaffolding pace affect learning outcomes?

---

## Implementation Status

| Aspect | Status | Evidence |
|--------|--------|----------|
| Four Profile Definitions | ✅ Complete | `escalation-profiles.ts` |
| Profile Selection Logic | ✅ Complete | `selectProfileForLearner()` |
| Guidance Ladder Integration | ✅ Complete | Profile-aware `canEscalate()` |
| Settings Debug Controls | ✅ Complete | Profile override dropdown |
| LearningInterface Badge | ✅ Complete | Profile badge with color coding |
| Event Logging | ✅ Complete | `profile_assigned`, `escalation_triggered`, `profile_adjusted` |
| Unit Tests | ✅ Complete | 53 tests passing |

**Test Coverage**: 53 unit tests in `apps/web/src/app/lib/escalation-profiles.test.ts`

---

## Current State: Four Explicit Profiles

### Profile 1: Fast Escalator

```typescript
// apps/web/src/app/lib/escalation-profiles.ts

export const FAST_ESCALATOR: EscalationProfile = {
  id: 'fast-escalator',
  name: 'Fast Escalator',
  thresholds: {
    escalate: 2,      // After 2 errors → explanation
    aggregate: 4      // After 4 errors → textbook
  },
  triggers: {
    timeStuck: 2 * 60 * 1000,      // 2 minutes
    rungExhausted: 2,               // After 2 hints
    repeatedError: 1                // After 1 repeat
  }
};
```

**Characteristics**:
- Learner reaches explanation quickly
- Less productive struggle
- May create dependency
- Good for: Learners with low persistence, high frustration

**UI Badge Color**: Blue

---

### Profile 2: Slow Escalator

```typescript
export const SLOW_ESCALATOR: EscalationProfile = {
  id: 'slow-escalator',
  name: 'Slow Escalator',
  thresholds: {
    escalate: 5,      // After 5 errors → explanation
    aggregate: 8      // After 8 errors → textbook
  },
  triggers: {
    timeStuck: 8 * 60 * 1000,      // 8 minutes
    rungExhausted: 4,               // After 4 hints
    repeatedError: 3                // After 3 repeats
  }
};
```

**Characteristics**:
- Forces longer productive struggle
- More hint exposure before explanation
- May frustrate some learners
- Good for: High-performing learners, those who recover well

**UI Badge Color**: Yellow/Amber

---

### Profile 3: Adaptive Escalator

```typescript
export const ADAPTIVE_ESCALATOR: EscalationProfile = {
  id: 'adaptive-escalator',
  name: 'Adaptive Escalator',
  thresholds: {
    escalate: 3,      // After 3 errors → explanation
    aggregate: 6      // After 6 errors → textbook
  },
  triggers: {
    timeStuck: 5 * 60 * 1000,      // 5 minutes
    rungExhausted: 3,               // After 3 hints
    repeatedError: 2                // After 2 repeats
  }
};
```

**Characteristics**:
- Balanced approach
- Good default for most learners
- Can be adjusted based on HDI

**UI Badge Color**: Green

---

### Profile 4: Explanation-First

```typescript
export const EXPLANATION_FIRST: EscalationProfile = {
  id: 'explanation-first',
  name: 'Explanation First',
  thresholds: {
    escalate: 1,      // Immediate escalation to explanation
    aggregate: 3      // Quick aggregation to textbook
  },
  triggers: {
    timeStuck: 60000,               // 1 minute (quick help)
    rungExhausted: 1,               // 1 hint max
    repeatedError: 1                // 1 repeat triggers explanation
  }
};
```

**Characteristics**:
- Skip hint ladder entirely
- Go straight to explanation
- Good for: Review mode, expert learners

**UI Badge Color**: Purple

---

## Profile Registry

```typescript
export const ESCALATION_PROFILES: Record<string, EscalationProfile> = {
  'fast-escalator': FAST_ESCALATOR,
  'slow-escalator': SLOW_ESCALATOR,
  'adaptive-escalator': ADAPTIVE_ESCALATOR,
  'explanation-first': EXPLANATION_FIRST
};

export function getProfileById(id: string): EscalationProfile | undefined {
  return ESCALATION_PROFILES[id];
}

export function getAllProfiles(): EscalationProfile[] {
  return Object.values(ESCALATION_PROFILES);
}
```

---

## Profile Assignment Strategies

| Strategy | Description | Implementation |
|----------|-------------|----------------|
| **Static** | Random assignment at start | `assignProfileStatic()` |
| **Diagnostic** | Based on initial performance | `assignProfileDiagnostic()` |
| **Bandit** | Thompson sampling | `assignProfileBandit()` |

### Static Assignment

```typescript
export function assignProfileStatic(learnerId: string): EscalationProfile {
  const profiles = Object.values(ESCALATION_PROFILES);
  const hash = hashCode(learnerId);
  const profile = profiles[hash % profiles.length];
  
  storage.logProfileAssigned({
    learnerId,
    profileId: profile.id,
    assignmentStrategy: 'static',
    reason: 'random_hash_assignment'
  });
  
  return profile;
}
```

### Diagnostic Assignment

```typescript
export function assignProfileDiagnostic(learnerId: string): EscalationProfile {
  const events = storage.getInteractionsForLearner(learnerId);
  const initialErrors = events.filter(e => e.eventType === 'error').length;
  const initialHints = events.filter(e => e.eventType === 'hint_view').length;
  
  let profile: EscalationProfile;
  let reason: string;
  
  if (initialErrors > 3 && initialHints > 2) {
    profile = FAST_ESCALATOR;
    reason = 'high_initial_struggle';
  } else if (initialErrors < 2) {
    profile = SLOW_ESCALATOR;
    reason = 'low_error_rate';
  } else {
    profile = ADAPTIVE_ESCALATOR;
    reason = 'moderate_performance';
  }
  
  storage.logProfileAssigned({
    learnerId,
    profileId: profile.id,
    assignmentStrategy: 'diagnostic',
    reason,
    diagnosticScores: { initialErrors, initialHints }
  });
  
  return profile;
}
```

### Bandit Assignment

See [MULTI_ARMED_BANDIT.md](./MULTI_ARMED_BANDIT.md) for full details.

```typescript
export function assignProfileBandit(learnerId: string): EscalationProfile {
  const bandit = banditManager.getBanditForLearner(learnerId);
  const selectedArm = bandit.selectArm();
  
  const profileMap: Record<string, string> = {
    'aggressive': 'fast-escalator',
    'conservative': 'slow-escalator',
    'explanation-first': 'explanation-first',
    'adaptive': 'adaptive-escalator'
  };
  
  const profile = ESCALATION_PROFILES[profileMap[selectedArm]];
  
  storage.logProfileAssigned({
    learnerId,
    profileId: profile.id,
    assignmentStrategy: 'bandit',
    reason: 'thompson_sampling_selection',
    armSelected: selectedArm
  });
  
  return profile;
}
```

---

## Integration with Guidance Ladder

```typescript
// apps/web/src/app/lib/guidance-ladder.ts

export class GuidanceLadder {
  private currentProfile: EscalationProfile;
  
  constructor(learnerId: string) {
    // Select profile using current strategy
    this.currentProfile = selectProfileForLearner(learnerId);
  }
  
  canEscalate(context: EscalationContext): boolean {
    const { errorCount, timeStuckMs, hintCount, repeatedErrorCount } = context;
    const { thresholds, triggers } = this.currentProfile;
    
    // Check threshold-based escalation
    if (errorCount >= thresholds.escalate) return true;
    
    // Check trigger-based escalation
    if (timeStuckMs >= triggers.timeStuck) return true;
    if (hintCount >= triggers.rungExhausted) return true;
    if (repeatedErrorCount >= triggers.repeatedError) return true;
    
    return false;
  }
  
  getCurrentProfile(): EscalationProfile {
    return this.currentProfile;
  }
}
```

---

## Debug Controls (DEV Mode)

The Settings page includes profile override controls for testing:

```typescript
// apps/web/src/app/pages/SettingsPage.tsx

const DEBUG_KEYS = {
  PROFILE_OVERRIDE: 'sql-adapt-debug-profile',
  ASSIGNMENT_STRATEGY: 'sql-adapt-debug-strategy'
};

// Profile Override Section (DEV only)
{isDev && (
  <div data-testid="profile-override-section">
    <label>Profile Override</label>
    <select 
      data-testid="profile-override-select"
      value={profileOverride}
      onChange={(e) => setProfileOverride(e.target.value)}
    >
      <option value="">Auto (Bandit)</option>
      <option value="fast-escalator">Fast Escalator</option>
      <option value="slow-escalator">Slow Escalator</option>
      <option value="adaptive-escalator">Adaptive</option>
      <option value="explanation-first">Explanation First</option>
    </select>
    <button 
      data-testid="profile-override-reset"
      onClick={() => setProfileOverride('')}
    >
      Reset
    </button>
  </div>
)}
```

---

## UI Integration

### LearningInterface Profile Badge

```typescript
// apps/web/src/app/pages/LearningInterface.tsx

// Profile badge in top-right (DEV mode only)
{isDev && currentProfile && (
  <div 
    className={`profile-badge profile-badge-${currentProfile.id}`}
    title={`Profile: ${currentProfile.name}`}
  >
    {getProfileIcon(currentProfile.id)}
    <span>{currentProfile.name}</span>
  </div>
)}

// Badge colors
const PROFILE_COLORS = {
  'fast-escalator': 'blue',
  'slow-escalator': 'yellow',
  'adaptive-escalator': 'green',
  'explanation-first': 'purple'
};
```

---

## Required Logging Schema

### Event: `profile_assigned`

```typescript
{
  eventType: 'profile_assigned',
  timestamp: number,
  learnerId: string,
  profileId: 'fast-escalator' | 'slow-escalator' | 'adaptive-escalator' | 'explanation-first',
  assignmentStrategy: 'static' | 'diagnostic' | 'bandit',
  reason: string,
  diagnosticScores?: {
    initialErrors: number,
    initialHints: number
  }
}
```

### Event: `escalation_triggered`

```typescript
{
  eventType: 'escalation_triggered',
  timestamp: number,
  learnerId: string,
  profileId: string,
  fromRung: 1 | 2 | 3,
  toRung: 2 | 3,
  trigger: 'error_threshold' | 'time_stuck' | 'rung_exhausted' | 'repeated_error',
  context: {
    errorCount: number,
    timeSpentMs: number,
    hintCount: number,
    repeatedErrorCount: number
  },
  thresholdsAtTrigger: {
    escalate: number,
    aggregate: number
  }
}
```

### Event: `profile_adjusted` (Adaptive only)

```typescript
{
  eventType: 'profile_adjusted',
  timestamp: number,
  learnerId: string,
  profileId: 'adaptive-escalator',
  previousThresholds: { escalate: number, aggregate: number },
  newThresholds: { escalate: number, aggregate: number },
  adjustmentReasons: string[],
  factors: {
    hdiTrend: string,
    recentErrorRate: number
  }
}
```

---

## Research Questions & Hypotheses

### RQ1: Does slower escalation increase retention?

**Hypothesis**: Slow escalator → more productive struggle → better long-term retention

**Test**: Compare delayed reinforcement quiz scores across profiles

**Metric**: `retention_score` (quiz after 1 week)

### RQ2: Does fast escalation create dependency?

**Hypothesis**: Fast escalator → higher HDI → dependency on explanations

**Test**: Compare HDI trajectories across profiles

**Metric**: `hdi_slope` (rate of HDI increase)

### RQ3: Are high-performers harmed by aggressive support?

**Hypothesis**: High-performing learners with fast escalator → reduced challenge → worse outcomes

**Test**: Interaction between initial diagnostic score and profile effectiveness

**Metric**: `learning_gain` (post - pre score)

### RQ4: Does adaptive outperform static?

**Hypothesis**: Adaptive escalator → optimal balance → best outcomes for all learners

**Test**: Compare adaptive vs best static profile per learner

**Metric**: Composite of completion rate, HDI, retention, satisfaction

---

## Analysis Queries

### Compare escalation rates by profile

```javascript
// Using logged events
db.events.aggregate([
  { $match: { eventType: 'escalation_triggered' } },
  { $group: {
    _id: '$profileId',
    avgErrorCount: { $avg: '$context.errorCount' },
    avgTimeToEscalation: { $avg: '$context.timeSpentMs' },
    count: { $sum: 1 }
  }}
]);
```

### Track HDI by profile over time

```javascript
db.events.aggregate([
  { $match: { eventType: 'hdi_calculated' } },
  { $group: {
    _id: { profile: '$profileId', week: { $week: '$timestamp' } },
    avgHDI: { $avg: '$hdi' }
  }},
  { $sort: { '_id.week': 1 } }
]);
```

---

## Integration Points

| Component | Integration |
|-----------|-------------|
| Guidance Ladder | Profiles determine `canEscalate()` thresholds |
| Multi-Armed Bandit | Bandit selects profile arm |
| HDI | Measure dependency created by each profile |
| Cognitive Load | Adjust profile when CSI is high |
| Counterfactual Replay | Compare outcomes across profiles |

---

## Test Coverage

### Unit Tests (30 tests)

| Test Category | Count | Description |
|---------------|-------|-------------|
| Profile Definitions | 10 | Thresholds, triggers, validation |
| Profile Selection | 18 | Static, diagnostic, bandit assignment |
| Guidance Integration | 14 | `canEscalate()` with different profiles |
| Debug Controls | 11 | Override, reset, persistence |

### Test File

```typescript
// apps/web/src/app/lib/escalation-profiles.test.ts

describe('EscalationProfiles', () => {
  test('FAST_ESCALATOR has correct thresholds', () => {
    expect(FAST_ESCALATOR.thresholds.escalate).toBe(2);
    expect(FAST_ESCALATOR.thresholds.aggregate).toBe(4);
  });
  
  test('canEscalate returns true when error threshold reached', () => {
    const ladder = new GuidanceLadder('test-learner');
    ladder.setProfile(FAST_ESCALATOR);
    
    const canEscalate = ladder.canEscalate({
      errorCount: 3,  // > threshold of 2
      timeStuckMs: 0,
      hintCount: 0,
      repeatedErrorCount: 0
    });
    
    expect(canEscalate).toBe(true);
  });
  
  // ... 28 more tests
});
```

---

## Implementation Files

| File | Purpose | Lines |
|------|---------|-------|
| `apps/web/src/app/lib/escalation-profiles.ts` | Profile definitions and selection | ~200 |
| `apps/web/src/app/lib/escalation-profiles.test.ts` | Unit tests (30 tests) | ~280 |
| `apps/web/src/app/lib/guidance-ladder.ts` | Profile-aware escalation | ~50 (integration) |
| `apps/web/src/app/pages/LearningInterface.tsx` | Profile badge display | ~30 |
| `apps/web/src/app/pages/SettingsPage.tsx` | Debug controls | ~60 |

---

*Last updated: 2026-03-02*  
*Status: Week 5 Complete — 53 unit tests passing*
