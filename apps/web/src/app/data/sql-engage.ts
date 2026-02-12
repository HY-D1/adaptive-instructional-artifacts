import { ConceptNode, ErrorSubtype, HintTemplate } from '../types';
import sqlEngageCsvRaw from './sql_engage_dataset.csv?raw';

// SQL-Engage Knowledge Graph: Concept nodes
export const conceptNodes: ConceptNode[] = [
  {
    id: 'select-basic',
    name: 'Basic SELECT',
    description: 'Retrieving data from a single table using SELECT statement',
    prerequisites: [],
    difficulty: 'beginner',
    examples: ['SELECT * FROM users;', 'SELECT name, email FROM users;']
  },
  {
    id: 'where-clause',
    name: 'WHERE Clause',
    description: 'Filtering rows based on conditions',
    prerequisites: ['select-basic'],
    difficulty: 'beginner',
    examples: ['SELECT * FROM users WHERE age > 18;']
  },
  {
    id: 'joins',
    name: 'JOIN Operations',
    description: 'Combining data from multiple tables',
    prerequisites: ['select-basic', 'where-clause'],
    difficulty: 'intermediate',
    examples: ['SELECT u.name, o.order_id FROM users u JOIN orders o ON u.id = o.user_id;']
  },
  {
    id: 'aggregation',
    name: 'Aggregate Functions',
    description: 'Using COUNT, SUM, AVG, MAX, MIN with GROUP BY',
    prerequisites: ['select-basic'],
    difficulty: 'intermediate',
    examples: ['SELECT COUNT(*) FROM users;', 'SELECT category, AVG(price) FROM products GROUP BY category;']
  },
  {
    id: 'subqueries',
    name: 'Subqueries',
    description: 'Using nested queries for complex filtering',
    prerequisites: ['select-basic', 'where-clause'],
    difficulty: 'advanced',
    examples: ['SELECT * FROM users WHERE id IN (SELECT user_id FROM orders);']
  },
  {
    id: 'order-by',
    name: 'ORDER BY Clause',
    description: 'Sorting query results',
    prerequisites: ['select-basic'],
    difficulty: 'beginner',
    examples: ['SELECT * FROM users ORDER BY age DESC;']
  }
];

export type SqlEngageRecord = {
  rowId: string;
  query: string;
  error_type: string;
  error_subtype: string;
  emotion: string;
  feedback_target: string;
  intended_learning_outcome: string;
};

const SQL_ENGAGE_POLICY_VERSION = 'sql-engage-index-v2-progressive';

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  values.push(current.trim());
  return values;
}

function parseSqlEngageCsv(csv: string): SqlEngageRecord[] {
  const lines = csv
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const idx = {
    query: headers.indexOf('query'),
    error_type: headers.indexOf('error_type'),
    error_subtype: headers.indexOf('error_subtype'),
    emotion: headers.indexOf('emotion'),
    feedback_target: headers.indexOf('feedback_target'),
    intended_learning_outcome: headers.indexOf('intended_learning_outcome')
  };

  if (Object.values(idx).some(i => i < 0)) {
    return [];
  }

  return lines.slice(1).map((line, i) => {
    const cols = parseCsvLine(line);
    const rowNum = i + 2; // include header line offset
    return {
      rowId: `sql-engage:${rowNum}`,
      query: cols[idx.query] || '',
      error_type: cols[idx.error_type] || '',
      error_subtype: cols[idx.error_subtype] || '',
      emotion: cols[idx.emotion] || '',
      feedback_target: cols[idx.feedback_target] || '',
      intended_learning_outcome: cols[idx.intended_learning_outcome] || ''
    };
  });
}

const sqlEngageRecords = parseSqlEngageCsv(sqlEngageCsvRaw);

const subtypeIndex = sqlEngageRecords.reduce((acc, row) => {
  const key = row.error_subtype.trim().toLowerCase();
  if (!key) return acc;
  if (!acc[key]) acc[key] = [];
  acc[key].push(row);
  return acc;
}, {} as Record<string, SqlEngageRecord[]>);

