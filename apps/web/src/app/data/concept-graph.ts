/**
 * Concept Dependency Graph (DAG)
 * 
 * Defines prerequisite relationships between SQL concepts for structured learning.
 * Concepts are organized into categories and difficulty levels with explicit
 * prerequisite chains for mastery propagation and violation detection.
 */

export type ConceptCategory = 'basics' | 'filtering' | 'joining' | 'aggregation' | 'functions' | 'advanced' | 'errors';
export type ConceptDifficulty = 1 | 2 | 3; // 1=beginner, 2=intermediate, 3=advanced

export interface ConceptNode {
  id: string;
  name: string;
  description: string;
  prerequisites: string[]; // Concept IDs that must be learned first
  unlocks: string[];       // Concepts this unlocks (derived from prerequisites)
  difficulty: ConceptDifficulty;
  category: ConceptCategory;
}

/**
 * Concept graph type - Map of concept ID to ConceptNode
 */
export type ConceptGraph = Map<string, ConceptNode>;

/**
 * Core concept dependency graph with 30 concepts
 * Prerequisites define a directed acyclic graph (DAG) for learning progression
 */
export const CONCEPT_GRAPH: Record<string, ConceptNode> = {
  // ===== BASICS (Category: basics) =====
  'select-basic': {
    id: 'select-basic',
    name: 'Basic SELECT Statement',
    description: 'Retrieves specific columns or all columns from one or more tables using the SELECT keyword.',
    prerequisites: [],
    unlocks: ['distinct', 'alias', 'where-clause', 'order-by'],
    difficulty: 1,
    category: 'basics'
  },
  'distinct': {
    id: 'distinct',
    name: 'DISTINCT Keyword',
    description: 'Eliminates duplicate rows from query results, returning only unique values.',
    prerequisites: ['select-basic'],
    unlocks: ['aggregation'],
    difficulty: 1,
    category: 'basics'
  },
  'alias': {
    id: 'alias',
    name: 'Column and Table Aliases',
    description: 'Temporary names assigned to columns or tables using AS keyword for readability.',
    prerequisites: ['select-basic'],
    unlocks: ['joins', 'self-join'],
    difficulty: 1,
    category: 'basics'
  },

  // ===== FILTERING (Category: filtering) =====
  'where-clause': {
    id: 'where-clause',
    name: 'WHERE Clause Filtering',
    description: 'Filters rows based on specified conditions using comparison and logical operators.',
    prerequisites: ['select-basic'],
    unlocks: ['logical-operators', 'null-handling', 'in-operator', 'between-operator', 'like-pattern'],
    difficulty: 1,
    category: 'filtering'
  },
  'logical-operators': {
    id: 'logical-operators',
    name: 'Logical Operators (AND, OR, NOT)',
    description: 'Combines multiple conditions in WHERE clause with specific precedence rules.',
    prerequisites: ['where-clause'],
    unlocks: ['join-condition-missing'],
    difficulty: 2,
    category: 'filtering'
  },
  'null-handling': {
    id: 'null-handling',
    name: 'NULL Value Handling',
    description: 'Special handling required for missing values; use IS NULL, not = NULL.',
    prerequisites: ['where-clause'],
    unlocks: [],
    difficulty: 1,
    category: 'filtering'
  },
  'in-operator': {
    id: 'in-operator',
    name: 'IN Operator',
    description: 'Checks if a value matches any value in a list or subquery result.',
    prerequisites: ['where-clause'],
    unlocks: ['subqueries'],
    difficulty: 1,
    category: 'filtering'
  },
  'between-operator': {
    id: 'between-operator',
    name: 'BETWEEN Operator',
    description: 'Selects values within a given range, inclusive of endpoints.',
    prerequisites: ['where-clause'],
    unlocks: [],
    difficulty: 1,
    category: 'filtering'
  },
  'like-pattern': {
    id: 'like-pattern',
    name: 'LIKE Pattern Matching',
    description: 'Searches for specified patterns in columns using wildcards (% and _).',
    prerequisites: ['where-clause'],
    unlocks: [],
    difficulty: 1,
    category: 'filtering'
  },

  // ===== JOINING (Category: joining) =====
  'joins': {
    id: 'joins',
    name: 'JOIN Operations',
    description: 'Combines rows from two or more tables based on a related column between them.',
    prerequisites: ['select-basic', 'alias'],
    unlocks: ['join-condition-missing', 'ambiguous-column', 'self-join', 'cross-join'],
    difficulty: 2,
    category: 'joining'
  },
  'join-condition-missing': {
    id: 'join-condition-missing',
    name: 'JOIN Condition Requirements',
    description: 'Every JOIN must specify an ON clause to define how tables relate; missing conditions cause Cartesian products.',
    prerequisites: ['joins', 'logical-operators'],
    unlocks: [],
    difficulty: 2,
    category: 'joining'
  },
  'ambiguous-column': {
    id: 'ambiguous-column',
    name: 'Column Ambiguity in JOINs',
    description: 'When columns exist in multiple tables, they must be qualified with table names or aliases.',
    prerequisites: ['joins'],
    unlocks: [],
    difficulty: 2,
    category: 'joining'
  },
  'self-join': {
    id: 'self-join',
    name: 'Self-JOIN',
    description: 'Joining a table to itself using different aliases to compare rows within same table.',
    prerequisites: ['joins', 'alias'],
    unlocks: [],
    difficulty: 3,
    category: 'joining'
  },
  'cross-join': {
    id: 'cross-join',
    name: 'CROSS JOIN',
    description: 'Produces Cartesian product of two tables; every row from first table joins to every row from second.',
    prerequisites: ['joins'],
    unlocks: [],
    difficulty: 3,
    category: 'joining'
  },

  // ===== AGGREGATION (Category: aggregation) =====
  'aggregation': {
    id: 'aggregation',
    name: 'Aggregate Functions',
    description: 'Functions like COUNT, SUM, AVG, MAX, MIN that compute values across multiple rows.',
    prerequisites: ['select-basic', 'distinct'],
    unlocks: ['group-by', 'having-clause'],
    difficulty: 2,
    category: 'aggregation'
  },
  'group-by': {
    id: 'group-by',
    name: 'GROUP BY Clause',
    description: 'Groups rows sharing the same values in specified columns for aggregate calculations.',
    prerequisites: ['aggregation'],
    unlocks: ['group-by-error'],
    difficulty: 2,
    category: 'aggregation'
  },
  'group-by-error': {
    id: 'group-by-error',
    name: 'GROUP BY Compliance',
    description: 'Non-aggregated columns in SELECT must appear in GROUP BY clause.',
    prerequisites: ['group-by'],
    unlocks: [],
    difficulty: 2,
    category: 'aggregation'
  },
  'having-clause': {
    id: 'having-clause',
    name: 'HAVING Clause',
    description: 'Filters grouped rows based on aggregate conditions; executes after GROUP BY.',
    prerequisites: ['aggregation', 'group-by'],
    unlocks: [],
    difficulty: 2,
    category: 'aggregation'
  },

  // ===== FUNCTIONS (Category: functions) =====
  'string-functions': {
    id: 'string-functions',
    name: 'String Functions',
    description: 'Built-in functions for manipulating text: CONCAT, SUBSTRING, UPPER, LOWER, TRIM.',
    prerequisites: ['select-basic'],
    unlocks: [],
    difficulty: 2,
    category: 'functions'
  },
  'date-functions': {
    id: 'date-functions',
    name: 'Date and Time Functions',
    description: 'Functions for manipulating dates: NOW, DATE, YEAR, MONTH, DATEDIFF.',
    prerequisites: ['select-basic'],
    unlocks: [],
    difficulty: 2,
    category: 'functions'
  },
  'case-expression': {
    id: 'case-expression',
    name: 'CASE Expression',
    description: 'Conditional logic in SELECT for if-then-else style calculations.',
    prerequisites: ['select-basic'],
    unlocks: [],
    difficulty: 2,
    category: 'functions'
  },

  // ===== SORTING & PAGINATION (Category: basics) =====
  'order-by': {
    id: 'order-by',
    name: 'ORDER BY Clause',
    description: 'Sorts query results by one or more columns in ascending or descending order.',
    prerequisites: ['select-basic'],
    unlocks: ['limit-offset'],
    difficulty: 1,
    category: 'basics'
  },
  'limit-offset': {
    id: 'limit-offset',
    name: 'LIMIT and OFFSET',
    description: 'Restricts the number of rows returned and skips initial rows for pagination.',
    prerequisites: ['order-by'],
    unlocks: [],
    difficulty: 1,
    category: 'basics'
  },

  // ===== ADVANCED (Category: advanced) =====
  'subqueries': {
    id: 'subqueries',
    name: 'Subqueries (Nested Queries)',
    description: 'A query nested inside another query\'s WHERE, FROM, or SELECT clause.',
    prerequisites: ['in-operator'],
    unlocks: ['exist-clause', 'cte'],
    difficulty: 3,
    category: 'advanced'
  },
  'exist-clause': {
    id: 'exist-clause',
    name: 'EXISTS Clause',
    description: 'Tests for existence of rows in subquery; returns boolean result.',
    prerequisites: ['subqueries'],
    unlocks: [],
    difficulty: 3,
    category: 'advanced'
  },
  'union': {
    id: 'union',
    name: 'UNION Operator',
    description: 'Combines result sets from two or more SELECT statements into single result.',
    prerequisites: ['select-basic'],
    unlocks: [],
    difficulty: 3,
    category: 'advanced'
  },
  'cte': {
    id: 'cte',
    name: 'Common Table Expressions (CTE)',
    description: 'Named temporary result set defined with WITH clause for cleaner complex queries.',
    prerequisites: ['subqueries'],
    unlocks: ['window-functions'],
    difficulty: 3,
    category: 'advanced'
  },
  'window-functions': {
    id: 'window-functions',
    name: 'Window Functions',
    description: 'Functions like ROW_NUMBER, RANK, LAG that calculate across row sets without grouping.',
    prerequisites: ['cte', 'aggregation'],
    unlocks: [],
    difficulty: 3,
    category: 'advanced'
  },

  // ===== ERRORS (Category: errors) =====
  'syntax-error': {
    id: 'syntax-error',
    name: 'SQL Syntax Errors',
    description: 'Errors caused by incorrect SQL grammar, missing keywords, or misplaced clauses.',
    prerequisites: [],
    unlocks: ['missing-from'],
    difficulty: 1,
    category: 'errors'
  },
  'missing-from': {
    id: 'missing-from',
    name: 'Missing FROM Clause',
    description: 'Common error where SELECT statement omits required FROM clause to specify data source.',
    prerequisites: ['syntax-error'],
    unlocks: [],
    difficulty: 1,
    category: 'errors'
  }
};

