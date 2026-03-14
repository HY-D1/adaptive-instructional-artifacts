/**
 * Reflection Scorer
 * 
 * Scores reflection quality on RQS scale (1-5), detects self-explanation depth in user inputs,
 * logs reflection_quality_assessed events, and uses scores to adapt hint specificity.
 * 
 * RQS (Reflection Quality Scale):
 * 1 - Surface: Copies from source, no original thought
 * 2 - Shallow: Restates with minimal changes
 * 3 - Developing: Some original explanation, basic structure
 * 4 - Good: Clear explanation with examples and reasoning
 * 5 - Excellent: Comprehensive with root cause, fix, and prevention
 * 
 * Features:
 * - Score reflection quality on RQS scale (1-5)
 * - Detect self-explanation depth in user inputs
 * - Log reflection_quality_assessed events
 * - Use scores to adapt hint specificity
 */

import type { InteractionEvent } from '../../types';
import { storage } from '../storage/storage';
import { createEventId } from '../utils/event-id';

export type RQSLevel = 1 | 2 | 3 | 4 | 5;

export interface ReflectionScore {
  rqs: RQSLevel;
  overall: number;              // 0-100 composite score
  dimensions: {
    paraphrase: number;         // 0-100 (original phrasing vs copying)
    specificity: number;        // 0-100 (concrete vs vague)
    structure: number;          // 0-100 (organized explanation)
    depth: number;              // 0-100 (surface vs deep understanding)
    selfExplanation: number;    // 0-100 (generative processing)
  };
  feedback: string[];
  flaggedIssues: string[];
  adaptation: {
    hintSpecificity: 'high' | 'medium' | 'low';  // Lower RQS = more specific hints
    shouldPromptForMore: boolean;
    suggestedFocus: string[];
  };
}

export interface ReflectionAssessment {
  id: string;
  learnerId: string;
  timestamp: number;
  problemId: string;
  conceptIds: string[];
  reflectionText: string;
  score: ReflectionScore;
  context: {
    promptType: 'error_reflection' | 'explanation_request' | 'chat_response' | 'note_creation';
    hintLevelSeen: number;
    attemptsBeforeReflection: number;
  };
}

// RQS level descriptions
const RQS_DESCRIPTIONS: Record<RQSLevel, string> = {
  1: 'Surface copying - verbatim or near-verbatim reproduction',
  2: 'Shallow restatement - minimal paraphrasing without understanding',
  3: 'Developing explanation - some original thought, basic structure',
  4: 'Good reflection - clear explanation with reasoning and examples',
  5: 'Excellent self-explanation - comprehensive with cause, fix, and prevention'
};

// Keywords for depth detection
const DEPTH_INDICATORS = {
  surface: [
    'the error says', 'it says', 'according to', 'as stated', 'the hint says'
  ],
  shallow: [
    'i need to', 'should use', 'fix by', 'change to'
  ],
  developing: [
    'because', 'so that', 'this means', 'in order to'
  ],
  good: [
    'the problem is', 'the issue is', 'caused by', 'results in'
  ],
  excellent: [
    'root cause', 'underlying', 'prevent this', 'next time',
    'in the future', 'to avoid', 'i understand that'
  ]
};

// Structural indicators
const STRUCTURAL_INDICATORS = {
  rootCause: /\b(because|caused by|the reason|root cause|the problem is|due to|why this happened)\b/i,
  solution: /\b(should|need to|fix|solution|correct|instead|resolve|solve|change)\b/i,
  prevention: /\b(next time|prevent|avoid|remember|make sure|ensure|check|in the future)\b/i,
  example: /\b(for example|like|such as|instance|e\.g\.|specifically)\b/i
};

/**
 * Score reflection quality from user input
 * @param reflectionText - User's reflection/explanation text
 * @param conceptIds - Related concept IDs
 * @param context - Assessment context
 * @returns Reflection score with RQS level
 */