const CANONICAL_SUBTYPES = new Set<string>(Object.keys(subtypeIndex));
const CANONICAL_SUBTYPE_LIST = [...CANONICAL_SUBTYPES].sort((a, b) => a.localeCompare(b));
const DEFAULT_SUBTYPE_FALLBACK = 'incomplete query';
const SYNTHETIC_FALLBACK_ROW_ID = 'sql-engage:fallback-synthetic';

function getDatasetBackedFallbackSubtype(): string {
  if (CANONICAL_SUBTYPES.has(DEFAULT_SUBTYPE_FALLBACK)) {
    return DEFAULT_SUBTYPE_FALLBACK;
  }
  if (CANONICAL_SUBTYPE_LIST.length > 0) {
    return CANONICAL_SUBTYPE_LIST[0];
  }
  return DEFAULT_SUBTYPE_FALLBACK;
}

const DATASET_BACKED_FALLBACK_SUBTYPE = getDatasetBackedFallbackSubtype();

const SUBTYPE_ALIASES: Record<string, string> = {
  'unknown column': 'undefined column',
  'no such column': 'undefined column',
  'unknown table': 'undefined table',
  'no such table': 'undefined table',
  'unknown function': 'undefined function',
  'ambiguous column': 'ambiguous reference'
};

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const SUBTYPE_LADDER_GUIDANCE: Record<string, [string, string, string]> = {
  'incomplete query': [
    'Start by completing the missing part of your SQL statement.',
    'Check whether each clause is present and complete before running again.',
    'Build the query incrementally: SELECT -> FROM -> WHERE/JOIN/GROUP BY, validating each step.'
  ],
  'undefined table': [
    'The table reference is likely incorrect.',
    'Verify the exact table name from the schema and use that spelling.',
    'Match every table in your query to a real schema table, then retry.'
  ],
  'undefined column': [
    'One or more column names do not match the schema.',
    'Compare your selected/filtered columns against the exact column names in the table.',
    'Rewrite the query with only verified column names, then add extra fields one at a time.'
  ],
  'undefined function': [
    'A function in the query is not recognized.',
    'Replace unsupported function names with functions available in this SQL dialect.',
    'Confirm function signatures and test the function on a small query first.'
  ],
  'ambiguous reference': [
    'A column reference is ambiguous across multiple tables.',
    'Prefix overlapping columns with table names or aliases.',
    'Use explicit aliases throughout SELECT, WHERE, GROUP BY, and ORDER BY.'
  ],
  'wrong positioning': [
    'A clause appears in the wrong order.',
    'Reorder clauses to standard SQL order.',
    'Use a fixed skeleton (SELECT -> FROM -> JOIN -> WHERE -> GROUP BY -> HAVING -> ORDER BY).'
  ]
};

const KNOWN_SUBTYPE_OPTIONS = Object.keys(SUBTYPE_LADDER_GUIDANCE)
  .filter((subtype) => CANONICAL_SUBTYPES.has(subtype))
  .sort((a, b) => a.localeCompare(b));