/**
 * Build the concept graph and derive unlocks from prerequisites
 * @returns Map of concept ID to ConceptNode with derived unlocks
 */
export function buildConceptGraph(): ConceptGraph {
  const graph = new Map<string, ConceptNode>();
  
  // Deep copy nodes to avoid mutating the source
  for (const [id, node] of Object.entries(CONCEPT_GRAPH)) {
    graph.set(id, {
      ...node,
      prerequisites: [...node.prerequisites],
      unlocks: [...node.unlocks]
    });
  }
  
  // Derive unlocks from prerequisites
  for (const [id, node] of graph) {
    for (const prereqId of node.prerequisites) {
      const prereqNode = graph.get(prereqId);
      if (prereqNode && !prereqNode.unlocks.includes(id)) {
        prereqNode.unlocks.push(id);
      }
    }
  }
  
  return graph;
}

/**
 * Get all root concepts (no prerequisites)
 * @returns Array of root concept IDs
 */
export function getRootConcepts(): string[] {
  return Object.values(CONCEPT_GRAPH)
    .filter(node => node.prerequisites.length === 0)
    .map(node => node.id);
}

/**
 * Get concepts by category
 * @param category - Category to filter by
 * @returns Array of concept nodes in the category
 */
export function getConceptsByCategory(category: ConceptCategory): ConceptNode[] {
  return Object.values(CONCEPT_GRAPH).filter(node => node.category === category);
}