export function scoreReflection(
  reflectionText: string,
  conceptIds: string[],
  context: ReflectionAssessment['context']
): ReflectionScore {
  const dimensions = calculateDimensions(reflectionText, conceptIds);
  
  // Calculate composite score (0-100)
  const overall = Math.round(
    dimensions.paraphrase * 0.20 +
    dimensions.specificity * 0.20 +
    dimensions.structure * 0.20 +
    dimensions.depth * 0.25 +
    dimensions.selfExplanation * 0.15
  );
  
  // Map to RQS level
  const rqs = scoreToRQS(overall);
  
  // Generate feedback
  const feedback = generateFeedback(dimensions, rqs);
  
  // Detect issues
  const flaggedIssues = detectIssues(dimensions, reflectionText);
  
  // Calculate adaptation recommendations
  const adaptation = calculateAdaptation(rqs, dimensions, context);
  
  return {
    rqs,
    overall,
    dimensions,
    feedback,
    flaggedIssues,
    adaptation
  };
}

/**
 * Assess and log a reflection
 * @param learnerId - Learner identifier
 * @param problemId - Problem identifier
 * @param reflectionText - User's reflection
 * @param conceptIds - Related concepts
 * @param context - Assessment context
 * @returns Complete assessment
 */
export function assessReflection(
  learnerId: string,
  problemId: string,
  reflectionText: string,
  conceptIds: string[],
  context: ReflectionAssessment['context']
): ReflectionAssessment {
  const score = scoreReflection(reflectionText, conceptIds, context);
  
  const assessment: ReflectionAssessment = {
    id: createEventId('reflection', 'assessment'),
    learnerId,
    timestamp: Date.now(),
    problemId,
    conceptIds,
    reflectionText,
    score,
    context
  };
  
  // Log the assessment
  logReflectionAssessment(assessment);
  
  return assessment;
}

/**
 * Get adaptation recommendation based on reflection history
 * @param learnerId - Learner identifier
 * @returns Adaptation settings
 */
export function getReflectionBasedAdaptation(
  learnerId: string
): {
  hintSpecificity: 'high' | 'medium' | 'low';
  reflectionPromptsEnabled: boolean;
  requireReflection: boolean;
} {
  const assessments = getRecentAssessments(learnerId, 10);
  
  if (assessments.length === 0) {
    return {
      hintSpecificity: 'medium',
      reflectionPromptsEnabled: true,
      requireReflection: false
    };
  }
  
  const averageRQS = assessments.reduce((sum, a) => sum + a.score.rqs, 0) / assessments.length;
  
  // Lower RQS = more specific hints needed
  const hintSpecificity = averageRQS < 2.5 ? 'high' : 
                          averageRQS < 3.5 ? 'medium' : 'low';
  
  // Enable reflection prompts if struggling
  const reflectionPromptsEnabled = averageRQS < 3;
  
  // Require reflection for very low quality
  const requireReflection = averageRQS < 2;
  
  return {
    hintSpecificity,
    reflectionPromptsEnabled,
    requireReflection
  };
}

/**
 * Get learner's reflection history
 * @param learnerId - Learner identifier
 * @param limit - Maximum number of assessments
 * @returns Recent assessments
 */
export function getReflectionHistory(
  learnerId: string,
  limit: number = 20
): ReflectionAssessment[] {
  return getRecentAssessments(learnerId, limit);
}

/**
 * Get reflection statistics for a learner
 * @param learnerId - Learner identifier
 * @returns Reflection statistics
 */