function normalizeSpacing(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function scrubSpecificIdentifiers(text: string): string {
  return normalizeSpacing(
    text
      .replace(/'[^']+'/g, 'the referenced item')
      .replace(/"[^"]+"/g, 'the referenced item')
  );
}

function appendSupportSentence(base: string, addon: string): string {
  const cleaned = normalizeSpacing(addon);
  if (!cleaned) return base;
  const punctuated = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  return `${base} ${punctuated}`;
}

export function getSqlEngagePolicyVersion() {
  return SQL_ENGAGE_POLICY_VERSION;
}

export function getKnownSqlEngageSubtypes(): string[] {
  return [...KNOWN_SUBTYPE_OPTIONS];
}

export function canonicalizeSqlEngageSubtype(subtype?: string): string {
  const raw = subtype?.trim().toLowerCase() || '';
  if (!raw) return DATASET_BACKED_FALLBACK_SUBTYPE;

  const aliased = SUBTYPE_ALIASES[raw] || raw;
  if (CANONICAL_SUBTYPES.has(aliased)) return aliased;

  // Keep only canonical labels for logging/replay.
  return DATASET_BACKED_FALLBACK_SUBTYPE;
}

export function getSqlEngageRowsBySubtype(subtype: string): SqlEngageRecord[] {
  return subtypeIndex[canonicalizeSqlEngageSubtype(subtype)] || [];
}

function getFallbackSqlEngageRow(): SqlEngageRecord {
  const fallbackRows = subtypeIndex[DATASET_BACKED_FALLBACK_SUBTYPE];
  if (fallbackRows && fallbackRows.length > 0) {
    return fallbackRows[0];
  }

  const firstRow = sqlEngageRecords[0];
  if (firstRow) {
    return {
      ...firstRow,
      error_subtype: canonicalizeSqlEngageSubtype(firstRow.error_subtype) || DATASET_BACKED_FALLBACK_SUBTYPE,
      rowId: firstRow.rowId || SYNTHETIC_FALLBACK_ROW_ID
    };
  }

  return {
    rowId: SYNTHETIC_FALLBACK_ROW_ID,
    query: '',
    error_type: 'construction',
    error_subtype: DATASET_BACKED_FALLBACK_SUBTYPE,
    emotion: 'neutral',
    feedback_target: 'Complete the query structure before execution.',
    intended_learning_outcome: 'Build valid SQL statements incrementally.'
  };
}

function ensureSqlEngageRow(row: SqlEngageRecord | undefined, canonicalSubtype: string): SqlEngageRecord {
  const fallback = getFallbackSqlEngageRow();
  const candidate = row || fallback;
  return {
    ...candidate,
    rowId: candidate.rowId?.trim() || fallback.rowId || SYNTHETIC_FALLBACK_ROW_ID,
    error_subtype: canonicalizeSqlEngageSubtype(
      candidate.error_subtype || canonicalSubtype || DATASET_BACKED_FALLBACK_SUBTYPE
    )
  };
}

export function getDeterministicSqlEngageHint(
  subtype: string,
  hintLevel: number,
  seed: string
): SqlEngageRecord {
  const canonicalSubtype = canonicalizeSqlEngageSubtype(subtype);
  const rows = getSqlEngageRowsBySubtype(canonicalSubtype);
  const sourceRows = rows.length > 0 ? rows : [getFallbackSqlEngageRow()];
  const index = stableHash(`${canonicalSubtype}|${hintLevel}|${seed}`) % sourceRows.length;
  return ensureSqlEngageRow(sourceRows[index], canonicalSubtype);
}

export function getDeterministicSqlEngageAnchor(
  subtype: string,
  seed: string
): SqlEngageRecord {
  const canonicalSubtype = canonicalizeSqlEngageSubtype(subtype);
  const rows = getSqlEngageRowsBySubtype(canonicalSubtype);
  const sourceRows = rows.length > 0 ? rows : [getFallbackSqlEngageRow()];
  const index = stableHash(`${canonicalSubtype}|${seed}`) % sourceRows.length;
  return ensureSqlEngageRow(sourceRows[index], canonicalSubtype);
}

export function getProgressiveSqlEngageHintText(
  subtype: string,
  hintLevel: number,
  row?: SqlEngageRecord
): string {
  const canonicalSubtype = canonicalizeSqlEngageSubtype(subtype);
  const level = Math.max(1, Math.min(3, hintLevel));
  const ladder = SUBTYPE_LADDER_GUIDANCE[canonicalSubtype] || SUBTYPE_LADDER_GUIDANCE['incomplete query'];

  if (level === 1) return ladder[0];

  if (level === 2) {
    const outcome = scrubSpecificIdentifiers(row?.intended_learning_outcome || '');
    return appendSupportSentence(ladder[1], outcome);
  }

  const feedback = scrubSpecificIdentifiers(row?.feedback_target || '');
  return appendSupportSentence(ladder[2], feedback);
}

const subtypeToConceptMap: Record<string, string[]> = {
  'incomplete query': ['select-basic'],
  'undefined column': ['select-basic'],
  'undefined table': ['select-basic'],
  'wrong positioning': ['select-basic'],
  'incorrect join': ['joins'],
  'incorrect group by usage': ['aggregation'],
  'incorrect having clause': ['aggregation'],
  'ambiguous reference': ['joins']
};

export function getConceptIdsForSqlEngageSubtype(subtype?: string): string[] {
  if (!subtype) return [];
  const normalized = canonicalizeSqlEngageSubtype(subtype);
  return subtypeToConceptMap[normalized] || [];
}

function isLikelyWrongPositioning(query: string): boolean {
  const compact = query.trim().toLowerCase();
  if (!compact) return false;
  return (
    compact.startsWith('from ') ||
    compact.startsWith('where ') ||
    compact.startsWith('group by ') ||
    compact.startsWith('order by ') ||
    compact.startsWith('join ')
  );
}

function isLikelyIncompleteQuery(query: string): boolean {
  const compact = query.trim().toLowerCase();
  if (!compact) return false;
  return /(\bselect\b|\bfrom\b|\bwhere\b|\bgroup by\b|\border by\b|\bjoin\b)\s*$/.test(compact);
}

export function normalizeSqlErrorSubtype(errorMessage: string, query: string = ''): string {
  const error = errorMessage.toLowerCase();

  if (/no such column|unknown column|has no column named/.test(error)) {
    return canonicalizeSqlEngageSubtype('undefined column');
  }
  if (/no such table|unknown table|no such relation/.test(error)) {
    return canonicalizeSqlEngageSubtype('undefined table');
  }
  if (/no such function|unknown function|undefined function/.test(error)) {
    return canonicalizeSqlEngageSubtype('undefined function');
  }
  if (/ambiguous column|ambiguous reference|is ambiguous/.test(error)) {
    return canonicalizeSqlEngageSubtype('ambiguous reference');
  }
  if (/incomplete input|unterminated|unexpected end/.test(error) || isLikelyIncompleteQuery(query)) {
    return canonicalizeSqlEngageSubtype('incomplete query');
  }
  if (/near .*syntax error|syntax error/.test(error) && isLikelyWrongPositioning(query)) {
    return canonicalizeSqlEngageSubtype('wrong positioning');
  }

  // Safe fallback to a canonical subtype guaranteed in the SQL-Engage dataset.
  return canonicalizeSqlEngageSubtype(DEFAULT_SUBTYPE_FALLBACK);
}

// Error subtypes mapped to concepts
export const errorSubtypes: ErrorSubtype[] = [
  {
    id: 'missing-from',
    pattern: /no such table|FROM/i,
    conceptIds: ['select-basic'],
    severity: 'high',
    description: 'Missing or incorrect FROM clause'
  },
  {
    id: 'syntax-select',
    pattern: /syntax error.*SELECT/i,
    conceptIds: ['select-basic'],
    severity: 'medium',
    description: 'Syntax error in SELECT statement'
  },
  {
    id: 'ambiguous-column',
    pattern: /ambiguous column/i,
    conceptIds: ['joins'],
    severity: 'medium',
    description: 'Column name exists in multiple tables without table prefix'
  },
  {
    id: 'join-condition-missing',
    pattern: /ON.*expected|cartesian/i,
    conceptIds: ['joins'],
    severity: 'high',
    description: 'Missing or incorrect JOIN condition'
  },
  {
    id: 'group-by-error',
    pattern: /not in GROUP BY|aggregate/i,
    conceptIds: ['aggregation'],
    severity: 'high',
    description: 'Column not in GROUP BY or aggregate function'
  },
  {
    id: 'where-syntax',
    pattern: /syntax error.*WHERE/i,
    conceptIds: ['where-clause'],
    severity: 'medium',
    description: 'Syntax error in WHERE clause'
  }
];

// HintWise: Progressive hint templates
export const hintTemplates: HintTemplate[] = [
  // Basic SELECT hints
  {
    id: 'hint-select-1',
    conceptId: 'select-basic',
    errorSubtypeId: 'missing-from',
    hintLevel: 1,
    content: 'Remember: Every SELECT statement needs a FROM clause to specify which table to query.',
    nextAction: 'stay'
  },
  {
    id: 'hint-select-2',
    conceptId: 'select-basic',
    errorSubtypeId: 'missing-from',
    hintLevel: 2,
    content: 'The structure is: SELECT columns FROM table_name. Check if your table name is spelled correctly.',
    nextAction: 'escalate'
  },
  {
    id: 'hint-select-3',
    conceptId: 'select-basic',
    errorSubtypeId: 'syntax-select',
    hintLevel: 1,
    content: 'Check your SELECT syntax. Are you using commas correctly between column names?',
    nextAction: 'stay'
  },
  
  // JOIN hints
  {
    id: 'hint-join-1',
    conceptId: 'joins',
    errorSubtypeId: 'ambiguous-column',
    hintLevel: 1,
    content: 'When joining tables, prefix column names with table names (e.g., users.id) to avoid ambiguity.',
    nextAction: 'stay'
  },
  {
    id: 'hint-join-2',
    conceptId: 'joins',
    errorSubtypeId: 'ambiguous-column',
    hintLevel: 2,
    content: 'Use table aliases for cleaner code: SELECT u.name, o.id FROM users u JOIN orders o ...',
    nextAction: 'escalate'
  },
  {
    id: 'hint-join-3',
    conceptId: 'joins',
    errorSubtypeId: 'join-condition-missing',
    hintLevel: 1,
    content: 'Your JOIN is missing an ON condition. Specify how the tables should be connected.',
    nextAction: 'stay'
  },
  {
    id: 'hint-join-4',
    conceptId: 'joins',
    errorSubtypeId: 'join-condition-missing',
    hintLevel: 2,
    content: 'JOIN syntax: FROM table1 JOIN table2 ON table1.column = table2.column',
    nextAction: 'escalate'
  },
  
  // Aggregation hints
  {
    id: 'hint-agg-1',
    conceptId: 'aggregation',
    errorSubtypeId: 'group-by-error',
    hintLevel: 1,
    content: 'When using GROUP BY, every column in SELECT must either be in GROUP BY or inside an aggregate function.',
    nextAction: 'stay'
  },
  {
    id: 'hint-agg-2',
    conceptId: 'aggregation',
    errorSubtypeId: 'group-by-error',
    hintLevel: 2,
    content: 'Aggregate functions: COUNT(), SUM(), AVG(), MAX(), MIN(). Group by the non-aggregated columns.',
    nextAction: 'escalate'
  },
  
  // WHERE clause hints
  {
    id: 'hint-where-1',
    conceptId: 'where-clause',
    errorSubtypeId: 'where-syntax',
    hintLevel: 1,
    content: 'Check your WHERE clause syntax. Are you using comparison operators correctly (=, >, <, !=)?',
    nextAction: 'stay'
  }
];

// Helper functions to retrieve from SQL-Engage
export function getConceptById(id: string): ConceptNode | undefined {
  return conceptNodes.find(c => c.id === id);
}

export function getErrorSubtype(errorMessage: string): ErrorSubtype | undefined {
  return errorSubtypes.find(e => e.pattern.test(errorMessage));
}

export function getHintsForError(errorSubtypeId: string, level: number = 1): HintTemplate[] {
  return hintTemplates.filter(h => 
    h.errorSubtypeId === errorSubtypeId && h.hintLevel <= level
  );
}

export function getConceptsByIds(ids: string[]): ConceptNode[] {
  return conceptNodes.filter(c => ids.includes(c.id));
}
