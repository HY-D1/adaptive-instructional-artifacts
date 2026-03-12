/**
 * Error Subtype Templates for Deterministic Textbook Generation
 * 
 * These templates provide rich, educationally useful content for common SQL error subtypes
 * WITHOUT requiring an LLM. They combine SQL-Engage error patterns with concept explanations.
 * 
 * This enables hosted deployments to work without Ollama while maintaining high-quality,
 * source-grounded instructional content.
 */

import { InstructionalUnit } from '../../types';

/**
 * Template for generating deterministic explanations
 */
export interface ErrorTemplate {
  /** Error subtype identifier (must match SQL-Engage canonical subtypes) */
  subtypeId: string;
  
  /** Human-readable title for this error type */
  title: string;
  
  /** Root cause explanation */
  rootCause: {
    /** Brief one-sentence summary */
    summary: string;
    /** Detailed explanation (2-3 sentences) */
    explanation: string;
  };
  
  /** Step-by-step fix instructions */
  fixSteps: string[];
  
  /** Code examples showing before/after */
  examples: {
    /** Description of what this example demonstrates */
    description: string;
    /** Incorrect code */
    before: string;
    /** Corrected code */
    after: string;
    /** Explanation of the fix */
    explanation: string;
  }[];
  
  /** Related concept IDs from concept registry */
  relatedConcepts: string[];
  
  /** Prevention tips */
  preventionTips: string[];
  
  /** SQL-Engage row references for source grounding */
  sqlEngagePatterns: string[];
}

/**
 * Rich templates for common SQL error subtypes
 * Covers the most frequent errors encountered in learning SQL
 */
