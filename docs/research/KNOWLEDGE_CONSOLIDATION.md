# Knowledge Consolidation & Spaced Reinforcement

**Component**: 10 of 17  
**Status**: 📋 Planned  
**Research Question**: Do saved textbook units improve long-term retention?

---

## Problem

Currently, textbook units are created when learners struggle, but we don't know:
- Are these units actually helping?
- Do learners remember the content after saving?
- Does the "automatic textbook" improve learning outcomes?

**Goal**: Measure whether accumulated instructional content leads to knowledge consolidation.

---

## Core Concept: Spaced Reinforcement

After a learner saves a unit to their textbook, the system will later test their memory of that content.

### The Ebbinghaus Forgetting Curve

```
Retention
100% | ████
 80% | ███     ← Test here (1 day)
 60% | ██
 40% | █       ← Test here (1 week)
 20% |
  0% +------------------
     0    1    3    7   Days
```

**Principle**: Testing at the point of forgetting strengthens memory.

---

## Spaced Reinforcement Flow

### Step 1: Unit Creation (Already Implemented)

```typescript
// Learner struggles → Explanation generated → Save to textbook
{
  eventType: 'textbook_unit_upsert',
  unitId: 'unit-123',
  conceptId: 'group-by',
  title: 'Understanding GROUP BY',
  content: '...',
  createdFromInteractionIds: ['error-1', 'error-2', 'error-3']
}
```

### Step 2: Schedule Reinforcement

```typescript
interface ReinforcementSchedule {
  unitId: string;
  learnerId: string;
  scheduledPrompts: Array<{
    delayDays: number;      // 1, 3, 7, 14 days
    promptType: 'mcq' | 'sql_completion' | 'explain_concept';
    status: 'pending' | 'shown' | 'answered' | 'expired';
    scheduledTime: number;
    shownTime?: number;
    responseTime?: number;
    correct?: boolean;
  }>;
}

const DEFAULT_DELAYS = [1, 3, 7];  // Days after saving

function scheduleReinforcement(
  unit: InstructionalUnit,
  learnerId: string
): ReinforcementSchedule {
  const now = Date.now();
  
  return {
    unitId: unit.id,
    learnerId,
    scheduledPrompts: DEFAULT_DELAYS.map((delay, index) => ({
      delayDays: delay,
      promptType: selectPromptType(index, unit.conceptId),
      status: 'pending',
      scheduledTime: now + delay * 24 * 60 * 60 * 1000
    }))
  };
}

function selectPromptType(
  promptIndex: number,
  conceptId: string
): 'mcq' | 'sql_completion' | 'explain_concept' {
  // First prompt: MCQ (easier)
  if (promptIndex === 0) return 'mcq';
  
  // Later prompts: SQL completion (harder)
  if (['select-basic', 'where-clause', 'joins'].includes(conceptId)) {
    return 'sql_completion';
  }
  
  // Conceptual topics: explain
  return 'explain_concept';
}
```

### Step 3: Generate Micro-Check

```typescript
interface MicroCheck {
  id: string;
  unitId: string;
  conceptId: string;
  type: 'mcq' | 'sql_completion' | 'explain_concept';
  question: string;
  options?: string[];        // For MCQ
  correctAnswer: string;
  hint?: string;
}

async function generateMicroCheck(
  unit: InstructionalUnit,
  promptType: 'mcq' | 'sql_completion' | 'explain_concept'
): Promise<MicroCheck> {
  switch (promptType) {
    case 'mcq':
      return generateMCQ(unit);
    case 'sql_completion':
      return generateSQLCompletion(unit);
    case 'explain_concept':
      return generateExplainPrompt(unit);
  }
}

async function generateMCQ(unit: InstructionalUnit): Promise<MicroCheck> {
  // Use LLM with constrained template
  const prompt = `
    Generate a multiple choice question to test understanding of this concept:
    
    Concept: ${unit.conceptId}
    Unit Title: ${unit.title}
    Unit Content: ${unit.content.substring(0, 500)}
    
    Requirements:
    - Question should test understanding, not memorization
    - 4 options (1 correct, 3 plausible distractors)
    - Focus on common mistakes mentioned in the unit
    
    Output JSON:
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "..."
    }
  `;
  
  const response = await llm.generate(prompt, { temperature: 0.3 });
  return parseAndValidateMCQ(response);
}

async function generateSQLCompletion(unit: InstructionalUnit): Promise<MicroCheck> {
  // Generate partial SQL query to complete
  const prompt = `
    Generate a SQL completion exercise for concept: ${unit.conceptId}
    
    Provide:
    - A problem description
    - A partial SQL query with blanks (____)
    - The correct completed query
    
    Example:
    Problem: "Complete the query to group by department"
    Partial: "SELECT dept, COUNT(*) FROM employees ____"
    Correct: "SELECT dept, COUNT(*) FROM employees GROUP BY dept"
  `;
  
  const response = await llm.generate(prompt, { temperature: 0.3 });
  return parseAndValidateSQLCompletion(response);
}
```

