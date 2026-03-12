/**
 * Reflection Quality Scorer (RQS)
 * 
 * Measures self-explanation quality across 5 dimensions:
 * - Paraphrase: Original phrasing vs copying
 * - Length: Appropriate word count
 * - Concept Keywords: Technical term usage
 * - Example Inclusion: Concrete examples/code
 * - Structural Completeness: Root cause, fix, prevention
 */

export interface SelfExplanationInput {
  text: string;
  originalProblem: string;
  conceptIds: string[];
  learnerId: string;
}

export interface ReflectionQualityScore {
  overall: number;           // 0-100 composite score
  dimensions: {
    paraphrase: number;      // 0-100 (vs direct copying)
    length: number;          // 0-100 (appropriate length)
    conceptKeywords: number; // 0-100 (concept terms used)
    exampleInclusion: number;// 0-100 (concrete examples)
    structuralCompleteness: number; // 0-100 (has root cause, fix, prevention)
  };
  feedback: string[];        // Specific improvement suggestions
  flaggedIssues: string[];   // Problems detected
}

/**
 * Score self-explanation quality
 */
export function scoreSelfExplanation(
  input: SelfExplanationInput
): ReflectionQualityScore {
  const dimensions = {
    paraphrase: scoreParaphrase(input.text, input.originalProblem),
    length: scoreLength(input.text),
    conceptKeywords: scoreConceptKeywords(input.text, input.conceptIds),
    exampleInclusion: scoreExampleInclusion(input.text),
    structuralCompleteness: scoreStructure(input.text)
  };
  
  const overall = Math.round(
    dimensions.paraphrase * 0.25 +
    dimensions.length * 0.15 +
    dimensions.conceptKeywords * 0.25 +
    dimensions.exampleInclusion * 0.15 +
    dimensions.structuralCompleteness * 0.20
  );
  
  return {
    overall,
    dimensions,
    feedback: generateFeedback(dimensions),
    flaggedIssues: detectIssues(dimensions)
  };
}

/**
 * Score paraphrase vs copying (0-100)
 * Higher = more original phrasing, less copying
 */
function scoreParaphrase(text: string, original: string): number {
  const textLower = text.toLowerCase();
  const originalLower = original.toLowerCase();
  
  // Extract significant words (4+ chars) from original
  const originalWords = originalLower
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w));
  
  if (originalWords.length === 0) return 50;
  
  // Count exact phrase matches (3+ words)
  let copiedPhrases = 0;
  for (let i = 0; i < originalWords.length - 2; i++) {
    const phrase = originalWords.slice(i, i + 3).join(' ');
    if (textLower.includes(phrase)) {
      copiedPhrases++;
    }
  }
  
  // Calculate ratio
  const maxPossiblePhrases = Math.max(1, originalWords.length - 2);
  const copyRatio = copiedPhrases / maxPossiblePhrases;
  
  // Score: less copying = higher score
  return Math.round((1 - copyRatio) * 100);
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'with', 'they', 'this', 'that', 'have', 'from',
  'select', 'where', 'table', 'query', 'when', 'what', 'how', 'why', 'who',
  'which', 'while', 'will', 'would', 'could', 'should'
]);

/**
 * Score appropriate length (0-100)
 * Sweet spot: 50-200 words
 */
function scoreLength(text: string): number {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  if (words < 20) return Math.round((words / 20) * 50); // Too short
  if (words >= 50 && words <= 200) return 100; // Sweet spot
  if (words > 200 && words <= 300) return Math.round(100 - ((words - 200) / 100) * 30); // Getting long
  if (words > 300) return Math.max(40, Math.round(70 - ((words - 300) / 100) * 10)); // Too long
  
  return Math.round((words / 50) * 100); // Approaching sweet spot (20-50 words)
}

/**
 * Score concept keyword usage (0-100)
 */
function scoreConceptKeywords(text: string, conceptIds: string[]): number {
  if (conceptIds.length === 0) return 50;
  
  const textLower = text.toLowerCase();
  const conceptTerms = conceptIds.flatMap(getConceptTerms);
  
  const matchedTerms = conceptTerms.filter(term => 
    textLower.includes(term.toLowerCase())
  );
  
  const uniqueMatched = new Set(matchedTerms).size;
  const uniqueTotal = new Set(conceptTerms).size;
  
  if (uniqueTotal === 0) return 50;
  
  return Math.round((uniqueMatched / Math.min(uniqueTotal, 5)) * 100);
}

/**
 * Get concept terms for a concept ID
 */
