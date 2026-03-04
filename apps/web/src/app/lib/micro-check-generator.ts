/**
 * Micro-Check Generator (Component 10)
 *
 * Generates micro-checks (quizzes) from instructional unit content.
 * Supports three types of assessments:
 * - MCQ (Multiple Choice Question)
 * - SQL completion (fill-in-the-blank SQL)
 * - Concept explanation (open-ended)
 *
 * Content extraction strategy:
 * - Extract key concepts from unit.content
 * - Use unit.summary for question stems
 * - Use unit.minimalExample for SQL patterns
 * - Use unit.commonMistakes for distractors
 */

import type { InstructionalUnit } from '../types';

// Extend ImportMeta for Vitest inline tests
declare global {
  // eslint-disable-next-line no-var
  interface ImportMeta {
    vitest?: typeof import('vitest');
  }
}

/**
 * Type of micro-check assessment
 */
export type MicroCheckType = 'mcq' | 'sql_completion' | 'concept_explanation';

/**
 * Difficulty level for a micro-check
 */
export type MicroCheckDifficulty = 'easy' | 'medium' | 'hard';

/**
 * A micro-check (quiz) generated from instructional unit content
 */
export interface MicroCheck {
  /** Unique identifier for the micro-check */
  id: string;
  /** Type of assessment */
  type: MicroCheckType;
  /** Question text */
  question: string;
  /** Options for MCQ (undefined for other types) */
  options?: string[];
  /** Correct answer (for MCQ: option text; for SQL: SQL code; for explanation: expected keywords) */
  correctAnswer: string;
  /** Explanation of the correct answer */
  explanation: string;
  /** Primary concept ID this check assesses */
  conceptId: string;
  /** Source unit ID */
  unitId: string;
  /** Difficulty level */
  difficulty: MicroCheckDifficulty;
}

/**
 * MCQ option with correctness flag
 */
export interface MCQOption {
  /** Unique identifier for the option */
  id: string;
  /** Option text */
  text: string;
  /** Whether this is the correct answer */
  isCorrect: boolean;
}

/**
 * Result of a learner's micro-check submission
 */
export interface MicroCheckResult {
  /** ID of the micro-check */
  checkId: string;
  /** Learner identifier */
  learnerId: string;
  /** Learner's response */
  response: string;
  /** Whether the response was correct */
  isCorrect: boolean;
  /** Time spent on the check in milliseconds */
  timeSpentMs: number;
  /** Timestamp when submitted */
  submittedAt: number;
}

/**
 * Options for generating a micro-check
 */
export interface GenerateMicroCheckOptions {
  /** Target difficulty level (auto-detected if not specified) */
  difficulty?: MicroCheckDifficulty;
  /** Custom question stem (extracted from unit if not provided) */
  questionStem?: string;
  /** Number of distractors for MCQ (default: 3) */
  distractorCount?: number;
  /** SQL snippet to use for completion (extracted from unit if not provided) */
  sqlSnippet?: string;
}

/**
 * Result of micro-check generation
 */
export interface MicroCheckGenerationResult {
  /** The generated micro-check */
  check: MicroCheck;
  /** Whether generation was successful */
  success: boolean;
  /** Reason for failure if unsuccessful */
  error?: string;
  /** Generation metadata */
  metadata: {
    /** Strategy used for generation */
    strategy: string;
    /** Source sections used from the unit */
    sourcesUsed: string[];
    /** Confidence score (0-1) */
    confidence: number;
  };
}

// ============================================================================
// Content Extraction Utilities
// ============================================================================

/**
 * Extract SQL code blocks from unit content
 * @param content - Unit content (markdown)
 * @returns Array of SQL code blocks
 */