/**
 * Get concepts by difficulty level
 * @param difficulty - Difficulty level (1-3)
 * @returns Array of concept nodes at the difficulty level
 */
export function getConceptsByDifficulty(difficulty: ConceptDifficulty): ConceptNode[] {
  return Object.values(CONCEPT_GRAPH).filter(node => node.difficulty === difficulty);
}

/**
 * Get the learning path (topological order) from a starting concept
 * @param startConceptId - Concept to start from
 * @returns Array of concept IDs in dependency order
 */
export function getLearningPath(startConceptId: string): string[] {
  const graph = buildConceptGraph();
  const path: string[] = [];
  const visited = new Set<string>();
  
  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    
    const node = graph.get(id);
    if (!node) return;
    
    // Visit prerequisites first
    for (const prereq of node.prerequisites) {
      visit(prereq);
    }
    
    path.push(id);
  }
  
  visit(startConceptId);
  return path;
}

/**
 * Get all concepts that are unlocked by mastering a concept
 * @param conceptId - The concept that was mastered
 * @returns Array of concept IDs that become available
 */
export function getUnlockedConcepts(conceptId: string): string[] {
  const graph = buildConceptGraph();
  const node = graph.get(conceptId);
  return node?.unlocks || [];
}

/**
 * Get prerequisites for a concept
 * @param conceptId - Concept to get prerequisites for
 * @returns Array of prerequisite concept IDs
 */