export const ERROR_TEMPLATES: Record<string, ErrorTemplate> = {
  // ============================================================================
  // WHERE CLAUSE ERRORS
  // ============================================================================
  
  'incomplete query': {
    subtypeId: 'incomplete query',
    title: 'Incomplete SQL Query Structure',
    rootCause: {
      summary: 'Your SQL query is missing essential clauses or has incomplete syntax.',
      explanation: 'Every SELECT query requires at minimum a SELECT clause (what to retrieve) and a FROM clause (where to retrieve from). The query may be cut off, missing a semicolon, or have an incomplete clause like "SELECT * FROM" without a table name.'
    },
    fixSteps: [
      'Check that your query starts with SELECT',
      'Ensure you have a FROM clause with a valid table name',
      'Verify all string literals are properly quoted',
      'Check that parentheses and brackets are balanced',
      'End the query with a semicolon'
    ],
    examples: [
      {
        description: 'Missing table name in FROM clause',
        before: 'SELECT * FROM WHERE id = 1;',
        after: 'SELECT * FROM users WHERE id = 1;',
        explanation: 'The FROM clause requires a table name. Add the table name between FROM and WHERE.'
      },
      {
        description: 'Incomplete SELECT clause',
        before: 'SELECT FROM users;',
        after: 'SELECT * FROM users;',
        explanation: 'SELECT requires at least one column or * (wildcard) to specify what to retrieve.'
      }
    ],
    relatedConcepts: ['select-basic', 'syntax-error'],
    preventionTips: [
      'Use a query template: SELECT columns FROM table WHERE condition;',
      'Build queries incrementally: start with SELECT/FROM, then add WHERE',
      'Use an SQL editor with syntax highlighting to spot incomplete statements'
    ],
    sqlEngagePatterns: ['incomplete query', 'missing keyword', 'truncated query']
  },
  
  'undefined column': {
    subtypeId: 'undefined column',
    title: 'Column Not Found in Table',
    rootCause: {
      summary: 'You are referencing a column that does not exist in the specified table.',
      explanation: 'The column name in your query does not match any column in the table schema. This could be due to a typo, using a column from a different table, or the column not existing in the database.'
    },
    fixSteps: [
      'Check the table schema for the exact column names',
      'Verify you are querying the correct table',
      'Check for typos in the column name',
      'If joining tables, prefix the column with the table name: table.column',
      'Use SELECT * first to see all available columns'
    ],
    examples: [
      {
        description: 'Typo in column name',
        before: "SELECT usre_name FROM users;",
        after: "SELECT user_name FROM users;",
        explanation: 'The column was misspelled. Check the schema for the correct spelling.'
      },
      {
        description: 'Column from wrong table in JOIN',
        before: 'SELECT u.name, order_date FROM users u JOIN orders o ON u.id = o.user_id;',
        after: 'SELECT u.name, o.order_date FROM users u JOIN orders o ON u.id = o.user_id;',
        explanation: 'When joining tables, prefix columns with table aliases (o.order_date) to avoid ambiguity and ensure the correct table is referenced.'
      }
    ],
    relatedConcepts: ['select-basic', 'joins', 'ambiguous-column'],
    preventionTips: [
      'Keep the schema reference handy while writing queries',
      'Use table aliases and prefix all columns in multi-table queries',
      'Run DESCRIBE table_name or SELECT * FROM table_name LIMIT 1 to see column names'
    ],
    sqlEngagePatterns: ['undefined column', 'no such column', 'unknown column']
  },
  
  'undefined table': {
    subtypeId: 'undefined table',
    title: 'Table Not Found in Database',
    rootCause: {
      summary: 'The table you are trying to query does not exist in the database.',
      explanation: 'The table name in your FROM clause does not match any table in the database. This could be a typo, the table might not have been created yet, or you might be connected to the wrong database.'
    },
    fixSteps: [
      'Check for typos in the table name',
      'Verify the table exists using: SELECT name FROM sqlite_master WHERE type="table";',
      'Check that you are connected to the correct database',
      'If the table needs to be created, run the CREATE TABLE statement first',
      'Check for pluralization issues (user vs users, order vs orders)'
    ],
    examples: [
      {
        description: 'Typo in table name',
        before: 'SELECT * FROM usr;',
        after: 'SELECT * FROM users;',
        explanation: 'The table name was misspelled. Use the correct table name from the schema.'
      },
      {
        description: 'Singular instead of plural',
        before: 'SELECT * FROM user;',
        after: 'SELECT * FROM users;',
        explanation: 'Table names are typically plural. Check if the table uses singular or plural form.'
      }
    ],
    relatedConcepts: ['select-basic', 'joins'],
    preventionTips: [
      'Maintain a schema reference document',
      'Use consistent naming conventions (plural vs singular)',
      'Before writing queries, list available tables to confirm names'
    ],
    sqlEngagePatterns: ['undefined table', 'no such table', 'unknown table']
  },
  
  // ============================================================================
  // JOIN ERRORS
  // ============================================================================
  
  'ambiguous reference': {
    subtypeId: 'ambiguous reference',
    title: 'Ambiguous Column Reference',
    rootCause: {
      summary: 'A column name appears in multiple tables and needs to be qualified with a table name.',
      explanation: 'When joining two or more tables, columns with the same name (like "id" or "name") exist in multiple tables. SQL requires you to specify which table\'s column you want by using the table name or alias as a prefix.'
    },
    fixSteps: [
      'Identify which tables contain the column with the same name',
      'Add table aliases to your query using AS (e.g., FROM users AS u)',
      'Prefix the ambiguous column with the table alias: u.id instead of just id',
      'Be consistent and prefix ALL columns when joining tables for clarity'
    ],
    examples: [
      {
        description: 'Ambiguous id column in JOIN',
        before: 'SELECT id, name FROM users JOIN orders ON users.id = orders.user_id;',
        after: 'SELECT users.id, users.name FROM users JOIN orders ON users.id = orders.user_id;',
        explanation: 'Both tables have an "id" column. Specify which table\'s id you want in the SELECT clause.'
      },
      {
        description: 'Using table aliases for cleaner code',
        before: 'SELECT users.name, orders.total FROM users JOIN orders ON users.id = orders.user_id;',
        after: 'SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id;',
        explanation: 'Table aliases (u for users, o for orders) make queries shorter and easier to read while resolving ambiguity.'
      }
    ],
    relatedConcepts: ['joins', 'alias', 'ambiguous-column'],
    preventionTips: [
      'Always use table aliases when joining',
      'Prefix ALL columns with table aliases in multi-table queries, even non-ambiguous ones',
      'Use meaningful aliases: u for users, o for orders, p for products'
    ],
    sqlEngagePatterns: ['ambiguous column', 'ambiguous reference', 'ambiguous identifier']
  },
  
  'incorrect join usage': {
    subtypeId: 'incorrect join usage',
    title: 'Incorrect JOIN Syntax or Condition',
    rootCause: {
      summary: 'The JOIN clause is missing an ON condition or uses incorrect syntax.',
      explanation: 'JOIN operations require an ON clause to specify how the tables relate to each other. Without this condition, the database doesn\'t know which rows from each table should be matched together, resulting in a Cartesian product or syntax error.'
    },
    fixSteps: [
      'Add an ON clause after the JOIN specifying the relationship',
      'Identify the common column(s) between the tables (foreign key relationship)',
      'Write the condition as: table1.column = table2.column',
      'Ensure the column types match on both sides of the equality',
      'For multiple conditions, use AND to combine them'
    ],
    examples: [
      {
        description: 'Missing ON clause',
        before: 'SELECT * FROM users JOIN orders;',
        after: 'SELECT * FROM users JOIN orders ON users.id = orders.user_id;',
        explanation: 'The JOIN requires an ON clause to specify that users.id matches orders.user_id.'
      },
      {
        description: 'Complex join with multiple conditions',
        before: 'SELECT * FROM employees JOIN departments;',
        after: 'SELECT * FROM employees e JOIN departments d ON e.dept_id = d.id AND e.status = "active";',
        explanation: 'Multiple conditions in the ON clause allow for more specific matching. Always include the foreign key relationship.'
      }
    ],
    relatedConcepts: ['joins', 'join-condition-missing', 'inner-join'],
    preventionTips: [
      'Memorize the pattern: FROM table1 JOIN table2 ON table1.col = table2.col',
      'Draw the relationship diagram before writing the query',
      'Always identify the foreign key columns before joining'
    ],
    sqlEngagePatterns: ['incorrect join usage', 'missing join condition', 'cartesian product']
  },
  
  // ============================================================================
  // AGGREGATION ERRORS
  // ============================================================================
  
  'aggregation misuse': {
    subtypeId: 'aggregation misuse',
    title: 'Incorrect Use of Aggregate Functions',
    rootCause: {
      summary: 'Aggregate functions (COUNT, SUM, AVG, etc.) are being used incorrectly.',
      explanation: 'Aggregate functions collapse multiple rows into a single value. Common mistakes include: mixing aggregated and non-aggregated columns without GROUP BY, using aggregates in WHERE clauses, or applying aggregates to the wrong columns.'
    },
    fixSteps: [
      'If using GROUP BY, include ALL non-aggregated columns in the GROUP BY clause',
      'Move aggregate conditions from WHERE to HAVING clause',
      'Ensure you are applying aggregates to the correct column',
      'Check that NULL handling is appropriate for your use case',
      'Verify the data type supports the aggregate function (e.g., SUM needs numbers)'
    ],
    examples: [
      {
        description: 'Missing GROUP BY for non-aggregated column',
        before: 'SELECT department, COUNT(*) FROM employees;',
        after: 'SELECT department, COUNT(*) FROM employees GROUP BY department;',
        explanation: 'When selecting a non-aggregated column (department) with an aggregate (COUNT), you must GROUP BY that column.'
      },
      {
        description: 'Aggregate in WHERE instead of HAVING',
        before: 'SELECT department, COUNT(*) FROM employees WHERE COUNT(*) > 5 GROUP BY department;',
        after: 'SELECT department, COUNT(*) FROM employees GROUP BY department HAVING COUNT(*) > 5;',
        explanation: 'WHERE filters rows before aggregation. HAVING filters after. Use HAVING for conditions on aggregate values.'
      }
    ],
    relatedConcepts: ['aggregation', 'group-by', 'having-clause'],
    preventionTips: [
      'Remember: SELECT columns must be either aggregated or in GROUP BY',
      'Use WHERE for row filtering, HAVING for group filtering',
      'Test aggregates on small datasets first to verify logic'
    ],
    sqlEngagePatterns: ['aggregation misuse', 'aggregate error', 'group by error']
  },
  
  'incorrect group by usage': {
    subtypeId: 'incorrect group by usage',
    title: 'GROUP BY Clause Errors',
    rootCause: {
      summary: 'The GROUP BY clause is missing required columns or contains incorrect columns.',
      explanation: 'In standard SQL, every column in the SELECT clause that is not wrapped in an aggregate function must appear in the GROUP BY clause. This ensures the database knows how to group rows for aggregation.'
    },
    fixSteps: [
      'List all non-aggregated columns from your SELECT clause',
      'Add all of them to the GROUP BY clause',
      'Ensure the order of columns in GROUP BY matches your logical grouping needs',
      'Remove unnecessary columns from SELECT if they do not need to be grouped',
      'Consider using MIN/MAX if you need additional columns without grouping by them'
    ],
    examples: [
      {
        description: 'Missing column in GROUP BY',
        before: 'SELECT department, job_title, AVG(salary) FROM employees GROUP BY department;',
        after: 'SELECT department, job_title, AVG(salary) FROM employees GROUP BY department, job_title;',
        explanation: 'Both non-aggregated columns (department and job_title) must be in GROUP BY.'
      },
      {
        description: 'GROUP BY with all necessary columns',
        before: 'SELECT dept_id, COUNT(*), MAX(hire_date) FROM employees;',
        after: 'SELECT dept_id, COUNT(*), MAX(hire_date) FROM employees GROUP BY dept_id;',
        explanation: 'dept_id is the only non-aggregated column, so it is the only one needed in GROUP BY.'
      }
    ],
    relatedConcepts: ['group-by', 'aggregation', 'group-by-error'],
    preventionTips: [
      'Write SELECT and GROUP BY together: non-aggregated columns go in both',
      'Use the "functional dependency" rule: grouped columns determine non-aggregated values',
      'Some databases are more lenient, but always including all columns ensures portability'
    ],
    sqlEngagePatterns: ['incorrect group by usage', 'missing group by', 'group by compliance']
  },
  
  'incorrect having clause': {
    subtypeId: 'incorrect having clause',
    title: 'HAVING Clause Misuse',
    rootCause: {
      summary: 'HAVING is being used incorrectly or filters are placed in the wrong clause.',
      explanation: 'HAVING filters groups after aggregation, while WHERE filters individual rows before aggregation. HAVING can only reference grouped columns or aggregate expressions. Putting row-level conditions in HAVING or aggregate conditions in WHERE causes errors.'
    },
    fixSteps: [
      'Move row-level conditions (on non-aggregated columns) to WHERE',
      'Keep aggregate conditions (COUNT, SUM, etc.) in HAVING',
      'Ensure HAVING references only grouped columns or aggregates',
      'Remember execution order: WHERE → GROUP BY → HAVING → SELECT',
      'Use column aliases from SELECT carefully (some databases do not allow them in HAVING)'
    ],
    examples: [
      {
        description: 'Row condition incorrectly in HAVING',
        before: 'SELECT dept, COUNT(*) FROM employees HAVING salary > 50000 GROUP BY dept;',
        after: 'SELECT dept, COUNT(*) FROM employees WHERE salary > 50000 GROUP BY dept;',
        explanation: 'salary > 50000 filters individual rows, so it belongs in WHERE, not HAVING.'
      },
      {
        description: 'Correct use of HAVING for aggregate condition',
        before: 'SELECT dept, COUNT(*) FROM employees WHERE COUNT(*) > 5 GROUP BY dept;',
        after: 'SELECT dept, COUNT(*) FROM employees GROUP BY dept HAVING COUNT(*) > 5;',
        explanation: 'COUNT(*) > 5 filters groups, so it must be in HAVING, not WHERE.'
      }
    ],
    relatedConcepts: ['having-clause', 'aggregation', 'group-by'],
    preventionTips: [
      'Use WHERE for row filtering, HAVING for group filtering',
      'Remember: HAVING is like WHERE for groups',
      'If your condition references an aggregate function, it goes in HAVING'
    ],
    sqlEngagePatterns: ['incorrect having clause', 'having misuse', 'wrong filter placement']
  },
  
  // ============================================================================
  // SYNTAX ERRORS
  // ============================================================================
  
  'wrong positioning': {
    subtypeId: 'wrong positioning',
    title: 'SQL Clauses in Wrong Order',
    rootCause: {
      summary: 'SQL clauses are not in the correct execution order.',
      explanation: 'SQL has a required order for clauses: SELECT → FROM → JOIN → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT. Placing clauses in the wrong order (like WHERE before FROM, or HAVING before GROUP BY) causes syntax errors.'
    },
    fixSteps: [
      'Follow the standard SQL order: SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY',
      'Check that FROM immediately follows SELECT (or column list)',
      'Ensure WHERE comes before GROUP BY, not after',
      'Place ORDER BY at the end, before LIMIT if present',
      'Use a query formatter or template to maintain correct order'
    ],
    examples: [
      {
        description: 'WHERE before FROM (incorrect)',
        before: 'SELECT * WHERE age > 18 FROM users;',
        after: 'SELECT * FROM users WHERE age > 18;',
        explanation: 'FROM must come before WHERE. The correct order is SELECT → FROM → WHERE.'
      },
      {
        description: 'Complex query with correct ordering',
        before: 'SELECT dept HAVING COUNT(*) > 5 FROM employees GROUP BY dept;',
        after: 'SELECT dept, COUNT(*) FROM employees GROUP BY dept HAVING COUNT(*) > 5;',
        explanation: 'HAVING must come after GROUP BY. Also, aggregates in SELECT should match those in HAVING.'
      }
    ],
    relatedConcepts: ['syntax-error', 'select-basic', 'order-by'],
    preventionTips: [
      'Memorize the clause order: SELECT FROM WHERE GROUP BY HAVING ORDER BY',
      'Use the mnemonic: "Sally Finds William\'s Green House Overlooking Lakes"',
      'SQL editors with syntax highlighting can help catch ordering errors'
    ],
    sqlEngagePatterns: ['wrong positioning', 'incorrect clause order', 'syntax order error']
  },
  
  'missing commas': {
    subtypeId: 'missing commas',
    title: 'Missing Comma in Column or Table List',
    rootCause: {
      summary: 'A comma is missing between column names or table references.',
      explanation: 'In SQL, multiple columns in SELECT or multiple tables in FROM must be separated by commas. Missing a comma causes the parser to interpret the next identifier as part of the previous expression, leading to syntax errors.'
    },
    fixSteps: [
      'Check between each column in your SELECT list',
      'Verify commas between tables in multi-table FROM clauses',
      'Look for missing commas in INSERT VALUES lists',
      'Ensure commas in JOIN conditions are correct',
      'Format with one item per line to make missing commas visible'
    ],
    examples: [
      {
        description: 'Missing comma between columns',
        before: 'SELECT name age city FROM users;',
        after: 'SELECT name, age, city FROM users;',
        explanation: 'Columns in SELECT must be separated by commas.'
      },
      {
        description: 'Missing comma in INSERT',
        before: "INSERT INTO users (name age) VALUES ('John', 25);",
        after: "INSERT INTO users (name, age) VALUES ('John', 25);",
        explanation: 'Column lists in parentheses also require commas between items.'
      }
    ],
    relatedConcepts: ['syntax-error', 'select-basic'],
    preventionTips: [
      'Put each column on a separate line in SELECT',
      'Add the comma at the start of the line, not the end (easier to spot)',
      'Use a code formatter to automatically fix comma placement'
    ],
    sqlEngagePatterns: ['missing commas', 'comma error', 'separator missing']
  },
  
  'unmatched brackets': {
    subtypeId: 'unmatched brackets',
    title: 'Unmatched Parentheses or Brackets',
    rootCause: {
      summary: 'Opening and closing parentheses or brackets do not match.',
      explanation: 'Every opening parenthesis ( must have a corresponding closing parenthesis ). This applies to function calls, subqueries, expressions, and list definitions. Mismatched brackets cause the parser to fail.'
    },
    fixSteps: [
      'Count all opening and closing parentheses to ensure they match',
      'Check function calls: COUNT(*) needs both parentheses',
      'Verify subqueries have closing parentheses: (SELECT ...)',
      'Check IN clauses: IN (1, 2, 3) needs parentheses around the list',
      'Use an editor with bracket matching to visualize pairs'
    ],
    examples: [
      {
        description: 'Missing closing parenthesis in function',
        before: 'SELECT COUNT(*) FROM users;',
        after: 'SELECT COUNT(*) FROM users;',
        explanation: 'Function calls like COUNT require both opening and closing parentheses.'
      },
      {
        description: 'Unmatched parentheses in expression',
        before: 'SELECT * FROM users WHERE (age > 18 AND (city = "NYC";',
        after: 'SELECT * FROM users WHERE (age > 18 AND (city = "NYC"));',
        explanation: 'Each opening parenthesis must have a matching closing one. Complex expressions need careful counting.'
      }
    ],
    relatedConcepts: ['syntax-error', 'select-basic'],
    preventionTips: [
      'Type the closing parenthesis immediately after the opening one, then fill in the content',
      'Use an editor that highlights matching brackets',
      'Format complex expressions with indentation to visualize nesting'
    ],
    sqlEngagePatterns: ['unmatched brackets', 'unclosed parenthesis', 'bracket mismatch']
  },
  
  'misspelling': {
    subtypeId: 'misspelling',
    title: 'Misspelled SQL Keyword or Identifier',
    rootCause: {
      summary: 'A SQL keyword, table name, or column name is misspelled.',
      explanation: 'SQL keywords (SELECT, FROM, WHERE, etc.) and identifiers (table/column names) must be spelled correctly. SQL is case-insensitive for keywords, but table and column names may be case-sensitive depending on the database.'
    },
    fixSteps: [
      'Check common keyword misspellings: S-E-L-E-C-T, F-R-O-M, W-H-E-R-E',
      'Verify table and column names match the schema exactly',
      'Check for common typos: recieve/receive, occured/occurred',
      'Ensure consistent casing for identifiers',
      'Use autocomplete/IntelliSense in your SQL editor'
    ],
    examples: [
      {
        description: 'Misspelled SELECT',
        before: 'SELET * FROM users;',
        after: 'SELECT * FROM users;',
        explanation: 'SELECT is the correct spelling of the SQL keyword.'
      },
      {
        description: 'Misspelled column name',
        before: 'SELECT emial FROM users;',
        after: 'SELECT email FROM users;',
        explanation: 'Column names must match the schema exactly. Check for transposed letters.'
      }
    ],
    relatedConcepts: ['syntax-error', 'undefined column'],
    preventionTips: [
      'Use SQL auto-completion in your editor',
      'Copy table/column names from the schema rather than typing them',
      'Enable spell checking for SQL identifiers in your editor'
    ],
    sqlEngagePatterns: ['misspelling', 'typo', 'incorrect spelling']
  },
  
  // ============================================================================
  // DATA TYPE ERRORS
  // ============================================================================
  
  'data type mismatch': {
    subtypeId: 'data type mismatch',
    title: 'Data Type Mismatch in Comparison or Operation',
    rootCause: {
      summary: 'You are comparing or operating on incompatible data types.',
      explanation: 'SQL requires compatible types for comparisons and operations. For example, you cannot compare a date to a string without conversion, or add a number to a text column. Implicit conversions may fail or produce unexpected results.'
    },
    fixSteps: [
      'Check the data types of columns using the schema',
      'Use explicit type conversion functions: CAST(column AS type)',
      'Ensure string literals match the expected format for date/datetime columns',
      'Compare numbers to numbers, strings to strings, dates to dates',
      'Use appropriate functions for the data type (e.g., DATE() for date operations)'
    ],
    examples: [
      {
        description: 'Comparing string to number',
        before: "SELECT * FROM products WHERE price = 'expensive';",
        after: 'SELECT * FROM products WHERE price > 100;',
        explanation: 'Price is a numeric column. Compare it to numeric values, not strings.'
      },
      {
        description: 'Date comparison without proper format',
        before: "SELECT * FROM orders WHERE order_date > 'January 1, 2023';",
        after: "SELECT * FROM orders WHERE order_date > '2023-01-01';",
        explanation: 'Use ISO format (YYYY-MM-DD) for date literals to ensure proper comparison.'
      }
    ],
    relatedConcepts: ['data-types', 'where-clause'],
    preventionTips: [
      'Know your schema: keep track of which columns are numeric, text, date, etc.',
      'Use explicit CAST when converting between types',
      'Use ISO date formats (YYYY-MM-DD) for portability'
    ],
    sqlEngagePatterns: ['data type mismatch', 'type error', 'datatype mismatch']
  },
  
  // ============================================================================
  // OPERATOR ERRORS
  // ============================================================================
  
  'operator misuse': {
    subtypeId: 'operator misuse',
    title: 'Incorrect Use of SQL Operator',
    rootCause: {
      summary: 'An operator is being used incorrectly for the data types or context.',
      explanation: 'SQL operators (=, <, >, LIKE, IN, BETWEEN, etc.) have specific requirements. For example, = NULL never matches (use IS NULL), and LIKE requires wildcard patterns. Using operators incorrectly produces unexpected results or errors.'
    },
    fixSteps: [
      'Use IS NULL / IS NOT NULL instead of = NULL or != NULL',
      'Ensure LIKE patterns include wildcards (% for any chars, _ for single char)',
      'Check that IN lists are properly formatted: IN (val1, val2, val3)',
      'Use BETWEEN with correct syntax: BETWEEN low AND high',
      'Verify operator precedence and use parentheses when mixing AND/OR'
    ],
    examples: [
      {
        description: 'Using = NULL instead of IS NULL',
        before: 'SELECT * FROM users WHERE email = NULL;',
        after: 'SELECT * FROM users WHERE email IS NULL;',
        explanation: '= NULL never returns true because NULL represents unknown. Use IS NULL to check for NULL values.'
      },
      {
        description: 'LIKE without wildcards',
        before: "SELECT * FROM users WHERE name LIKE 'John';",
        after: "SELECT * FROM users WHERE name LIKE '%John%';",
        explanation: 'LIKE without wildcards is the same as =. Use % to match any sequence of characters.'
      }
    ],
    relatedConcepts: ['null-handling', 'where-clause', 'like-pattern'],
    preventionTips: [
      'Always use IS NULL, never = NULL',
      'Remember: NULL is not equal to anything, not even another NULL',
      'Test LIKE patterns separately to ensure they match what you expect'
    ],
    sqlEngagePatterns: ['operator misuse', 'null comparison error', 'like error']
  },
  
  'non-standard operators': {
    subtypeId: 'non-standard operators',
    title: 'Non-Standard SQL Operator',
    rootCause: {
      summary: 'An operator from a different SQL dialect is being used.',
      explanation: 'Different database systems have different operators for the same operations. For example, string concatenation uses || in standard SQL but + in SQL Server, and != is not standard (use <> instead). Using non-standard operators causes errors.'
    },
    fixSteps: [
      'Use standard SQL operators: <> for not-equal (not !=), || for concatenation',
      'Avoid dialect-specific operators like TOP (use LIMIT)',
      'Check your database documentation for supported operators',
      'Use functions instead of operators when possible for portability',
      'Be aware of differences: AND vs &&, OR vs || in different dialects'
    ],
    examples: [
      {
        description: 'Using != instead of <>',
        before: 'SELECT * FROM users WHERE status != "active";',
        after: 'SELECT * FROM users WHERE status <> "active";',
        explanation: '<> is the standard SQL operator for not-equal. != works in some databases but not all.'
      },
      {
        description: 'Using + for string concatenation',
        before: "SELECT first_name + ' ' + last_name FROM users;",
        after: "SELECT first_name || ' ' || last_name FROM users;",
        explanation: 'Standard SQL uses || for string concatenation. + is SQL Server-specific.'
      }
    ],
    relatedConcepts: ['syntax-error', 'string-functions'],
    preventionTips: [
      'Learn standard SQL operators for maximum portability',
      'Use || for concatenation, <> for not-equal',
      'Test queries on your target database to verify operator support'
    ],
    sqlEngagePatterns: ['non-standard operators', 'dialect error', 'operator not recognized']
  }
};