function extractSQLCodeBlocks(content: string): string[] {
  const sqlBlocks: string[] = [];
  const regex = /```sql\s*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    sqlBlocks.push(match[1].trim());
  }

  // Also try generic code blocks if no SQL-specific ones found
  if (sqlBlocks.length === 0) {
    const genericRegex = /```\s*\n([\s\S]*?)```/gi;
    while ((match = genericRegex.exec(content)) !== null) {
      const code = match[1].trim();
      // Only include if it looks like SQL
      if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|GROUP BY|ORDER BY)\b/i.test(code)) {
        sqlBlocks.push(code);
      }
    }
  }

  return sqlBlocks;
}

/**
 * Extract key points from unit content (bullet points, numbered lists)
 * @param content - Unit content
 * @returns Array of key points
 */
function extractKeyPoints(content: string): string[] {
  const lines = content.split('\n');
  const points: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match bullet points or numbered list items
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const clean = trimmed.replace(/^[-*\d.\s]+/, '').trim();
      if (clean.length > 10 && clean.length < 200) {
        points.push(clean);
      }
    }
  }

  return points;
}

/**
 * Extract concept keywords from content
 * @param content - Unit content
 * @returns Array of potential keywords
 */
function extractKeywords(content: string): string[] {
  const keywords: string[] = [];

  // SQL-specific keywords to look for
  const sqlKeywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'GROUP BY', 'ORDER BY', 'HAVING', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
    'DISTINCT', 'AS', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'LIKE', 'IN', 'BETWEEN'
  ];

  const upperContent = content.toUpperCase();
  for (const keyword of sqlKeywords) {
    if (upperContent.includes(keyword)) {
      keywords.push(keyword);
    }
  }

  return [...new Set(keywords)];
}

/**
 * Create a blank-fill version of SQL for completion questions
 * @param sql - Original SQL
 * @param blankType - What to blank out
 * @returns SQL with blank
 */
function createSQLBlank(
  sql: string,
  blankType: 'clause' | 'keyword' | 'expression' = 'clause'
): { sqlWithBlank: string; answer: string } {
  const upperSql = sql.toUpperCase();

  if (blankType === 'clause') {
    // Try to find a WHERE clause
    const whereMatch = sql.match(/\bWHERE\b.+?(?=\b(ORDER BY|GROUP BY|HAVING|LIMIT|$)\b)/i);
    if (whereMatch) {
      return {
        sqlWithBlank: sql.replace(whereMatch[0], '___BLANK___'),
        answer: whereMatch[0].trim()
      };
    }

    // Try to find GROUP BY
    const groupMatch = sql.match(/\bGROUP\s+BY\b[^)]+?(?=\b(ORDER BY|HAVING|LIMIT|$)\b)/i);
    if (groupMatch) {
      return {
        sqlWithBlank: sql.replace(groupMatch[0], '___BLANK___'),
        answer: groupMatch[0].trim()
      };
    }
  }

  if (blankType === 'keyword') {
    // Find first major keyword after SELECT
    const keywords = ['WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'JOIN'];
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(sql)) {
        return {
          sqlWithBlank: sql.replace(regex, '___BLANK___'),
          answer: kw
        };
      }
    }
  }

  // Default: blank out the column list after SELECT
  const selectMatch = sql.match(/\bSELECT\b\s+(.+?)\s+\bFROM\b/i);
  if (selectMatch) {
    return {
      sqlWithBlank: sql.replace(selectMatch[1], '___BLANK___'),
      answer: selectMatch[1].trim()
    };
  }

  // Fallback: return original with warning
  return {
    sqlWithBlank: sql,
    answer: 'SELECT *'
  };
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique micro-check ID
 * @param unitId - Source unit ID
 * @param type - Check type
 * @param timestamp - Generation timestamp
 * @returns Unique ID
 */
function generateMicroCheckId(
  unitId: string,
  type: MicroCheckType,
  timestamp: number = Date.now()
): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `mc-${type}-${unitId.substring(0, 8)}-${timestamp}-${randomSuffix}`;
}

// ============================================================================
// Distractor Generation
// ============================================================================

/**
 * SQL concept-based distractor templates
 */
const SQL_DISTRACTOR_TEMPLATES: Record<string, string[]> = {
  'select-basic': [
    'SELECT all FROM table',
    'GET * FROM table',
    'FETCH * FROM table',
    'SELECT * IN table'
  ],
  'where-clause': [
    'WHERE column = value (missing quotes for strings)',
    'IF column = value',
    'FILTER column = value',
    'WHERE column EQUALS value'
  ],
  'group-by': [
    'GROUP column',
    'AGGREGATE BY column',
    'GROUP ON column',
    'CLUSTER BY column'
  ],
  'join': [
    'JOIN without ON clause',
    'MERGE table1, table2',
    'COMBINE table1 AND table2',
    'LINK table1 TO table2'
  ],
  'aggregate': [
    'Using column name instead of COUNT(*)',
    'Forgetting GROUP BY with aggregates',
    'Using SUM on text columns',
    'Mixing aggregate and non-aggregate columns'
  ]
};

/**
 * Generate distractors (wrong answers) for MCQ based on concept
 * @param correctAnswer - The correct answer
 * @param conceptId - Concept identifier
 * @param count - Number of distractors to generate
 * @param unitMistakes - Common mistakes from unit
 * @returns Array of distractor strings
 */
export function generateDistractors(
  correctAnswer: string,
  conceptId: string,
  count: number = 3,
  unitMistakes?: string[]
): string[] {
  const distractors: string[] = [];

  // First, try to use unit's common mistakes
  if (unitMistakes && unitMistakes.length > 0) {
    for (const mistake of unitMistakes) {
      if (distractors.length < count) {
        // Extract just the mistake pattern, not the explanation
        const cleanMistake = mistake
          .replace(/^[-*]\s*/, '')
          .replace(/\(because.+?\)/i, '')
          .replace(/\s*:\s*.+$/, '')
          .trim();
        if (cleanMistake && cleanMistake !== correctAnswer) {
          distractors.push(cleanMistake);
        }
      }
    }
  }

  // If still need more, use concept-based templates
  if (distractors.length < count) {
    const templates = SQL_DISTRACTOR_TEMPLATES[conceptId] || SQL_DISTRACTOR_TEMPLATES['select-basic'];
    for (const template of templates) {
      if (distractors.length < count && !distractors.includes(template)) {
        distractors.push(template);
      }
    }
  }

  // Generate variations if still need more
  while (distractors.length < count) {
    const index = distractors.length;
    const variation = generateVariation(correctAnswer, index);
    if (!distractors.includes(variation)) {
      distractors.push(variation);
    } else {
      distractors.push(`Alternative ${index + 1}: Different approach`);
    }
  }

  return distractors.slice(0, count);
}

/**
 * Generate a variation of the correct answer as a distractor
 * @param correctAnswer - Original answer
 * @param index - Variation index
 * @returns Variation string
 */
function generateVariation(correctAnswer: string, index: number): string {
  const variations = [
    correctAnswer.replace(/\*/g, 'column1, column2'),
    correctAnswer.replace(/WHERE/i, 'IF'),
    correctAnswer.replace(/=/g, '==='),
    correctAnswer.replace(/AND/i, 'OR'),
    correctAnswer.replace(/ASC/i, 'DESC')
  ];

  return variations[index % variations.length] || `Variation ${index + 1}`;
}

// ============================================================================
// Micro-Check Generators
// ============================================================================

/**
 * Generate a multiple choice question from unit content
 * @param unit - Source instructional unit
 * @param conceptId - Concept identifier
 * @param options - Generation options
 * @returns Generation result
 */
export function generateMCQ(
  unit: InstructionalUnit,
  conceptId: string,
  options: GenerateMicroCheckOptions = {}
): MicroCheckGenerationResult {
  const sourcesUsed: string[] = [];

  try {
    // Determine question stem
    let questionStem = options.questionStem;
    if (!questionStem) {
      if (unit.summary) {
        questionStem = `Based on the concept of "${unit.title}": ${unit.summary}`;
        sourcesUsed.push('summary');
      } else {
        // Extract from content
        const keyPoints = extractKeyPoints(unit.content);
        if (keyPoints.length > 0) {
          questionStem = `Which of the following is true about: ${keyPoints[0].substring(0, 100)}?`;
          sourcesUsed.push('key_points');
        } else {
          questionStem = `What is the correct way to use ${unit.title}?`;
          sourcesUsed.push('title');
        }
      }
    }

    // Generate correct answer
    let correctAnswer: string;
    if (unit.minimalExample) {
      correctAnswer = `Example: ${unit.minimalExample.substring(0, 150)}`;
      sourcesUsed.push('minimalExample');
    } else {
      const sqlBlocks = extractSQLCodeBlocks(unit.content);
      if (sqlBlocks.length > 0) {
        correctAnswer = sqlBlocks[0].substring(0, 150);
        sourcesUsed.push('content_sql');
      } else {
        correctAnswer = `Correct approach for ${unit.title}`;
        sourcesUsed.push('fallback');
      }
    }

    // Generate distractors
    const distractorCount = options.distractorCount || 3;
    const distractors = generateDistractors(
      correctAnswer,
      conceptId,
      distractorCount,
      unit.commonMistakes
    );
    if (unit.commonMistakes) {
      sourcesUsed.push('commonMistakes');
    }

    // Combine all options and shuffle
    const allOptions = [correctAnswer, ...distractors];
    const shuffledOptions = shuffleArray(allOptions);

    // Determine difficulty
    const difficulty = options.difficulty || inferDifficulty(unit, conceptId);

    const check: MicroCheck = {
      id: generateMicroCheckId(unit.id, 'mcq'),
      type: 'mcq',
      question: questionStem,
      options: shuffledOptions,
      correctAnswer: correctAnswer,
      explanation: buildExplanation(unit, correctAnswer),
      conceptId,
      unitId: unit.id,
      difficulty
    };

    return {
      check,
      success: true,
      metadata: {
        strategy: 'summary-based-mcq',
        sourcesUsed,
        confidence: sourcesUsed.includes('summary') ? 0.9 : 0.7
      }
    };
  } catch (error) {
    return {
      check: createFallbackCheck(unit, conceptId, 'mcq'),
      success: false,
      error: (error as Error).message,
      metadata: {
        strategy: 'fallback',
        sourcesUsed: ['fallback'],
        confidence: 0.3
      }
    };
  }
}

/**
 * Generate an SQL completion (fill-in-the-blank) question
 * @param unit - Source instructional unit
 * @param conceptId - Concept identifier
 * @param options - Generation options
 * @returns Generation result
 */
export function generateSQLCompletion(
  unit: InstructionalUnit,
  conceptId: string,
  options: GenerateMicroCheckOptions = {}
): MicroCheckGenerationResult {
  const sourcesUsed: string[] = [];

  try {
    // Get SQL snippet
    let sqlSnippet = options.sqlSnippet;
    if (!sqlSnippet) {
      if (unit.minimalExample) {
        sqlSnippet = unit.minimalExample;
        sourcesUsed.push('minimalExample');
      } else {
        const sqlBlocks = extractSQLCodeBlocks(unit.content);
        if (sqlBlocks.length > 0) {
          sqlSnippet = sqlBlocks[0];
          sourcesUsed.push('content_sql');
        }
      }
    }

    if (!sqlSnippet) {
      return {
        check: createFallbackCheck(unit, conceptId, 'sql_completion'),
        success: false,
        error: 'No SQL example found in unit',
        metadata: {
          strategy: 'fallback',
          sourcesUsed: [],
          confidence: 0
        }
      };
    }

    // Create blank
    const blankType: 'clause' | 'keyword' = conceptId.includes('where') ? 'clause' : 'keyword';
    const { sqlWithBlank, answer } = createSQLBlank(sqlSnippet, blankType);

    // Build question
    let questionStem = options.questionStem;
    if (!questionStem) {
      if (unit.summary) {
        questionStem = `Complete the SQL query to ${unit.summary.toLowerCase()}:`;
        sourcesUsed.push('summary');
      } else {
        questionStem = `Fill in the blank to complete this ${unit.title} query:`;
        sourcesUsed.push('title');
      }
    }

    const difficulty = options.difficulty || inferDifficulty(unit, conceptId);

    const check: MicroCheck = {
      id: generateMicroCheckId(unit.id, 'sql_completion'),
      type: 'sql_completion',
      question: `${questionStem}\n\n\`\`\`sql\n${sqlWithBlank}\n\`\`\``,
      correctAnswer: answer,
      explanation: buildExplanation(unit, answer),
      conceptId,
      unitId: unit.id,
      difficulty
    };

    return {
      check,
      success: true,
      metadata: {
        strategy: 'sql-blank-completion',
        sourcesUsed,
        confidence: 0.85
      }
    };
  } catch (error) {
    return {
      check: createFallbackCheck(unit, conceptId, 'sql_completion'),
      success: false,
      error: (error as Error).message,
      metadata: {
        strategy: 'fallback',
        sourcesUsed: ['fallback'],
        confidence: 0.3
      }
    };
  }
}