export function getReflectionStats(learnerId: string): {
  totalAssessments: number;
  averageRQS: number;
  rqsDistribution: Record<RQSLevel, number>;
  trend: 'improving' | 'stable' | 'declining';
  averageDepth: number;
} {
  const assessments = getRecentAssessments(learnerId, 50);
  
  if (assessments.length === 0) {
    return {
      totalAssessments: 0,
      averageRQS: 0,
      rqsDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      trend: 'stable',
      averageDepth: 0
    };
  }
  
  const rqsScores = assessments.map(a => a.score.rqs);
  const averageRQS = rqsScores.reduce((a, b) => a + b, 0) / rqsScores.length;
  
  // Distribution
  const rqsDistribution: Record<RQSLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rqsScores.forEach(rqs => rqsDistribution[rqs]++);
  
  // Trend
  const firstHalf = rqsScores.slice(0, Math.floor(rqsScores.length / 2));
  const secondHalf = rqsScores.slice(Math.floor(rqsScores.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const trend = secondAvg > firstAvg * 1.1 ? 'improving' :
                secondAvg < firstAvg * 0.9 ? 'declining' : 'stable';
  
  // Average depth score
  const averageDepth = assessments.reduce((sum, a) => sum + a.score.dimensions.depth, 0) / assessments.length;
  
  return {
    totalAssessments: assessments.length,
    averageRQS: Math.round(averageRQS * 10) / 10,
    rqsDistribution,
    trend,
    averageDepth: Math.round(averageDepth)
  };
}

/**
 * Calculate all dimension scores
 */
function calculateDimensions(
  text: string,
  conceptIds: string[]
): ReflectionScore['dimensions'] {
  return {
    paraphrase: scoreParaphrase(text),
    specificity: scoreSpecificity(text),
    structure: scoreStructure(text),
    depth: scoreDepth(text, conceptIds),
    selfExplanation: scoreSelfExplanation(text)
  };
}

/**
 * Score paraphrase vs copying (0-100)
 */
function scoreParaphrase(text: string): number {
  const textLower = text.toLowerCase();
  
  // Check for surface indicators
  const surfaceMatches = DEPTH_INDICATORS.surface.filter(w => textLower.includes(w)).length;
  
  // Check for unique words ratio
  const words = text.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')));
  const uniqueRatio = uniqueWords.size / words.length;
  
  // Penalty for surface copying
  const surfacePenalty = Math.min(50, surfaceMatches * 15);
  
  // Bonus for vocabulary diversity
  const diversityBonus = Math.round(uniqueRatio * 30);
  
  return Math.max(0, Math.min(100, 50 + diversityBonus - surfacePenalty));
}

/**
 * Score specificity (0-100)
 */
function scoreSpecificity(text: string): number {
  const textLower = text.toLowerCase();
  
  // Check for concrete examples
  const hasCodeBlock = /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  const hasExample = /\b(example|for instance|like|such as|specifically)\b/i.test(text);
  const hasConcrete = /\b(table|column|row|query|database|join|where|select)\b/i.test(text);
  
  // Check for vague language
  const vagueWords = ['stuff', 'things', 'something', 'anything', 'everything'];
  const vagueCount = vagueWords.filter(w => textLower.includes(w)).length;
  
  let score = 50;
  if (hasCodeBlock) score += 20;
  if (hasExample) score += 15;
  if (hasConcrete) score += 15;
  score -= vagueCount * 10;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Score structural completeness (0-100)
 */
function scoreStructure(text: string): number {
  let score = 0;
  
  // Check for structural elements
  if (STRUCTURAL_INDICATORS.rootCause.test(text)) score += 25;
  if (STRUCTURAL_INDICATORS.solution.test(text)) score += 25;
  if (STRUCTURAL_INDICATORS.prevention.test(text)) score += 25;
  if (STRUCTURAL_INDICATORS.example.test(text)) score += 25;
  
  return score;
}

/**
 * Score depth of understanding (0-100)
 */
function scoreDepth(text: string, conceptIds: string[]): number {
  const textLower = text.toLowerCase();
  
  // Count depth indicators
  let depthScore = 0;
  
  // Excellent indicators
  const excellentMatches = DEPTH_INDICATORS.excellent.filter(w => 
    textLower.includes(w)
  ).length;
  depthScore += excellentMatches * 15;
  
  // Good indicators
  const goodMatches = DEPTH_INDICATORS.good.filter(w => 
    textLower.includes(w)
  ).length;
  depthScore += goodMatches * 10;
  
  // Developing indicators
  const developingMatches = DEPTH_INDICATORS.developing.filter(w => 
    textLower.includes(w)
  ).length;
  depthScore += developingMatches * 5;
  
  // Check for concept keywords
  const conceptTerms = conceptIds.flatMap(getConceptTerms);
  const matchedTerms = conceptTerms.filter(term => 
    textLower.includes(term.toLowerCase())
  ).length;
  depthScore += Math.min(20, matchedTerms * 5);
  
  return Math.min(100, depthScore);
}

/**
 * Score self-explanation quality (0-100)
 */
function scoreSelfExplanation(text: string): number {
  const textLower = text.toLowerCase();
  
  // Check for generative processing indicators
  const generativeIndicators = [
    'i think', 'i understand', 'i see', 'i realize', 
    'this means', 'so', 'therefore', 'thus'
  ];
  
  const generativeMatches = generativeIndicators.filter(w => 
    textLower.includes(w)
  ).length;
  
  // Check for word count (self-explanations should be substantive)
  const wordCount = text.split(/\s+/).length;
  const lengthScore = wordCount < 20 ? wordCount * 2 : 
                      wordCount > 200 ? 40 : 40 + (wordCount - 20) / 5;
  
  return Math.min(100, generativeMatches * 10 + lengthScore);
}

/**
 * Convert composite score to RQS level
 */
function scoreToRQS(score: number): RQSLevel {
  if (score >= 80) return 5;
  if (score >= 65) return 4;
  if (score >= 50) return 3;
  if (score >= 35) return 2;
  return 1;
}

/**
 * Generate feedback based on scores
 */
function generateFeedback(
  dimensions: ReflectionScore['dimensions'],
  rqs: RQSLevel
): string[] {
  const feedback: string[] = [];
  
  if (dimensions.paraphrase < 50) {
    feedback.push('Try to explain in your own words rather than copying.');
  }
  if (dimensions.specificity < 50) {
    feedback.push('Include specific examples or code snippets.');
  }
  if (dimensions.structure < 50) {
    feedback.push('Structure your explanation: what caused the issue, how to fix it, and how to prevent it.');
  }
  if (dimensions.depth < 50) {
    feedback.push('Go deeper - explain why this works, not just what to do.');
  }
  if (dimensions.selfExplanation < 50) {
    feedback.push('Connect this to what you already know.');
  }
  
  if (feedback.length === 0) {
    if (rqs >= 4) {
      feedback.push('Excellent reflection! You\'ve demonstrated deep understanding.');
    } else {
      feedback.push('Good reflection. Keep practicing detailed explanations.');
    }
  }
  
  return feedback;
}

/**
 * Detect issues in reflection
 */
function detectIssues(
  dimensions: ReflectionScore['dimensions'],
  text: string
): string[] {
  const issues: string[] = [];
  
  if (dimensions.paraphrase < 30) issues.push('EXCESSIVE_COPYING');
  if (text.length < 50) issues.push('TOO_SHORT');
  if (text.length > 1000) issues.push('TOO_LONG');
  if (dimensions.structure < 30) issues.push('LACKS_STRUCTURE');
  if (dimensions.specificity < 30) issues.push('TOO_VAGUE');
  
  return issues;
}

/**
 * Calculate adaptation recommendations
 */
function calculateAdaptation(
  rqs: RQSLevel,
  dimensions: ReflectionScore['dimensions'],
  context: ReflectionAssessment['context']
): ReflectionScore['adaptation'] {
  // Lower RQS = more specific hints needed
  const hintSpecificity = rqs <= 2 ? 'high' : 
                          rqs <= 3 ? 'medium' : 'low';
  
  // Prompt for more if shallow
  const shouldPromptForMore = rqs < 3 || dimensions.structure < 50;
  
  // Suggest focus areas
  const suggestedFocus: string[] = [];
  if (dimensions.paraphrase < 60) suggestedFocus.push('paraphrasing');
  if (dimensions.specificity < 60) suggestedFocus.push('specificity');
  if (dimensions.structure < 60) suggestedFocus.push('structure');
  if (dimensions.depth < 60) suggestedFocus.push('depth');
  
  return {
    hintSpecificity,
    shouldPromptForMore,
    suggestedFocus
  };
}

/**
 * Get concept terms for keyword checking
 */
function getConceptTerms(conceptId: string): string[] {
  const termMap: Record<string, string[]> = {
    'select-basic': ['select', 'column', 'from', 'table', 'retrieve', 'query'],
    'where-clause': ['where', 'filter', 'condition', 'predicate', 'criteria'],
    'joins': ['join', 'inner join', 'left join', 'combine', 'tables', 'relate', 'merge', 'on'],
    'aggregation': ['aggregate', 'count', 'sum', 'avg', 'average', 'group', 'max', 'min'],
    'group-by': ['group by', 'grouping', 'categories', 'partition', 'rollup'],
    'subqueries': ['subquery', 'nested', 'inner query', 'correlated', 'exists', 'in'],
    'order-by': ['order by', 'sort', 'ascending', 'descending', 'sequence'],
    'having-clause': ['having', 'filter groups', 'aggregate condition'],
    'alias': ['alias', 'as', 'rename', 'temporary name'],
    'distinct': ['distinct', 'unique', 'no duplicates'],
    'null-handling': ['null', 'is null', 'coalesce', 'nvl', 'missing'],
    'string-functions': ['concat', 'upper', 'lower', 'substring', 'trim', 'length'],
    'date-functions': ['date', 'current_date', 'extract', 'interval', 'timestamp'],
    'case-expression': ['case', 'when', 'then', 'else', 'conditional']
  };
  
  return termMap[conceptId] || [conceptId.replace(/-/g, ' ')];
}

/**
 * Log reflection assessment event
 */
function logReflectionAssessment(assessment: ReflectionAssessment): void {
  const event: InteractionEvent = {
    id: assessment.id,
    sessionId: storage.getActiveSessionId(),
    learnerId: assessment.learnerId,
    timestamp: assessment.timestamp,
    eventType: 'reflection_quality_assessed',
    problemId: assessment.problemId,
    conceptIds: assessment.conceptIds,
    metadata: {
      rqs: assessment.score.rqs,
      overall: assessment.score.overall,
      dimensions: assessment.score.dimensions,
      adaptation: assessment.score.adaptation,
      context: assessment.context
    }
  };
  
  storage.saveInteraction(event);
}

/**
 * Get recent assessments from storage
 */
function getRecentAssessments(
  learnerId: string,
  limit: number
): ReflectionAssessment[] {
  const interactions = storage.getInteractionsByLearner(learnerId)
    .filter(i => i.eventType === 'reflection_quality_assessed')
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
  
  return interactions.map(i => ({
    id: i.id,
    learnerId: i.learnerId,
    timestamp: i.timestamp,
    problemId: i.problemId,
    conceptIds: i.conceptIds || [],
    reflectionText: i.metadata?.reflectionText as string || '',
    score: {
      rqs: (i.metadata?.rqs as RQSLevel) || 3,
      overall: (i.metadata?.overall as number) || 50,
      dimensions: (i.metadata?.dimensions as ReflectionScore['dimensions']) || {
        paraphrase: 50, specificity: 50, structure: 50, depth: 50, selfExplanation: 50
      },
      feedback: (i.metadata?.feedback as string[]) || [],
      flaggedIssues: (i.metadata?.flaggedIssues as string[]) || [],
      adaptation: (i.metadata?.adaptation as ReflectionScore['adaptation']) || {
        hintSpecificity: 'medium',
        shouldPromptForMore: false,
        suggestedFocus: []
      }
    },
    context: (i.metadata?.context as ReflectionAssessment['context']) || {
      promptType: 'error_reflection',
      hintLevelSeen: 1,
      attemptsBeforeReflection: 1
    }
  }));
}

/**
 * Quick check if text meets minimum quality
 */
export function meetsMinimumQuality(text: string, minRQS: RQSLevel = 3): boolean {
  const score = scoreReflection(text, [], {
    promptType: 'error_reflection',
    hintLevelSeen: 1,
    attemptsBeforeReflection: 1
  });
  return score.rqs >= minRQS;
}

/**
 * Get RQS level description
 */
export function getRQSDescription(rqs: RQSLevel): string {
  return RQS_DESCRIPTIONS[rqs];
}