export function getPrerequisites(conceptId: string): string[] {
  const graph = buildConceptGraph();
  const node = graph.get(conceptId);
  return node?.prerequisites || [];
}

/**
 * Check if a concept is an advanced concept (difficulty 3)
 * @param conceptId - Concept to check
 * @returns True if advanced
 */
export function isAdvancedConcept(conceptId: string): boolean {
  const node = CONCEPT_GRAPH[conceptId];
  return node?.difficulty === 3;
}

/**
 * Get concept statistics
 * @returns Statistics about the concept graph
 */
export function getConceptGraphStats(): {
  totalConcepts: number;
  byCategory: Record<ConceptCategory, number>;
  byDifficulty: Record<ConceptDifficulty, number>;
  avgPrerequisites: number;
  maxDepth: number;
} {
  const concepts = Object.values(CONCEPT_GRAPH);
  const graph = buildConceptGraph();
  
  // Calculate max depth (longest prerequisite chain)
  function getDepth(id: string, memo: Map<string, number> = new Map()): number {
    if (memo.has(id)) return memo.get(id)!;
    
    const node = graph.get(id);
    if (!node || node.prerequisites.length === 0) {
      memo.set(id, 1);
      return 1;
    }
    
    const maxPrereqDepth = Math.max(...node.prerequisites.map(p => getDepth(p, memo)));
    const depth = maxPrereqDepth + 1;
    memo.set(id, depth);
    return depth;
  }
  
  const depths = concepts.map(c => getDepth(c.id));
  
  const byCategory = concepts.reduce((acc, node) => {
    acc[node.category] = (acc[node.category] || 0) + 1;
    return acc;
  }, {} as Record<ConceptCategory, number>);
  
  const byDifficulty = concepts.reduce((acc, node) => {
    acc[node.difficulty] = (acc[node.difficulty] || 0) + 1;
    return acc;
  }, {} as Record<ConceptDifficulty, number>);
  
  return {
    totalConcepts: concepts.length,
    byCategory,
    byDifficulty,
    avgPrerequisites: concepts.reduce((sum, c) => sum + c.prerequisites.length, 0) / concepts.length,
    maxDepth: Math.max(...depths)
  };
}
