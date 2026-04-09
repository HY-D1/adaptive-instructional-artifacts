# Self-Explanation Detection (RQS)

**Component**: 15 of 17  
**Status**: 📋 Planned  
**Research Question**: What makes a good reflective note?

---

## Problem

When learners save notes to their textbook, we **assume** that helps learning. But:
- Are notes paraphrased or copied?
- Do they capture key concepts?
- Are some notes more useful than others?

**Goal**: Measure quality of self-explanation.

---

## Reflection Quality Score (RQS)

### Components

#### Component 1: Length (Token Count)

```typescript
function calculateLengthScore(content: string): number {
  const tokens = tokenize(content).length;
  
  // Optimal length: 50-200 tokens
  // Too short: < 30 tokens
  // Too long: > 300 tokens
  
  if (tokens < 30) return tokens / 30;  // Linear up to 30
  if (tokens <= 200) return 1.0;        // Perfect range
  if (tokens <= 300) return 1.0 - (tokens - 200) / 100;  // Declining
  return 0.3;  // Too long, penalize
}
```

**Rationale**: 
- Too short = superficial
- Too long = unfocused
- Sweet spot = comprehensive but concise

---

#### Component 2: Lexical Overlap

Compare saved note to system-generated explanation.

```typescript
function calculateLexicalOverlap(
  learnerNote: string,
  systemExplanation: string
): number {
  const noteTokens = new Set(tokenize(learnerNote.toLowerCase()));
  const systemTokens = new Set(tokenize(systemExplanation.toLowerCase()));
  
  // Jaccard similarity
  const intersection = new Set(
    [...noteTokens].filter(x => systemTokens.has(x))
  );
  const union = new Set([...noteTokens, ...systemTokens]);
  
  const jaccard = intersection.size / union.size;
  
  // High overlap = copied
  // Low overlap = original
  // Sweet spot: 0.2-0.4 (some overlap but not copied)
  
  if (jaccard < 0.2) return jaccard / 0.2;      // Low overlap
  if (jaccard <= 0.4) return 1.0;                // Sweet spot
  return 1.0 - (jaccard - 0.4) / 0.6;            // High overlap (copied)
}
```

**Rationale**:
- High overlap (> 0.6) = likely copied, low reflection
- Low overlap (< 0.2) = might be off-topic
- Medium overlap (0.2-0.4) = paraphrased, good reflection

---

#### Component 3: Paraphrase Similarity

Beyond lexical overlap—semantic similarity using embeddings.

```typescript
async function calculateParaphraseScore(
  learnerNote: string,
  systemExplanation: string
): Promise<number> {
  // Generate embeddings
  const noteEmbedding = await getEmbedding(learnerNote);
  const systemEmbedding = await getEmbedding(systemExplanation);
  
  // Cosine similarity
  const similarity = cosineSimilarity(noteEmbedding, systemEmbedding);
  
  // Similar logic to lexical overlap
  // High similarity = same meaning, different words (good paraphrase)
  // Low similarity = different meaning
  
  if (similarity < 0.5) return similarity / 0.5;
  if (similarity <= 0.8) return 1.0;
  return 1.0 - (similarity - 0.8) / 0.2;
}
```

---

#### Component 4: Concept Keywords

Count SQL-specific terms in the note.

```typescript
const SQL_KEYWORDS = [
  'select', 'from', 'where', 'join', 'group by', 'having',
  'order by', 'limit', 'distinct', 'aggregate', 'count', 'sum',
  'subquery', 'correlated', 'inner join', 'outer join'
];

function calculateKeywordScore(content: string): number {
  const contentLower = content.toLowerCase();
  const keywordsFound = SQL_KEYWORDS.filter(kw =>
    contentLower.includes(kw.toLowerCase())
  );
  
  // Normalize: 0 keywords = 0.0, 5+ keywords = 1.0
  return Math.min(1.0, keywordsFound.length / 5);
}
```