/**
 * Generate a concept explanation prompt (open-ended)
 * @param unit - Source instructional unit
 * @param conceptId - Concept identifier
 * @param options - Generation options
 * @returns Generation result
 */
export function generateConceptExplanation(
  unit: InstructionalUnit,
  conceptId: string,
  options: GenerateMicroCheckOptions = {}
): MicroCheckGenerationResult {
  const sourcesUsed: string[] = [];

  try {
    // Build question prompt
    let questionStem = options.questionStem;
    if (!questionStem) {
      if (unit.summary) {
        questionStem = `Explain the concept of "${unit.title}" and how it relates to: ${unit.summary}`;
        sourcesUsed.push('summary');
      } else {
        const keyPoints = extractKeyPoints(unit.content);
        if (keyPoints.length > 0) {
          questionStem = `Explain ${unit.title}. Your explanation should address: ${keyPoints[0]}`;
          sourcesUsed.push('key_points');
        } else {
          questionStem = `Explain how and when to use ${unit.title} in SQL queries.`;
          sourcesUsed.push('title');
        }
      }
    }

    // Build expected keywords from content
    const keywords = extractKeywords(unit.content);
    const expectedKeywords = keywords.slice(0, 5).join(', ');
    sourcesUsed.push('keywords');

    // Build explanation guidance
    let explanationGuidance = '';
    if (unit.commonMistakes && unit.commonMistakes.length > 0) {
      explanationGuidance = `Include common mistakes to avoid: ${unit.commonMistakes[0]}`;
      sourcesUsed.push('commonMistakes');
    }

    const difficulty = options.difficulty || inferDifficulty(unit, conceptId);

    const check: MicroCheck = {
      id: generateMicroCheckId(unit.id, 'concept_explanation'),
      type: 'concept_explanation',
      question: `${questionStem}\n\n${explanationGuidance}`.trim(),
      correctAnswer: expectedKeywords,
      explanation: `A good explanation should mention: ${expectedKeywords}`,
      conceptId,
      unitId: unit.id,
      difficulty
    };

    return {
      check,
      success: true,
      metadata: {
        strategy: 'open-ended-explanation',
        sourcesUsed,
        confidence: 0.8
      }
    };
  } catch (error) {
    return {
      check: createFallbackCheck(unit, conceptId, 'concept_explanation'),
      success: false,
      error: (error as Error).message,
      metadata: {
        strategy: 'fallback',
        sourcesUsed: ['fallback'],
        confidence: 0.3
      }
    };
  }
}