/**
 * Get a template for a specific error subtype
 * Falls back to a generic template if not found
 */
export function getErrorTemplate(subtypeId: string): ErrorTemplate {
  const normalizedId = subtypeId?.trim().toLowerCase() || '';
  
  // Direct lookup
  if (ERROR_TEMPLATES[normalizedId]) {
    return ERROR_TEMPLATES[normalizedId];
  }
  
  // Try matching against sqlEngagePatterns
  for (const [key, template] of Object.entries(ERROR_TEMPLATES)) {
    if (template.sqlEngagePatterns.some(pattern => 
      normalizedId.includes(pattern) || pattern.includes(normalizedId)
    )) {
      return template;
    }
  }
  
  // Return generic fallback template
  return createGenericTemplate(normalizedId);
}

/**
 * Create a generic template for unknown error subtypes
 */
function createGenericTemplate(subtypeId: string): ErrorTemplate {
  return {
    subtypeId: 'unknown-error',
    title: `SQL Error: ${subtypeId || 'Unknown Error'}`,
    rootCause: {
      summary: 'An error occurred while executing your SQL query.',
      explanation: `The error subtype "${subtypeId || 'unknown'}" indicates an issue with your SQL syntax or logic. Review the error message and your query carefully to identify the problem.`
    },
    fixSteps: [
      'Read the error message carefully for clues about the problem',
      'Check your SQL syntax against a reference',
      'Verify table and column names are spelled correctly',
      'Ensure all parentheses and quotes are balanced',
      'Test with a simpler query and build up incrementally'
    ],
    examples: [
      {
        description: 'General debugging approach',
        before: '-- Your current query with error',
        after: '-- Start with: SELECT * FROM table_name LIMIT 1;',
        explanation: 'Simplify your query to isolate the problem, then add complexity back one piece at a time.'
      }
    ],
    relatedConcepts: ['syntax-error', 'select-basic'],
    preventionTips: [
      'Use an SQL editor with syntax highlighting',
      'Test queries incrementally: SELECT, then add WHERE, then add GROUP BY',
      'Keep a reference of common SQL syntax handy'
    ],
    sqlEngagePatterns: ['generic error', 'unknown error', subtypeId]
  };
}

/**
 * Get all available error template IDs
 */
export function getErrorTemplateIds(): string[] {
  return Object.keys(ERROR_TEMPLATES);
}

/**
 * Check if a template exists for a specific subtype
 */
export function hasErrorTemplate(subtypeId: string): boolean {
  return subtypeId in ERROR_TEMPLATES;
}

/**
 * Get templates for multiple subtypes
 */
export function getTemplatesForSubtypes(subtypeIds: string[]): ErrorTemplate[] {
  return subtypeIds
    .map(id => getErrorTemplate(id))
    .filter((template, index, self) => 
      // Remove duplicates based on subtypeId
      self.findIndex(t => t.subtypeId === template.subtypeId) === index
    );
}

/**
 * Extract concept IDs from templates for a list of subtypes
 */
export function getRelatedConceptIds(subtypeIds: string[]): string[] {
  const conceptIds = new Set<string>();
  
  for (const subtypeId of subtypeIds) {
    const template = getErrorTemplate(subtypeId);
    for (const conceptId of template.relatedConcepts) {
      conceptIds.add(conceptId);
    }
  }
  
  return Array.from(conceptIds);
}
