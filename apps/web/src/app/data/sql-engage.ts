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

const SQL_ENGAGE_POLICY_VERSION = 'sql-engage-index-v3-hintid-contract';

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    // Handle escaped quotes ("") within quoted fields
    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1; // Skip the next quote
      continue;
    }
    // Toggle quote state
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    // Only split on commas outside of quotes
    if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  // Push the last value
  values.push(current.trim());
  
  // Remove surrounding quotes from each value if present
  return values.map(v => {
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
      return v.slice(1, -1).replace(/""/g, '"');
    }
    return v;
  });
}

function parseSqlEngageCsv(csv: string): SqlEngageRecord[] {
  // Parse CSV handling newlines within quoted fields
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;
  
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];
    
    // Handle escaped quotes ("") within quoted fields
    if (ch === '"' && inQuotes && next === '"') {
      currentLine += '"';
      i += 1; // Skip next quote
      continue;
    }
    
    // Toggle quote state
    if (ch === '"') {
      inQuotes = !inQuotes;
      currentLine += ch;
      continue;
    }
    
    // Only split on newlines outside of quotes
    if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuotes) {
      if (ch === '\r') i += 1; // Skip \n in \r\n
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = '';
      continue;
    }
    
    currentLine += ch;
  }
  
  // Don't forget the last line
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

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
  'column not found': 'undefined column',
  'unknown table': 'undefined table',
  'no such table': 'undefined table',
  'table not found': 'undefined table',
  'unknown function': 'undefined function',
  'no such function': 'undefined function',
  'function not found': 'undefined function',
  'ambiguous column': 'ambiguous reference',
  'ambiguous table': 'ambiguous reference',
  'ambiguous identifier': 'ambiguous reference'
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
  ],
  // Additional subtypes to complete coverage for all 23 canonical subtypes
  'aggregation misuse': [
    'Your aggregate function or grouping logic needs adjustment.',
    'Check that all non-aggregated columns in SELECT appear in GROUP BY.',
    'Apply aggregates only to values you want to summarize, and ensure GROUP BY includes all other selected columns.'
  ],
  'data type mismatch': [
    'A value does not match the expected data type for this operation.',
    'Compare the column type with the value you are providing.',
    'Convert values to the correct type before comparison or insertion.'
  ],
  'incorrect distinct usage': [
    'DISTINCT may be unnecessary or incorrectly applied.',
    'Check if the columns are already unique or if DISTINCT duplicates removal is actually needed.',
    'Remove redundant DISTINCT and rely on unique keys or GROUP BY when appropriate.'
  ],
  'incorrect group by usage': [
    'The GROUP BY clause is missing or contains incorrect columns.',
    'Ensure every non-aggregated column in SELECT is included in GROUP BY.',
    'Refactor the query to group by the exact set of non-aggregated columns.'
  ],
  'incorrect having clause': [
    'HAVING is being used incorrectly or filters are in the wrong place.',
    'Use HAVING only for conditions on aggregate results; move row filters to WHERE.',
    'Validate that aggregate conditions reference grouped data correctly.'
  ],
  'incorrect join usage': [
    'The JOIN condition or type is incorrect.',
    'Verify the join keys exist in both tables and the join type matches your intent.',
    'Specify explicit ON conditions and prefer explicit JOIN syntax over comma joins.'
  ],
  'incorrect order by usage': [
    'ORDER BY columns or direction are incorrect.',
    'Check that the sorting columns exist in the result set and ASC/DESC is intended.',
    'Limit sorting to necessary columns and ensure the order aligns with the requirement.'
  ],
  'incorrect select usage': [
    'The SELECT clause is missing required columns or includes invalid ones.',
    'List only columns needed and ensure they exist in the source tables.',
    'Build the column list incrementally, validating each against the schema.'
  ],
  'incorrect wildcard usage': [
    'Wildcards (*) are used incorrectly or too broadly.',
    'Replace * with explicit column names for clarity and performance.',
    'Select only the columns your application actually needs.'
  ],
  'inefficient query': [
    'The query can be rewritten for better performance.',
    'Look for unnecessary subqueries, redundant joins, or missing indexes.',
    'Simplify the query structure and ensure filters are applied as early as possible.'
  ],
  'missing commas': [
    'A comma is missing between columns or table references.',
    'Review the SELECT or FROM list and insert commas between items.',
    'Format lists with one item per line to make missing commas obvious.'
  ],
  'missing quotes': [
    'String literals are missing required quotes.',
    'Wrap text values in single quotes and escape embedded quotes properly.',
    'Consistently quote all string literals and verify special characters are escaped.'
  ],
  'missing semicolons': [
    'A statement terminator may be missing.',
    'End each SQL statement with a semicolon for clarity.',
    'Use semicolons consistently, especially in multi-statement batches.'
  ],
  'misspelling': [
    'A keyword or identifier appears to be misspelled.',
    'Compare the spelling against the schema and SQL keywords.',
    'Use consistent naming conventions and verify against the database catalog.'
  ],
  'non-standard operators': [
    'An operator is not recognized or is non-standard.',
    'Replace with standard SQL operators (e.g., = instead of ==).',
    'Verify operator syntax in the target SQL dialect documentation.'
  ],
  'operator misuse': [
    'An operator is being used incorrectly for this context.',
    'Check that the operator fits the data types and logic of the comparison.',
    'Review operator precedence and use parentheses to clarify intent.'
  ],
  'unmatched brackets': [
    'Opening and closing brackets or parentheses do not match.',
    'Count brackets to locate the mismatch and ensure proper nesting.',
    'Balance every opening bracket with a corresponding closing bracket.'
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
      .replace(/'[\w\s._]+'/g, 'the referenced item')
      .replace(/"[\w\s._]+"/g, 'the referenced item')
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

const conceptNodeIds = new Set(conceptNodes.map((concept) => concept.id));

const explicitSubtypeConceptMap: Record<string, string[]> = {
  'aggregation misuse': ['aggregation'],
  'ambiguous reference': ['joins'],
  'data type mismatch': ['where-clause'],
  'incomplete query': ['select-basic'],
  'incorrect distinct usage': ['select-basic'],
  'incorrect group by usage': ['aggregation'],
  'incorrect having clause': ['aggregation'],
  'incorrect join usage': ['joins'],
  'incorrect order by usage': ['order-by'],
  'incorrect select usage': ['select-basic'],
  'incorrect wildcard usage': ['select-basic'],
  'inefficient query': ['select-basic'],
  'missing commas': ['select-basic'],
  'missing quotes': ['select-basic'],
  'missing semicolons': ['select-basic'],
  misspelling: ['where-clause'],
  'non-standard operators': ['where-clause'],
  'operator misuse': ['where-clause'],
  'undefined column': ['select-basic'],
  'undefined function': ['aggregation'],
  'undefined table': ['joins'],
  'unmatched brackets': ['where-clause'],
  'wrong positioning': ['order-by']
};

const conceptInferenceRules: Array<{ conceptId: string; pattern: RegExp }> = [
  { conceptId: 'subqueries', pattern: /\bsubquery\b|\bnested query\b|\bexists\s*\(|\bin\s*\(\s*select\b|\(\s*select\b/i },
  { conceptId: 'joins', pattern: /\bjoin\b|\bjoined\b|\bforeign key\b|\bambiguous\b|\btable alias\b/i },
  { conceptId: 'aggregation', pattern: /\bgroup by\b|\bhaving\b|\baggregate\b|\bcount\s*\(|\bsum\s*\(|\bavg\s*\(|\bmax\s*\(|\bmin\s*\(/i },
  { conceptId: 'order-by', pattern: /\border by\b|\bsort\b|\bascending\b|\bdescending\b/i },
  { conceptId: 'where-clause', pattern: /\bwhere\b|\bfilter\b|\bcondition\b|\boperator\b|\bpredicate\b|\bcomparison\b/i }
];

function inferConceptIdsFromSubtypeCorpus(subtype: string): string[] {
  const rows = subtypeIndex[subtype] || [];
  const corpus = [
    subtype,
    ...rows.map((row) => `${row.query} ${row.feedback_target} ${row.intended_learning_outcome}`)
  ].join(' ');

  return conceptInferenceRules
    .filter((rule) => rule.pattern.test(corpus))
    .map((rule) => rule.conceptId)
    .filter((conceptId) => conceptNodeIds.has(conceptId));
}

function buildSubtypeConceptMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  for (const subtype of CANONICAL_SUBTYPE_LIST) {
    const explicit = explicitSubtypeConceptMap[subtype] || [];
    const inferred = inferConceptIdsFromSubtypeCorpus(subtype);
    const merged = [...new Set([...explicit, ...inferred])].filter((conceptId) => conceptNodeIds.has(conceptId));
    map[subtype] = merged.length > 0 ? merged : ['select-basic'];
  }

  return map;
}

const subtypeToConceptMap: Record<string, string[]> = buildSubtypeConceptMap();

export function getConceptIdsForSqlEngageSubtype(subtype?: string): string[] {
  if (!subtype) return [];
  const normalized = canonicalizeSqlEngageSubtype(subtype);
  return subtypeToConceptMap[normalized] || [];
}

export function getMappedSqlEngageSubtypes(): string[] {
  return Object.keys(subtypeToConceptMap).sort((a, b) => a.localeCompare(b));
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

/**
 * Normalizes SQLite/sql.js error messages to SQL-Engage error subtypes.
 * This function maps various error patterns to canonical subtypes for consistent
 * hint generation and error categorization.
 * 
 * Coverage includes:
 * - Column errors (undefined column, ambiguous reference)
 * - Table errors (undefined table)
 * - Function errors (undefined function)
 * - Syntax errors (incomplete query, wrong positioning, missing commas, unmatched brackets)
 * - Data errors (type mismatch, constraint violation)
 * 
 * @param errorMessage - The raw error message from SQLite/sql.js
 * @param query - The SQL query that caused the error (for context-based detection)
 * @returns The canonical SQL-Engage error subtype
 */
export function normalizeSqlErrorSubtype(errorMessage: string, query: string = ''): string {
  const error = errorMessage.toLowerCase();

  // Column-related errors - expanded pattern coverage
  if (/no such column|unknown column|has no column named|column not found|does not exist.*column|invalid column|referenced column/i.test(error)) {
    return canonicalizeSqlEngageSubtype('undefined column');
  }
  // Table-related errors - expanded pattern coverage
  if (/no such table|unknown table|no such relation|table not found|does not exist.*table|invalid table|referenced table/i.test(error)) {
    return canonicalizeSqlEngageSubtype('undefined table');
  }
  // Function-related errors - expanded pattern coverage
  if (/no such function|unknown function|undefined function|function not found|does not exist.*function/i.test(error)) {
    return canonicalizeSqlEngageSubtype('undefined function');
  }
  // Ambiguity errors - expanded pattern coverage
  if (/ambiguous column|ambiguous table|ambiguous reference|is ambiguous|ambiguous identifier/i.test(error)) {
    return canonicalizeSqlEngageSubtype('ambiguous reference');
  }
  // Incomplete query patterns
  if (/incomplete input|unterminated|unexpected end|unexpected eof|missing keyword|incomplete sql/i.test(error) || isLikelyIncompleteQuery(query)) {
    return canonicalizeSqlEngageSubtype('incomplete query');
  }
  // Wrong positioning / syntax order patterns
  if (/near .*syntax error|syntax error|unexpected token|wrong order/i.test(error) && isLikelyWrongPositioning(query)) {
    return canonicalizeSqlEngageSubtype('wrong positioning');
  }
  // Data type mismatch patterns
  if (/datatype mismatch|type mismatch|cannot convert|incompatible types|invalid.*type/i.test(error)) {
    return canonicalizeSqlEngageSubtype('data type mismatch');
  }
  // Constraint violation patterns
  if (/constraint failed|unique constraint|foreign key constraint|check constraint|not null constraint/i.test(error)) {
    return canonicalizeSqlEngageSubtype('constraint violation');
  }
  // Division by zero and arithmetic errors
  if (/division by zero|divide by zero|arithmetic error|numeric overflow/i.test(error)) {
    return canonicalizeSqlEngageSubtype('operator misuse');
  }
  // LIKE pattern errors
  if (/like pattern|escape sequence|invalid escape/i.test(error)) {
    return canonicalizeSqlEngageSubtype('operator misuse');
  }
  // Index-related errors
  if (/index.*already exists|index.*not found|no such index/i.test(error)) {
    return canonicalizeSqlEngageSubtype('misspelling');
  }
  // View-related errors
  if (/no such view|view.*not found|invalid view/i.test(error)) {
    return canonicalizeSqlEngageSubtype('undefined table');
  }
  // Missing comma patterns
  if (/near\s*"[^"]*"\s*: syntax error|missing comma|expected comma/i.test(error)) {
    return canonicalizeSqlEngageSubtype('missing commas');
  }
  // Unmatched brackets/parentheses
  if (/unmatched.*bracket|unmatched.*parenthes|unclosed.*paren|mismatched.*bracket/i.test(error)) {
    return canonicalizeSqlEngageSubtype('unmatched brackets');
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