**Rationale**: Notes with technical keywords show engagement with concept.

---

#### Component 5: Example Presence

Does the note include a SQL code example?

```typescript
function calculateExampleScore(content: string): number {
  // Check for code block
  const hasCodeBlock = /```sql/.test(content);
  
  // Check for inline SQL
  const hasInlineSQL = /\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(content);
  
  if (hasCodeBlock) return 1.0;
  if (hasInlineSQL) return 0.7;
  return 0.0;
}
```

**Rationale**: Self-generated examples demonstrate understanding.

---

#### Component 6: Structure Quality

Does the note have organization (headers, bullets)?

```typescript
function calculateStructureScore(content: string): number {
  const hasHeaders = /^#{1,3} /m.test(content);  // Markdown headers
  const hasBullets = /^[\*\-] /m.test(content);   // Bullet points
  const hasNumbering = /^\d+\. /m.test(content); // Numbered lists
  
  let score = 0;
  if (hasHeaders) score += 0.4;
  if (hasBullets) score += 0.3;
  if (hasNumbering) score += 0.3;
  
  return Math.min(1.0, score);
}
```

**Rationale**: Structure indicates thoughtful organization.

---

## RQS Formula

```typescript
interface RQSWeights {
  length: number;
  lexicalOverlap: number;
  paraphrase: number;
  keywords: number;
  example: number;
  structure: number;
}

const DEFAULT_RQS_WEIGHTS: RQSWeights = {
  length: 0.15,
  lexicalOverlap: 0.20,
  paraphrase: 0.25,
  keywords: 0.15,
  example: 0.15,
  structure: 0.10
};

async function calculateRQS(
  learnerNote: string,
  systemExplanation: string,
  weights: RQSWeights = DEFAULT_RQS_WEIGHTS
): Promise<number> {
  const length = calculateLengthScore(learnerNote);
  const lexical = calculateLexicalOverlap(learnerNote, systemExplanation);
  const paraphrase = await calculateParaphraseScore(learnerNote, systemExplanation);
  const keywords = calculateKeywordScore(learnerNote);
  const example = calculateExampleScore(learnerNote);
  const structure = calculateStructureScore(learnerNote);
  
  const rqs =
    weights.length * length +
    weights.lexicalOverlap * lexical +
    weights.paraphrase * paraphrase +
    weights.keywords * keywords +
    weights.example * example +
    weights.structure * structure;
  
  return Math.max(0, Math.min(1, rqs));
}
```

---

## RQS Thresholds

| Level | RQS Range | Interpretation | Action |
|-------|-----------|----------------|--------|
| **High** | 0.7 - 1.0 | Excellent reflection | Prioritize in review |
| **Medium** | 0.4 - 0.7 | Adequate reflection | Standard handling |
| **Low** | 0.0 - 0.4 | Poor reflection | Suggest improvement |

---

## Interventions Based on RQS

### Low RQS (< 0.4)

```typescript
function handleLowRQS(
  learnerId: string,
  unit: InstructionalUnit,
  rqs: number,
  breakdown: RQSBreakdown
): void {
  const suggestions: string[] = [];
  
  if (breakdown.length < 0.5) {
    suggestions.push('Try expanding your note with more detail.');
  }
  
  if (breakdown.lexicalOverlap > 0.8) {
    suggestions.push('Try to paraphrase in your own words rather than copying.');
  }
  
  if (breakdown.keywords < 0.3) {
    suggestions.push('Include key SQL terms to show you understand the concept.');
  }
  
  if (breakdown.example < 0.5) {
    suggestions.push('Add a SQL code example to demonstrate your understanding.');
  }
  
  showNotification(learnerId, {
    title: 'Improve Your Note',
    message: suggestions.join(' '),
    action: {
      label: 'Edit Note',
      handler: () => openNoteEditor(unit.id)
    }
  });
  
  logEvent({
    eventType: 'low_rqs_intervention',
    learnerId,
    unitId: unit.id,
    rqs,
    suggestions
  });
}
```

### High RQS (> 0.7)

```typescript
function handleHighRQS(
  learnerId: string,
  unit: InstructionalUnit,
  rqs: number
): void {
  // Positive reinforcement
  showNotification(learnerId, {
    title: 'Excellent Reflection!',
    message: 'This is a well-crafted note. It will be helpful for review.'
  });
  
  // Mark for prioritized review
  markAsHighQuality(unit.id);
  
  // Consider sharing (anonymized) as example
  if (Math.random() < 0.1) {  // 10% chance
    suggestAsExample(learnerId, unit);
  }
}
```

---

## RQS Trends

Track RQS over time to measure reflection skill development.

```typescript
interface RQSTrend {
  learnerId: string;
  measurements: Array<{
    timestamp: number;
    rqs: number;
    unitId: string;
  }>;
  trend: 'improving' | 'stable' | 'declining';
  slope: number;  // RQS change per week
}