function getConceptTerms(conceptId: string): string[] {
  const termMap: Record<string, string[]> = {
    'select-basic': ['select', 'column', 'from', 'table', 'retrieve'],
    'where-clause': ['where', 'filter', 'condition', 'predicate', 'criteria'],
    'joins': ['join', 'inner join', 'left join', 'combine', 'tables', 'relate', 'merge'],
    'join-operations': ['join', 'inner join', 'left join', 'combine', 'tables', 'relate', 'merge'],
    'aggregation': ['aggregate', 'count', 'sum', 'avg', 'average', 'group', 'max', 'min'],
    'group-by': ['group by', 'grouping', 'categories', 'partition', 'rollup'],
    'subqueries': ['subquery', 'nested', 'inner query', 'correlated', 'exists', 'in'],
    'order-by': ['order by', 'sort', 'ascending', 'descending', 'sequence'],
    'having': ['having', 'filter groups', 'aggregate condition'],
    'aliases': ['alias', 'as', 'rename', 'temporary name'],
    'distinct': ['distinct', 'unique', 'no duplicates'],
    'null-handling': ['null', 'is null', 'coalesce', 'nvl', 'missing'],
    'string-functions': ['concat', 'upper', 'lower', 'substring', 'trim', 'length'],
    'date-functions': ['date', 'current_date', 'extract', 'interval', 'timestamp'],
    'case-expressions': ['case', 'when', 'then', 'else', 'conditional']
  };
  return termMap[conceptId] || [conceptId.replace(/-/g, ' ')];
}

/**
 * Score example inclusion (0-100)
 */
function scoreExampleInclusion(text: string): number {
  const hasCodeBlock = /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  const hasExamplePhrase = /\b(example|for instance|like|such as|e\.g\.|i\.e\.)\b/i.test(text);
  const hasConcreteValue = /\b(users|orders|customers|products|employees|departments|sales)\b/i.test(text);
  
  let score = 0;
  if (hasCodeBlock) score += 40;
  if (hasExamplePhrase) score += 30;
  if (hasConcreteValue) score += 30;
  
  return score;
}

/**
 * Score structural completeness (0-100)
 */
function scoreStructure(text: string): number {
  const textLower = text.toLowerCase();
  
  const hasRootCause = /\b(because|reason|caused by|the problem is|issue is|root cause|due to)\b/i.test(textLower);
  const hasFix = /\b(should|need to|fix|solution|correct way|instead|resolve|use|try)\b/i.test(textLower);
  const hasPrevention = /\b(next time|prevent|avoid|remember|make sure|check|ensure)\b/i.test(textLower);
  
  let score = 0;
  if (hasRootCause) score += 35;
  if (hasFix) score += 35;
  if (hasPrevention) score += 30;
  
  return score;
}

/**
 * Generate feedback based on dimension scores
 */
function generateFeedback(dimensions: ReflectionQualityScore['dimensions']): string[] {
  const feedback: string[] = [];
  
  if (dimensions.paraphrase < 50) {
    feedback.push('Try to explain in your own words rather than copying from the hint.');
  }
  if (dimensions.length < 50) {
    feedback.push('Your explanation is quite brief. Try to elaborate more on your understanding.');
  }
  if (dimensions.length > 90) {
    feedback.push('Your explanation is quite long. Try to be more concise and focused.');
  }
  if (dimensions.conceptKeywords < 50) {
    feedback.push('Include more technical terms related to the concept to demonstrate understanding.');
  }
  if (dimensions.exampleInclusion < 50) {
    feedback.push('Add a concrete example or code snippet to illustrate your understanding.');
  }
  if (dimensions.structuralCompleteness < 60) {
    feedback.push('Structure your explanation with: what caused the error, how to fix it, and how to prevent it.');
  }
  
  if (feedback.length === 0) {
    feedback.push('Great reflection! You\'ve demonstrated solid understanding of the concept.');
  }
  
  return feedback;
}

/**
 * Detect issues that should be flagged
 */
function detectIssues(dimensions: ReflectionQualityScore['dimensions']): string[] {
  const issues: string[] = [];
  
  if (dimensions.paraphrase < 30) issues.push('EXCESSIVE_COPYING');
  if (dimensions.length < 20) issues.push('TOO_SHORT');
  if (dimensions.length > 95) issues.push('TOO_LONG');
  if (dimensions.conceptKeywords < 20) issues.push('MISSING_KEYWORDS');
  
  return issues;
}

/**
 * Quick quality check for real-time feedback
 * Returns true if the text meets minimum quality standards
 */
export function meetsMinimumQuality(
  text: string,
  conceptIds: string[],
  minScore = 50
): boolean {
  const score = scoreSelfExplanation({
    text,
    originalProblem: '',
    conceptIds,
    learnerId: 'check'
  });
  return score.overall >= minScore;
}

/**
 * Get quality level label
 */
export function getQualityLevel(overall: number): 'excellent' | 'good' | 'needs-work' {
  if (overall >= 80) return 'excellent';
  if (overall >= 60) return 'good';
  return 'needs-work';
}