### Step 4: Present Reinforcement Prompt

```typescript
function presentReinforcementPrompt(
  learnerId: string,
  microCheck: MicroCheck
): void {
  // Show in UI as non-intrusive notification
  showNotification(learnerId, {
    type: 'reinforcement',
    title: 'Quick Check',
    message: `You saved a note about ${microCheck.conceptId} ${microCheck.delayDays} days ago. Test your memory!`,
    action: () => openMicroCheckModal(learnerId, microCheck)
  });
  
  logEvent({
    eventType: 'reinforcement_prompt_shown',
    learnerId,
    microCheckId: microCheck.id,
    unitId: microCheck.unitId,
    conceptId: microCheck.conceptId,
    promptType: microCheck.type,
    delayDays: microCheck.delayDays
  });
}
```

### Step 5: Collect Response

```typescript
function recordReinforcementResponse(
  learnerId: string,
  microCheckId: string,
  response: string,
  timeSpentMs: number
): void {
  const microCheck = getMicroCheck(microCheckId);
  const correct = normalizeResponse(response) === normalizeResponse(microCheck.correctAnswer);
  
  logEvent({
    eventType: 'reinforcement_response',
    learnerId,
    microCheckId,
    unitId: microCheck.unitId,
    conceptId: microCheck.conceptId,
    response,
    correct,
    timeSpentMs,
    promptType: microCheck.type
  });
  
  // Update schedule
  updateReinforcementStatus(microCheckId, 'answered', { correct, response });
}
```

---

## Measurement Framework

### Metric 1: Recall Accuracy by Delay

```typescript
interface RecallAccuracyMetrics {
  conceptId: string;
  byDelay: {
    '1_day': { accuracy: number; count: number };
    '3_days': { accuracy: number; count: number };
    '7_days': { accuracy: number; count: number };
  };
  overall: { accuracy: number; count: number };
}

function calculateRecallAccuracy(
  learnerHistory: LearnerHistory,
  conceptId: string
): RecallAccuracyMetrics {
  const responses = learnerHistory.events
    .filter(e => 
      e.eventType === 'reinforcement_response' &&
      e.conceptId === conceptId
    );
  
  const byDelay = {
    '1_day': calculateAccuracy(responses.filter(r => r.delayDays === 1)),
    '3_days': calculateAccuracy(responses.filter(r => r.delayDays === 3)),
    '7_days': calculateAccuracy(responses.filter(r => r.delayDays === 7))
  };
  
  return { conceptId, byDelay, overall: calculateAccuracy(responses) };
}
```

### Metric 2: Time-to-Answer Trends

```typescript
interface TimeToAnswerTrend {
  conceptId: string;
  firstPromptMs: number;      // Time on first reinforcement
  secondPromptMs: number;     // Time on second reinforcement
  improvement: number;         // Percentage improvement
}

function calculateTimeTrend(
  learnerHistory: LearnerHistory,
  conceptId: string
): TimeToAnswerTrend {
  const responses = learnerHistory.events
    .filter(e => 
      e.eventType === 'reinforcement_response' &&
      e.conceptId === conceptId
    )
    .sort((a, b) => a.timestamp - b.timestamp);
  
  return {
    conceptId,
    firstPromptMs: responses[0]?.timeSpentMs || 0,
    secondPromptMs: responses[1]?.timeSpentMs || 0,
    improvement: responses[0] && responses[1]
      ? (responses[0].timeSpentMs - responses[1].timeSpentMs) / responses[0].timeSpentMs
      : 0
  };
}
```

### Metric 3: Improvement After Reinforcement

```typescript
function measureImprovementAfterReinforcement(
  learnerHistory: LearnerHistory,
  conceptId: string
): number {
  // Find errors on this concept before and after reinforcement
  const reinforcements = learnerHistory.events
    .filter(e => 
      e.eventType === 'reinforcement_response' &&
      e.conceptId === conceptId
    );
  
  if (reinforcements.length === 0) return 0;
  
  const firstReinforcement = reinforcements[0];
  
  const errorsBefore = countErrorsOnConcept(
    learnerHistory, 
    conceptId, 
    0, 
    firstReinforcement.timestamp
  );
  
  const errorsAfter = countErrorsOnConcept(
    learnerHistory,
    conceptId,
    firstReinforcement.timestamp,
    Date.now()
  );
  
  // Normalize by time window
  const timeBefore = firstReinforcement.timestamp - learnerHistory.startTime;
  const timeAfter = Date.now() - firstReinforcement.timestamp;
  
  const errorRateBefore = errorsBefore / (timeBefore / (1000 * 60 * 60));  // per hour
  const errorRateAfter = errorsAfter / (timeAfter / (1000 * 60 * 60));
  
  return (errorRateBefore - errorRateAfter) / errorRateBefore;  // Improvement percentage
}
```

---

## Comparison: With vs Without Reinforcement

### Experimental Design