function analyzeRQSTrend(
  learnerHistory: LearnerHistory
): RQSTrend {
  const rqsEvents = learnerHistory.events
    .filter(e => e.eventType === 'rqs_calculated')
    .sort((a, b) => a.timestamp - b.timestamp);
  
  if (rqsEvents.length < 3) {
    return { learnerId: learnerHistory.learnerId, measurements: [], trend: 'stable', slope: 0 };
  }
  
  // Linear regression
  const n = rqsEvents.length;
  const sumX = rqsEvents.reduce((sum, e, i) => sum + i, 0);
  const sumY = rqsEvents.reduce((sum, e) => sum + e.rqs, 0);
  const sumXY = rqsEvents.reduce((sum, e, i) => sum + i * e.rqs, 0);
  const sumX2 = rqsEvents.reduce((sum, e, i) => sum + i * i, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  const trend = slope > 0.05 ? 'improving' :
                slope < -0.05 ? 'declining' : 'stable';
  
  return {
    learnerId: learnerHistory.learnerId,
    measurements: rqsEvents.map(e => ({
      timestamp: e.timestamp,
      rqs: e.rqs,
      unitId: e.unitId
    })),
    trend,
    slope
  };
}
```

---

## Logging Schema

### Event: `rqs_calculated`

```typescript
{
  eventType: 'rqs_calculated',
  timestamp: number,
  learnerId: string,
  unitId: string,
  rqs: number,  // 0-1
  level: 'high' | 'medium' | 'low',
  breakdown: {
    length: number;
    lexicalOverlap: number;
    paraphrase: number;
    keywords: number;
    example: number;
    structure: number;
  },
  noteLength: number;
  hasCodeBlock: boolean;
}
```

### Event: `rqs_intervention_triggered`

```typescript
{
  eventType: 'rqs_intervention_triggered',
  timestamp: number,
  learnerId: string,
  unitId: string,
  rqs: number,
  interventionType: 'suggest_improvement' | 'positive_reinforcement' | 'mark_high_quality';
  suggestions?: string[];
}
```

---

## Research Questions

1. **Does high RQS predict retention?**
   - Test: Compare recall accuracy for high vs low RQS notes

2. **Does RQS improve over time?**
   - Track RQS trend per learner

3. **Which RQS components matter most?**
   - Correlation analysis of components with outcomes

4. **Can we train better reflection?**
   - Do interventions improve subsequent RQS?

---

## Implementation Roadmap

### Week 10: Core RQS
- [ ] Implement all 6 components
- [ ] RQS calculation function
- [ ] Threshold-based interventions

### Week 11: Analysis
- [ ] RQS trend tracking
- [ ] Correlation with retention
- [ ] Dashboard visualization

### Week 12: Refinement
- [ ] Weight tuning
- [ ] Component validation
- [ ] Publication analysis