/**
 * Main micro-check generator function
 * @param unit - Source instructional unit
 * @param type - Type of micro-check to generate
 * @param conceptId - Concept identifier
 * @param options - Generation options
 * @returns Generation result
 */
export function generateMicroCheck(
  unit: InstructionalUnit,
  type: MicroCheckType,
  conceptId: string,
  options: GenerateMicroCheckOptions = {}
): MicroCheckGenerationResult {
  switch (type) {
    case 'mcq':
      return generateMCQ(unit, conceptId, options);
    case 'sql_completion':
      return generateSQLCompletion(unit, conceptId, options);
    case 'concept_explanation':
      return generateConceptExplanation(unit, conceptId, options);
    default:
      return {
        check: createFallbackCheck(unit, conceptId, 'mcq'),
        success: false,
        error: `Unknown micro-check type: ${type}`,
        metadata: {
          strategy: 'fallback',
          sourcesUsed: ['fallback'],
          confidence: 0
        }
      };
  }
}

/**
 * Validate a learner's response against the correct answer
 * @param check - The micro-check
 * @param response - Learner's response
 * @returns Whether the response is correct
 */
export function validateResponse(check: MicroCheck, response: string): boolean {
  if (!response || response.trim().length === 0) {
    return false;
  }

  const normalizedResponse = response.trim().toLowerCase();
  const normalizedAnswer = check.correctAnswer.trim().toLowerCase();

  switch (check.type) {
    case 'mcq':
      // For MCQ, check if response matches correct answer
      return normalizedResponse === normalizedAnswer ||
             check.correctAnswer.toLowerCase().includes(normalizedResponse);

    case 'sql_completion':
      // For SQL, normalize whitespace and check similarity
      const normalizedSQL = normalizeSQL(response);
      const normalizedCorrect = normalizeSQL(check.correctAnswer);
      return normalizedSQL === normalizedCorrect ||
             normalizedCorrect.includes(normalizedSQL) ||
             normalizedSQL.includes(normalizedCorrect);

    case 'concept_explanation':
      // For explanation, check if response contains expected keywords
      const expectedKeywords = check.correctAnswer.split(',').map(k => k.trim().toLowerCase());
      const matchedKeywords = expectedKeywords.filter(kw => normalizedResponse.includes(kw));
      // Consider correct if at least 60% of keywords are present
      return matchedKeywords.length >= expectedKeywords.length * 0.6;

    default:
      return false;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize SQL for comparison (remove extra whitespace, lowercase)
 * @param sql - SQL string
 * @returns Normalized SQL
 */
function normalizeSQL(sql: string): string {
  return sql
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1')
    .trim()
    .toLowerCase();
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param array - Array to shuffle
 * @returns New shuffled array
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Infer difficulty level from unit and concept
 * @param unit - Instructional unit
 * @param conceptId - Concept identifier
 * @returns Inferred difficulty
 */
function inferDifficulty(
  unit: InstructionalUnit,
  conceptId: string
): MicroCheckDifficulty {
  // Check concept ID for hints
  if (conceptId.includes('advanced') || conceptId.includes('complex')) {
    return 'hard';
  }
  if (conceptId.includes('basic') || conceptId.includes('intro')) {
    return 'easy';
  }

  // Check unit quality score
  if (unit.qualityScore !== undefined) {
    if (unit.qualityScore >= 0.8) return 'medium';
    if (unit.qualityScore >= 0.6) return 'easy';
    return 'hard';
  }

  // Check for complex SQL patterns
  const content = unit.content.toUpperCase();
  if (content.includes('SUBQUERY') || content.includes('CORRELATED') || content.includes('RECURSIVE')) {
    return 'hard';
  }
  if (content.includes('JOIN') || content.includes('GROUP BY') || content.includes('HAVING')) {
    return 'medium';
  }

  return 'easy';
}

/**
 * Build explanation text for a micro-check
 * @param unit - Source unit
 * @param answer - Correct answer
 * @returns Explanation string
 */
function buildExplanation(unit: InstructionalUnit, answer: string): string {
  const parts: string[] = [];

  if (unit.summary) {
    parts.push(`Context: ${unit.summary}`);
  }

  parts.push(`Correct answer: ${answer}`);

  if (unit.commonMistakes && unit.commonMistakes.length > 0) {
    parts.push(`Common mistake to avoid: ${unit.commonMistakes[0]}`);
  }

  return parts.join('\n\n');
}

/**
 * Create a fallback micro-check when generation fails
 * @param unit - Source unit
 * @param conceptId - Concept ID
 * @param type - Check type
 * @returns Fallback micro-check
 */
function createFallbackCheck(
  unit: InstructionalUnit,
  conceptId: string,
  type: MicroCheckType
): MicroCheck {
  const fallbacks: Record<MicroCheckType, MicroCheck> = {
    mcq: {
      id: generateMicroCheckId(unit.id, 'mcq'),
      type: 'mcq',
      question: `What is the key concept in "${unit.title}"?`,
      options: [
        unit.title,
        'SELECT * FROM table',
        'DELETE FROM table',
        'DROP TABLE'
      ],
      correctAnswer: unit.title,
      explanation: `This unit covers ${unit.title}.`,
      conceptId,
      unitId: unit.id,
      difficulty: 'easy'
    },
    sql_completion: {
      id: generateMicroCheckId(unit.id, 'sql_completion'),
      type: 'sql_completion',
      question: `Complete the query:\n\`\`\`sql\nSELECT * ___BLANK___ table\n\`\`\``,
      correctAnswer: 'FROM',
      explanation: 'FROM is required to specify the table in a SELECT statement.',
      conceptId,
      unitId: unit.id,
      difficulty: 'easy'
    },
    concept_explanation: {
      id: generateMicroCheckId(unit.id, 'concept_explanation'),
      type: 'concept_explanation',
      question: `Explain the concept of ${unit.title}.`,
      correctAnswer: 'explanation,concept,sql,query',
      explanation: 'A good explanation should cover the concept and its SQL application.',
      conceptId,
      unitId: unit.id,
      difficulty: 'easy'
    }
  };

  return fallbacks[type];
}

// ============================================================================
// Batch Generation
// ============================================================================

/**
 * Generate multiple micro-checks from a unit with varied types
 * @param unit - Source instructional unit
 * @param conceptId - Concept identifier
 * @param count - Number of checks to generate
 * @returns Array of generation results
 */
export function generateMicroCheckBatch(
  unit: InstructionalUnit,
  conceptId: string,
  count: number = 3
): MicroCheckGenerationResult[] {
  const types: MicroCheckType[] = ['mcq', 'sql_completion', 'concept_explanation'];
  const results: MicroCheckGenerationResult[] = [];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const result = generateMicroCheck(unit, type, conceptId, {
      difficulty: i === 0 ? 'easy' : i === count - 1 ? 'hard' : 'medium'
    });
    results.push(result);
  }

  return results;
}

/**
 * Select the best micro-check from multiple candidates
 * @param results - Generation results
 * @returns Best result based on confidence
 */
export function selectBestMicroCheck(
  results: MicroCheckGenerationResult[]
): MicroCheckGenerationResult | null {
  const successful = results.filter(r => r.success);
  if (successful.length === 0) return null;

  return successful.reduce((best, current) =>
    current.metadata.confidence > best.metadata.confidence ? current : best
  );
}

// ============================================================================
// Unit Tests (following project pattern)
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('micro-check-generator', () => {
    const mockUnit: InstructionalUnit = {
      id: 'unit-test-123',
      type: 'explanation',
      conceptId: 'where-clause',
      title: 'WHERE Clause Filtering',
      content: `
# WHERE Clause Filtering

The WHERE clause filters rows before grouping.

## Key Points
- Use WHERE to filter individual rows
- WHERE runs before GROUP BY
- Use conditions with AND/OR

## Example
\`\`\`sql
SELECT * FROM users WHERE age > 18 AND status = 'active';
\`\`\`

## Common Mistakes
- Forgetting quotes around string values
- Using = instead of IN for multiple values
- Confusing WHERE with HAVING
`,
      prerequisites: [],
      addedTimestamp: Date.now(),
      sourceInteractionIds: ['event-1'],
      summary: 'Filter rows using conditions before aggregation',
      minimalExample: "SELECT * FROM users WHERE age > 18 AND status = 'active'",
      commonMistakes: [
        'Forgetting quotes around string values',
        'Using = instead of IN for multiple values',
        'Confusing WHERE with HAVING'
      ]
    };

    describe('generateMCQ', () => {
      it('should generate MCQ from unit summary', () => {
        const result = generateMCQ(mockUnit, 'where-clause');
        expect(result.success).toBe(true);
        expect(result.check.type).toBe('mcq');
        expect(result.check.options).toBeDefined();
        expect(result.check.options!.length).toBe(4); // 1 correct + 3 distractors
        expect(result.check.options).toContain(result.check.correctAnswer);
      });

      it('should use unit title in question', () => {
        const result = generateMCQ(mockUnit, 'where-clause');
        expect(result.check.question).toContain('WHERE Clause Filtering');
      });

      it('should include explanation', () => {
        const result = generateMCQ(mockUnit, 'where-clause');
        expect(result.check.explanation.length).toBeGreaterThan(0);
      });
    });

    describe('generateSQLCompletion', () => {
      it('should generate SQL completion with blank', () => {
        const result = generateSQLCompletion(mockUnit, 'where-clause');
        expect(result.success).toBe(true);
        expect(result.check.type).toBe('sql_completion');
        expect(result.check.question).toContain('___BLANK___');
        expect(result.check.correctAnswer.length).toBeGreaterThan(0);
      });

      it('should include SQL code block in question', () => {
        const result = generateSQLCompletion(mockUnit, 'where-clause');
        expect(result.check.question).toContain('```sql');
      });
    });

    describe('generateConceptExplanation', () => {
      it('should generate explanation prompt', () => {
        const result = generateConceptExplanation(mockUnit, 'where-clause');
        expect(result.success).toBe(true);
        expect(result.check.type).toBe('concept_explanation');
        expect(result.check.question).toContain('Explain');
      });

      it('should include expected keywords in correctAnswer', () => {
        const result = generateConceptExplanation(mockUnit, 'where-clause');
        expect(result.check.correctAnswer).toContain('WHERE');
      });
    });

    describe('generateMicroCheck', () => {
      it('should route to correct generator by type', () => {
        const mcqResult = generateMicroCheck(mockUnit, 'mcq', 'where-clause');
        expect(mcqResult.check.type).toBe('mcq');

        const sqlResult = generateMicroCheck(mockUnit, 'sql_completion', 'where-clause');
        expect(sqlResult.check.type).toBe('sql_completion');

        const expResult = generateMicroCheck(mockUnit, 'concept_explanation', 'where-clause');
        expect(expResult.check.type).toBe('concept_explanation');
      });

      it('should return fallback on unknown type', () => {
        const result = generateMicroCheck(mockUnit, 'unknown' as MicroCheckType, 'where-clause');
        expect(result.success).toBe(false);
        expect(result.metadata.strategy).toBe('fallback');
      });
    });

    describe('validateResponse', () => {
      it('should validate MCQ response', () => {
        const check: MicroCheck = {
          id: 'test-1',
          type: 'mcq',
          question: 'Test?',
          options: ['A', 'B', 'C'],
          correctAnswer: 'A',
          explanation: 'Test explanation',
          conceptId: 'test',
          unitId: 'unit-1',
          difficulty: 'easy'
        };
        expect(validateResponse(check, 'A')).toBe(true);
        expect(validateResponse(check, 'B')).toBe(false);
        expect(validateResponse(check, 'a')).toBe(true); // case insensitive
      });

      it('should validate SQL completion with normalization', () => {
        const check: MicroCheck = {
          id: 'test-2',
          type: 'sql_completion',
          question: 'Complete:',
          correctAnswer: 'WHERE age > 18',
          explanation: 'Test',
          conceptId: 'test',
          unitId: 'unit-1',
          difficulty: 'easy'
        };
        expect(validateResponse(check, 'WHERE age > 18')).toBe(true);
        expect(validateResponse(check, 'where age>18')).toBe(true); // normalized
        expect(validateResponse(check, 'WHERE')).toBe(true); // partial match
      });

      it('should validate concept explanation by keywords', () => {
        const check: MicroCheck = {
          id: 'test-3',
          type: 'concept_explanation',
          question: 'Explain:',
          correctAnswer: 'filter, rows, where',
          explanation: 'Test',
          conceptId: 'test',
          unitId: 'unit-1',
          difficulty: 'easy'
        };
        expect(validateResponse(check, 'The filter clause removes rows using WHERE')).toBe(true);
        expect(validateResponse(check, 'random text without keywords')).toBe(false);
      });

      it('should reject empty responses', () => {
        const check: MicroCheck = {
          id: 'test-4',
          type: 'mcq',
          question: 'Test?',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: 'Test',
          conceptId: 'test',
          unitId: 'unit-1',
          difficulty: 'easy'
        };
        expect(validateResponse(check, '')).toBe(false);
        expect(validateResponse(check, '   ')).toBe(false);
      });
    });

    describe('generateDistractors', () => {
      it('should generate specified number of distractors', () => {
        const distractors = generateDistractors('SELECT * FROM users', 'select-basic', 3);
        expect(distractors.length).toBe(3);
      });

      it('should use unit mistakes as distractors', () => {
        const mistakes = ['Common mistake 1', 'Common mistake 2'];
        const distractors = generateDistractors('correct', 'test', 4, mistakes);
        expect(distractors.length).toBe(4);
      });

      it('should not include correct answer in distractors', () => {
        const correct = 'SELECT * FROM users';
        const distractors = generateDistractors(correct, 'select-basic', 3);
        expect(distractors).not.toContain(correct);
      });
    });

    describe('generateMicroCheckBatch', () => {
      it('should generate multiple checks', () => {
        const results = generateMicroCheckBatch(mockUnit, 'where-clause', 3);
        expect(results.length).toBe(3);
      });

      it('should vary difficulty across batch', () => {
        const results = generateMicroCheckBatch(mockUnit, 'where-clause', 3);
        const difficulties = results.map(r => r.check.difficulty);
        expect(difficulties).toContain('easy');
        expect(difficulties).toContain('hard');
      });
    });

    describe('selectBestMicroCheck', () => {
      it('should select highest confidence result', () => {
        const results: MicroCheckGenerationResult[] = [
          {
            check: { id: '1', type: 'mcq', question: 'Q1', correctAnswer: 'A', explanation: '', conceptId: 'test', unitId: 'u1', difficulty: 'easy' },
            success: true,
            metadata: { strategy: 'test', sourcesUsed: [], confidence: 0.5 }
          },
          {
            check: { id: '2', type: 'mcq', question: 'Q2', correctAnswer: 'B', explanation: '', conceptId: 'test', unitId: 'u1', difficulty: 'easy' },
            success: true,
            metadata: { strategy: 'test', sourcesUsed: [], confidence: 0.9 }
          }
        ];
        const best = selectBestMicroCheck(results);
        expect(best?.check.id).toBe('2');
      });

      it('should return null if no successful results', () => {
        const results: MicroCheckGenerationResult[] = [
          {
            check: { id: '1', type: 'mcq', question: 'Q1', correctAnswer: 'A', explanation: '', conceptId: 'test', unitId: 'u1', difficulty: 'easy' },
            success: false,
            metadata: { strategy: 'test', sourcesUsed: [], confidence: 0 }
          }
        ];
        expect(selectBestMicroCheck(results)).toBeNull();
      });
    });

    describe('Content Extraction', () => {
      it('should extract SQL code blocks', () => {
        const content = '```sql\nSELECT * FROM users;\n```';
        // Using internal function via generateSQLCompletion behavior
        const unit: InstructionalUnit = {
          ...mockUnit,
          content,
          minimalExample: undefined
        };
        const result = generateSQLCompletion(unit, 'select-basic');
        expect(result.success).toBe(true);
      });

      it('should handle units without SQL examples', () => {
        const unit: InstructionalUnit = {
          ...mockUnit,
          minimalExample: undefined,
          content: 'No SQL here'
        };
        const result = generateSQLCompletion(unit, 'test');
        expect(result.success).toBe(false);
        expect(result.error).toContain('No SQL example');
      });
    });
  });
}