```typescript
function assignToCondition(learnerId: string): 'reinforcement' | 'control' {
  // Random assignment
  return Math.random() < 0.5 ? 'reinforcement' : 'control';
}

// Reinforcement group: Gets spaced prompts
// Control group: Units saved but no prompts
```

### Outcomes to Compare

| Metric | Reinforcement Group | Control Group | Test |
|--------|---------------------|---------------|------|
| Recall accuracy at 7 days | ? | ? | t-test |
| Error rate on concept | ? | ? | t-test |
| Time to solve similar problems | ? | ? | t-test |
| HDI trajectory | ? | ? | ANOVA |

---

## Logging Schema

### Event: `reinforcement_scheduled`

```typescript
{
  eventType: 'reinforcement_scheduled',
  timestamp: number,
  learnerId: string,
  unitId: string,
  conceptId: string,
  schedule: Array<{
    delayDays: number;
    promptType: string;
    scheduledTime: number;
  }>
}
```

### Event: `reinforcement_prompt_shown`

```typescript
{
  eventType: 'reinforcement_prompt_shown',
  timestamp: number,
  learnerId: string,
  microCheckId: string,
  unitId: string,
  conceptId: string,
  promptType: 'mcq' | 'sql_completion' | 'explain_concept',
  delayDays: number,
  uiContext: 'notification' | 'modal' | 'sidebar'
}
```

### Event: `reinforcement_response`

```typescript
{
  eventType: 'reinforcement_response',
  timestamp: number,
  learnerId: string,
  microCheckId: string,
  unitId: string,
  conceptId: string,
  promptType: string,
  response: string,
  correct: boolean,
  timeSpentMs: number,
  usedHint: boolean,
  confidence?: 'high' | 'medium' | 'low'  // Self-reported
}
```

### Event: `reinforcement_expired`

```typescript
{
  eventType: 'reinforcement_expired',
  timestamp: number,
  learnerId: string,
  microCheckId: string,
  unitId: string,
  delayDays: number,
  reason: 'time_limit' | 'learner_skipped' | 'concept_mastered'
}
```

---

## Analysis Queries

### Forgetting curve by concept

```javascript
db.events.aggregate([
  { $match: { eventType: 'reinforcement_response' } },
  { $group: {
    _id: { conceptId: '$conceptId', delayDays: '$delayDays' },
    accuracy: { $avg: { $cond: ['$correct', 1, 0] } },
    avgTimeMs: { $avg: '$timeSpentMs' },
    count: { $sum: 1 }
  }},
  { $sort: { '_id.delayDays': 1 } }
]);
// Plot: accuracy vs delay for each concept
```

### Reinforcement effectiveness

```javascript
// Compare error rates before/after reinforcement
db.events.aggregate([
  { $match: { eventType: 'reinforcement_response', correct: true } },
  { $lookup: {
    from: 'events',
    let: { 
      learnerId: '$learnerId', 
      conceptId: '$conceptId',
      responseTime: '$timestamp'
    },
    pipeline: [
      { $match: {
        $expr: {
          $and: [
            { $eq: ['$learnerId', '$$learnerId'] },
            { $eq: ['$conceptId', '$$conceptId'] },
            { $eq: ['$eventType', 'error'] }
          ]
        }
      }},
      { $project: {
        beforeReinforcement: { $lt: ['$timestamp', '$$responseTime'] }
      }}
    ],
    as: 'relatedErrors'
  }},
  { $project: {
    errorsBefore: { 
      $size: { 
        $filter: { 
          input: '$relatedErrors', 
          cond: '$beforeReinforcement' 
        }
      }
    },
    errorsAfter: {
      $size: {
        $filter: {
          input: '$relatedErrors',
          cond: { $not: '$beforeReinforcement' }
        }
      }
    }
  }}
]);
```

---

## Integration with Other Components

| Component | Integration |
|-----------|-------------|
| Automatic Textbook | Reinforcement tests units from textbook |
| HDI | Measure if reinforcement reduces dependency |
| Multi-Armed Bandit | Include reinforcement effectiveness in reward |
| Concept Graph | Schedule reinforcement for prerequisite concepts |

---

## Research Questions

1. **Does spaced reinforcement improve retention?**
   - Compare recall accuracy at 7 days (reinforcement vs control)

2. **What is the optimal delay schedule?**
   - Test 1-3-7 vs 1-2-4 vs 2-7-14 day schedules

3. **Which prompt type works best?**
   - MCQ vs SQL completion vs explain concept

4. **Does reinforcement reduce errors?**
   - Compare error rates before/after reinforcement

5. **Can we predict who needs more reinforcement?**
   - Use early performance to predict retention

---

## Implementation Roadmap

### Week 8: Core System
- [ ] Reinforcement scheduling
- [ ] Micro-check generation
- [ ] Prompt presentation UI

### Week 9: Measurement
- [ ] Response logging
- [ ] Recall accuracy metrics
- [ ] Forgetting curve analysis

### Week 10: Experiment
- [ ] A/B test setup
- [ ] Control group logic
- [ ] Results analysis
