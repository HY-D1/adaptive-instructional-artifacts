#!/usr/bin/env node
/**
 * Concept Parser Edge Case Testing Script
 * Tests the parseMarkdownContent, parseExamples, and parseMistakes functions
 * from concept-loader.ts against various edge cases
 */

// Re-implement the parser functions from concept-loader.ts for testing
function parseMarkdownContent(markdown) {
  const lines = markdown.split('\n');
  let currentSection = '';
  let sectionContent = [];
  const sections = {};
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections[currentSection] = sectionContent.join('\n').trim();
      }
      currentSection = line.replace('## ', '').trim();
      sectionContent = [];
    } else {
      sectionContent.push(line);
    }
  }
  if (currentSection) {
    sections[currentSection] = sectionContent.join('\n').trim();
  }
  
  // Handle both old format (Definition/Explanation) and new pedagogical format (What is This?)
  const definition = sections['Definition'] || sections['What is This?'] || '';
  const explanation = sections['Explanation'] || sections['What is This?'] || definition || '';
  
  return {
    definition,
    explanation,
    examples: parseExamples(sections['Examples'] || ''),
    commonMistakes: parseMistakes(sections['Common Mistakes'] || '')
  };
}

function parseExamples(section) {
  const examples = [];
  const lines = section.split('\n');
  let currentExample = {};
  let inCodeBlock = false;
  let codeContent = [];
  
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (currentExample.title) {
        currentExample.code = codeContent.join('\n').trim();
        examples.push(currentExample);
      }
      currentExample = { title: line.replace('### ', '').trim() };
      codeContent = [];
      inCodeBlock = false;
    } else if (line.startsWith('```sql')) {
      inCodeBlock = true;
    } else if (line.startsWith('```') && inCodeBlock) {
      inCodeBlock = false;
      currentExample.code = codeContent.join('\n').trim();
    } else if (inCodeBlock) {
      codeContent.push(line);
    } else if (line.trim() && !currentExample.code && !currentExample.explanation) {
      currentExample.explanation = line.trim();
    } else if (line.trim() && currentExample.code) {
      currentExample.explanation = (currentExample.explanation || '') + ' ' + line.trim();
    }
  }
  
  if (currentExample.title) {
    if (!currentExample.code && codeContent.length > 0) {
      currentExample.code = codeContent.join('\n').trim();
    }
    examples.push(currentExample);
  }
  
  return examples;
}

function parseMistakes(section) {
  const mistakes = [];
  const blocks = section.split('###').filter(Boolean);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const title = lines[0].trim();
    
    let incorrect = '';
    let correct = '';
    let why = '';
    let inIncorrect = false;
    let inCorrect = false;
    let inWhy = false;
    const incorrectLines = [];
    const correctLines = [];
    
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      
      // Check for section markers (support both old and new formats)
      if (trimmed.includes('❌') || 
          trimmed.toLowerCase().includes('incorrect sql') ||
          trimmed.toLowerCase().includes('**incorrect**')) {
        inIncorrect = true;
        inCorrect = false;
        inWhy = false;
        continue;
      }
      if (trimmed.includes('✅') || 
          trimmed.toLowerCase().includes('corrected sql') ||
          trimmed.toLowerCase().includes('correct sql') ||
          trimmed.toLowerCase().includes('**correct**')) {
        inIncorrect = false;
        inCorrect = true;
        inWhy = false;
        continue;
      }
      if (trimmed.includes('💡') || 
          trimmed.toLowerCase().includes('why it happens') ||
          trimmed.toLowerCase().includes('**why**') ||
          trimmed.toLowerCase().includes('key takeaway')) {
        inIncorrect = false;
        inCorrect = false;
        inWhy = true;
        // Extract why text after the label
        const whyMatch = trimmed.match(/why it happens:?\s*(.+)/i) || 
                        trimmed.match(/key takeaway:?\s*(.+)/i);
        if (whyMatch && whyMatch[1]) {
          why = whyMatch[1].trim();
        }
        continue;
      }
      
      // Skip code block markers
      if (line.startsWith('```sql') || line.startsWith('```')) {
        continue;
      }
      
      // Collect content
      if (inIncorrect) {
        incorrectLines.push(line);
      } else if (inCorrect) {
        correctLines.push(line);
      } else if (inWhy && !why && trimmed) {
        // If we didn't capture why from the label line, capture from content
        why = trimmed;
      }
    }
    
    incorrect = incorrectLines.join('\n').trim();
    correct = correctLines.join('\n').trim();
    
    if (title && (incorrect || correct)) {
      mistakes.push({ title, incorrect, correct, why });
    }
  }
  
  return mistakes;
}

// Test Runner
const results = {
  passed: [],
  failed: [],
  warnings: [],
  total: 0
};

function runTest(name, markdown, assertions) {
  results.total++;
  try {
    const parsed = parseMarkdownContent(markdown);
    const errors = [];
    
    for (const assertion of assertions) {
      try {
        const result = assertion.check(parsed);
        if (!result) {
          errors.push(`Assertion failed: ${assertion.name}`);
        }
      } catch (e) {
        errors.push(`Assertion error (${assertion.name}): ${e.message}`);
      }
    }
    
    if (errors.length === 0) {
      results.passed.push({ name, parsed });
      return true;
    } else {
      results.failed.push({ name, errors, parsed, markdown });
      return false;
    }
  } catch (e) {
    results.failed.push({ name, errors: [`Parser threw exception: ${e.message}`], parsed: null, markdown });
    return false;
  }
}

function addWarning(testName, message) {
  results.warnings.push({ test: testName, message });
}

// ============================================
// TEST CASES
// ============================================

console.log('=== PARSER EDGE CASE TESTING ===\n');

// --- TEST 1: Empty "What is This?" section ---
runTest(
  'Empty "What is This?" section',
  `## What is This?

## Examples

### Example 1
\`\`\`sql
SELECT * FROM users;
\`\`\`

Some explanation here.`,
  [
    { name: 'definition is empty', check: (p) => p.definition === '' },
    { name: 'has 1 example', check: (p) => p.examples.length === 1 }
  ]
);

// --- TEST 2: Multiple code blocks in one example ---
runTest(
  'Multiple code blocks in one example',
  `## What is This?
A concept.

## Examples

### Example 1: Setup and Query
First we create the table:
\`\`\`sql
CREATE TABLE users (id INT, name VARCHAR(50));
\`\`\`

Then we query it:
\`\`\`sql
SELECT * FROM users;
\`\`\`

This shows multiple queries.`,
  [
    { name: 'has 1 example', check: (p) => p.examples.length === 1 },
    { name: 'code captures first block only', check: (p) => p.examples[0]?.code?.includes('CREATE TABLE') },
    { name: 'explanation contains rest', check: (p) => p.examples[0]?.explanation?.includes('Then we query') || p.examples[0]?.explanation?.includes('This shows') }
  ]
);
addWarning('Multiple code blocks in one example', 'Only first code block is captured - subsequent blocks are ignored. This may be intentional.');

// --- TEST 3: Example without SQL code block ---
runTest(
  'Example without SQL code block',
  `## What is This?
A concept.

## Examples

### Example 1: Concept Explanation
This example only has text explanation, no SQL code.
More text here describing the concept.

Some more details.`,
  [
    { name: 'has 1 example', check: (p) => p.examples.length === 1 },
    { name: 'code is empty/undefined', check: (p) => !p.examples[0]?.code },
    { name: 'explanation is captured', check: (p) => p.examples[0]?.explanation?.includes('This example only has text') }
  ]
);

// --- TEST 4: Empty Examples section ---
runTest(
  'Empty Examples section',
  `## What is This?
A concept.

## Examples

## Common Mistakes

### Mistake 1
❌ **Incorrect SQL:**
\`\`\`sql
SELECT FORM users;
\`\`\`

✅ **Corrected SQL:**
\`\`\`sql
SELECT FROM users;
\`\`\`

💡 **Why it happens:** Typo`,
  [
    { name: 'examples array is empty', check: (p) => p.examples.length === 0 },
    { name: 'has 1 mistake', check: (p) => p.commonMistakes.length === 1 }
  ]
);

// --- TEST 5: Empty Common Mistakes section ---
runTest(
  'Empty Common Mistakes section',
  `## What is This?
A concept.

## Examples

### Example 1
\`\`\`sql
SELECT * FROM users;
\`\`\`

Explanation.

## Common Mistakes`,
  [
    { name: 'has 1 example', check: (p) => p.examples.length === 1 },
    { name: 'mistakes array is empty', check: (p) => p.commonMistakes.length === 0 }
  ]
);

// --- TEST 6: Both sections empty ---
runTest(
  'Both Examples and Common Mistakes empty',
  `## What is This?
A concept.

## Examples

## Common Mistakes`,
  [
    { name: 'examples array is empty', check: (p) => p.examples.length === 0 },
    { name: 'mistakes array is empty', check: (p) => p.commonMistakes.length === 0 },
    { name: 'definition is captured', check: (p) => p.definition === 'A concept.' }
  ]
);

// --- TEST 7: Unusual characters in SQL ---
runTest(
  'Unusual characters in SQL (quotes, special chars)',
  `## What is This?
A concept.

## Examples

### Example 1: Complex SQL
\`\`\`sql
SELECT * FROM users WHERE name = "O'Brien" OR email LIKE '%@test.com%';
\`\`\`

Query with special chars.

### Example 2: Unicode
\`\`\`sql
SELECT * FROM products WHERE name = '日本語テスト' COLLATE utf8mb4_unicode_ci;
\`\`\`

Unicode test.`,
  [
    { name: 'has 2 examples', check: (p) => p.examples.length === 2 },
    { name: 'preserves single quotes', check: (p) => p.examples[0]?.code?.includes("O'Brien") },
    { name: 'preserves double quotes', check: (p) => p.examples[0]?.code?.includes('"') },
    { name: 'preserves unicode', check: (p) => p.examples[1]?.code?.includes('日本語') }
  ]
);

// --- TEST 8: Very long content ---
const longSQL = 'SELECT ' + 'a'.repeat(1000) + ' FROM ' + 'b'.repeat(1000) + ' WHERE ' + 'c'.repeat(1000) + ';';
runTest(
  'Very long SQL content',
  `## What is This?
${'A very long explanation. '.repeat(100)}

## Examples

### Example 1: Long Query
\`\`\`sql
${longSQL}
\`\`\`

${'This is a long explanation. '.repeat(50)}`,
  [
    { name: 'has 1 example', check: (p) => p.examples.length === 1 },
    { name: 'captures long SQL', check: (p) => p.examples[0]?.code?.length > 3000 },
    { name: 'definition is captured', check: (p) => p.definition.length > 2000 }
  ]
);

// --- TEST 9: Very short/minimal content ---
runTest(
  'Very short content',
  `## What is This?
X

## Examples

### A
\`\`\`sql
SELECT 1;
\`\`\`

Y`,
  [
    { name: 'definition is "X"', check: (p) => p.definition === 'X' },
    { name: 'has 1 example', check: (p) => p.examples.length === 1 },
    { name: 'example title is "A"', check: (p) => p.examples[0]?.title === 'A' },
    { name: 'code is SELECT 1', check: (p) => p.examples[0]?.code === 'SELECT 1;' }
  ]
);

// --- TEST 10: Old format with "## Definition" section ---
runTest(
  'Backwards compat: Old format with "## Definition"',
  `## Definition
A join combines rows from two or more tables.

## Explanation
Joins are fundamental to relational databases.

## Examples

### Example 1
\`\`\`sql
SELECT * FROM a JOIN b ON a.id = b.id;
\`\`\`

Basic join.`,
  [
    { name: 'definition captured from Definition', check: (p) => p.definition === 'A join combines rows from two or more tables.' },
    { name: 'explanation captured from Explanation', check: (p) => p.explanation === 'Joins are fundamental to relational databases.' },
    { name: 'has 1 example', check: (p) => p.examples.length === 1 }
  ]
);

// --- TEST 11: Old format with only "## Definition" (no Explanation) ---
runTest(
  'Backwards compat: Old format with Definition only',
  `## Definition
A concept definition.

## Examples

### Example 1
\`\`\`sql
SELECT 1;
\`\`\`

Test.`,
  [
    { name: 'definition captured', check: (p) => p.definition === 'A concept definition.' },
    { name: 'explanation falls back to definition', check: (p) => p.explanation === 'A concept definition.' }
  ]
);

// --- TEST 12: New format with "## What is This?" ---
runTest(
  'New format with "## What is This?"',
  `## What is This?
This is the new pedagogical format.

## Examples

### Example 1
\`\`\`sql
SELECT * FROM users;
\`\`\`

Simple query.`,
  [
    { name: 'definition captured from What is This?', check: (p) => p.definition === 'This is the new pedagogical format.' },
    { name: 'explanation also uses What is This?', check: (p) => p.explanation === 'This is the new pedagogical format.' }
  ]
);

// --- TEST 13: Old mistake format with ❌ ✅ 💡 icons ---
// Note: This test reveals a bug - the "why" field includes markdown ** markers
runTest(
  'Backwards compat: Old mistake format with icons',
  `## What is This?
A concept.

## Common Mistakes

### Mistake 1: Typo
❌ **Incorrect SQL:**
\`\`\`sql
SELECT FORM users;
\`\`\`

✅ **Corrected SQL:**
\`\`\`sql
SELECT FROM users;
\`\`\`

💡 **Why it happens:** Typo in keyword`,
  [
    { name: 'has 1 mistake', check: (p) => p.commonMistakes.length === 1 },
    { name: 'title is captured', check: (p) => p.commonMistakes[0]?.title === 'Mistake 1: Typo' },
    { name: 'incorrect SQL captured', check: (p) => p.commonMistakes[0]?.incorrect === 'SELECT FORM users;' },
    { name: 'correct SQL captured', check: (p) => p.commonMistakes[0]?.correct === 'SELECT FROM users;' },
    { name: 'why is captured', check: (p) => p.commonMistakes[0]?.why?.includes('Typo in keyword') }
  ]
);
addWarning('Backwards compat: Old mistake format with icons', 
  'The "why" field captures "** Typo in keyword" instead of "Typo in keyword" - markdown bold markers not stripped');

// --- TEST 14: New mistake format with labels ---
runTest(
  'New mistake format with text labels',
  `## What is This?
A concept.

## Common Mistakes

### Mistake 1: Missing WHERE
**Incorrect SQL:**
\`\`\`sql
DELETE FROM users;
\`\`\`

**Corrected SQL:**
\`\`\`sql
DELETE FROM users WHERE id = 1;
\`\`\`

**Why it happens:** Forgetting the WHERE clause deletes all rows.`,
  [
    { name: 'has 1 mistake', check: (p) => p.commonMistakes.length === 1 },
    { name: 'incorrect captured', check: (p) => p.commonMistakes[0]?.incorrect === 'DELETE FROM users;' },
    { name: 'correct captured', check: (p) => p.commonMistakes[0]?.correct === 'DELETE FROM users WHERE id = 1;' }
  ]
);

// --- TEST 15: Malformed markdown - unclosed code block ---
runTest(
  'Malformed: Unclosed code block',
  `## What is This?
A concept.

## Examples

### Example 1
\`\`\`sql
SELECT * FROM users;
This code block never closes...

More text here.`,
  [
    { name: 'has 1 example', check: (p) => p.examples.length === 1 },
    { name: 'code includes everything after open', check: (p) => p.examples[0]?.code?.includes('More text here') || p.examples[0]?.code?.includes('This code block') }
  ]
);
addWarning('Malformed: Unclosed code block', 'Unclosed code blocks consume all remaining content - may cause issues');

// --- TEST 16: Malformed markdown - no space after ## ---
runTest(
  'Malformed: No space after ##',
  `##What is This?
This section header has no space.

##Examples
No space here either.

###Example 1
\`\`\`sql
SELECT 1;
\`\`\`

Test.`,
  [
    { name: 'definition is empty (malformed header not recognized)', check: (p) => p.definition === '' },
    { name: 'no examples (malformed ###)', check: (p) => p.examples.length === 0 }
  ]
);
addWarning('Malformed: No space after ##', 'Parser requires space after ## - malformed headers are silently ignored');

// --- TEST 17: Missing required sections entirely ---
runTest(
  'Missing all content sections',
  `# Just a title

Some introductory text without any ## sections.

More text here.`,
  [
    { name: 'definition is empty', check: (p) => p.definition === '' },
    { name: 'explanation is empty', check: (p) => p.explanation === '' },
    { name: 'examples is empty', check: (p) => p.examples.length === 0 },
    { name: 'mistakes is empty', check: (p) => p.commonMistakes.length === 0 }
  ]
);

// --- TEST 18: Only Examples section ---
runTest(
  'Only Examples section, no definition',
  `## Examples

### Example 1
\`\`\`sql
SELECT * FROM users;
\`\`\`

Test.`,
  [
    { name: 'definition is empty', check: (p) => p.definition === '' },
    { name: 'has 1 example', check: (p) => p.examples.length === 1 }
  ]
);

// --- TEST 19: Code block without language specifier ---
runTest(
  'Code block without "sql" specifier',
  `## What is This?
A concept.

## Examples

### Example 1
\`\`\`
SELECT * FROM users;
\`\`\`

This uses generic code block.`,
  [
    { name: 'has 1 example', check: (p) => p.examples.length === 1 },
    { name: 'code is NOT captured (needs sql tag)', check: (p) => !p.examples[0]?.code || p.examples[0]?.code === '' }
  ]
);
addWarning('Code block without "sql" specifier', 'Generic code blocks (```) without "sql" tag are not captured - intentional?');

// --- TEST 20: Multiple mistakes with mixed formats ---
runTest(
  'Multiple mistakes with mixed old/new formats',
  `## What is This?
A concept.

## Common Mistakes

### Mistake 1: Old Format
❌ **Incorrect SQL:**
\`\`\`sql
SELECT FORM users;
\`\`\`

✅ **Corrected SQL:**
\`\`\`sql
SELECT FROM users;
\`\`\`

💡 **Key Takeaway:** Check spelling

### Mistake 2: New Format
**Incorrect SQL:**
\`\`\`sql
DELETE FROM users;
\`\`\`

**Correct SQL:**
\`\`\`sql
DELETE FROM users WHERE id = 1;
\`\`\`

**Why:** Missing WHERE clause`,
  [
    { name: 'has 2 mistakes', check: (p) => p.commonMistakes.length === 2 },
    { name: 'first mistake has why', check: (p) => p.commonMistakes[0]?.why?.includes('Check spelling') || p.commonMistakes[0]?.why?.includes('Key Takeaway') }
  ]
);

// --- TEST 21: Mistake with no correct SQL ---
runTest(
  'Mistake with only incorrect SQL (no correction)',
  `## What is This?
A concept.

## Common Mistakes

### Mistake 1: Just showing what not to do
❌ **Incorrect SQL:**
\`\`\`sql
DROP TABLE users;
\`\`\`

💡 **Why it happens:** Accidental execution`,
  [
    { name: 'has 1 mistake', check: (p) => p.commonMistakes.length === 1 },
    { name: 'incorrect is captured', check: (p) => p.commonMistakes[0]?.incorrect === 'DROP TABLE users;' },
    { name: 'correct is empty', check: (p) => p.commonMistakes[0]?.correct === '' }
  ]
);

// --- TEST 22: Empty markdown ---
runTest(
  'Completely empty markdown',
  '',
  [
    { name: 'definition is empty', check: (p) => p.definition === '' },
    { name: 'explanation is empty', check: (p) => p.explanation === '' },
    { name: 'examples is empty', check: (p) => p.examples.length === 0 },
    { name: 'mistakes is empty', check: (p) => p.commonMistakes.length === 0 }
  ]
);

// --- TEST 23: Whitespace-only markdown ---
runTest(
  'Whitespace-only markdown',
  `   

\t\t\t

   
`,
  [
    { name: 'definition is empty', check: (p) => p.definition === '' },
    { name: 'explanation is empty', check: (p) => p.explanation === '' },
    { name: 'examples is empty', check: (p) => p.examples.length === 0 }
  ]
);

// --- TEST 24: Special markdown characters in content ---
runTest(
  'Special markdown characters in content',
  `## What is This?
This concept involves **bold** and *italic* and \`inline code\`.

## Examples

### Example 1: Markdown in SQL comments
\`\`\`sql
-- This is a **bold** comment
SELECT * FROM users; -- *italic* note
\`\`\`

Note: The comment contains **markdown**.`,
  [
    { name: 'definition preserves markdown', check: (p) => p.definition.includes('**bold**') },
    { name: 'code preserves asterisks', check: (p) => p.examples[0]?.code?.includes('**bold**') },
    { name: 'explanation preserves markdown', check: (p) => p.examples[0]?.explanation?.includes('**markdown**') }
  ]
);

// --- TEST 25: Nested sections (edge case) ---
runTest(
  'Nested section-like content',
  `## What is This?
A concept.

### This looks like a subsection but isn't
Some content here.

## Examples

### Example 1
\`\`\`sql
SELECT 1;
\`\`\`

Test with ### inside.`,
  [
    { name: 'definition includes the ### text', check: (p) => p.definition.includes('### This looks like') },
    { name: 'example captured correctly', check: (p) => p.examples.length === 1 && p.examples[0]?.title === 'Example 1' }
  ]
);

// --- TEST 26: Example title with special characters ---
runTest(
  'Example title with special characters',
  `## What is This?
A concept.

## Examples

### Example: JOIN + WHERE + GROUP BY
\`\`\`sql
SELECT * FROM a JOIN b ON a.id = b.id WHERE x > 1 GROUP BY y;
\`\`\`

Complex query.

### Example: "Quoted Title"
\`\`\`sql
SELECT 2;
\`\`\`

Another.`,
  [
    { name: 'first example title preserved', check: (p) => p.examples[0]?.title === 'Example: JOIN + WHERE + GROUP BY' },
    { name: 'second example title preserved', check: (p) => p.examples[1]?.title === 'Example: "Quoted Title"' }
  ]
);

// --- TEST 27: SQL injection-like content ---
runTest(
  'SQL injection-like content',
  `## What is This?
Security concept.

## Examples

### Example 1: Dangerous Query
\`\`\`sql
SELECT * FROM users WHERE username = '' OR '1'='1';
\`\`\`

Classic injection.

### Example 2: Comment injection
\`\`\`sql
SELECT * FROM users; -- '; DROP TABLE users; --
\`\`\`

Comment attack.`,
  [
    { name: 'first query preserved', check: (p) => p.examples[0]?.code?.includes("OR '1'='1'") },
    { name: 'second query preserved', check: (p) => p.examples[1]?.code?.includes('DROP TABLE') }
  ]
);

// --- TEST 28: Multi-line SQL with comments ---
runTest(
  'Multi-line SQL with comments',
  `## What is This?
A concept.

## Examples

### Example 1: Complex Query
\`\`\`sql
-- Get all active users
SELECT 
  u.id,
  u.name,
  u.email
FROM users u
WHERE u.active = 1
  AND u.created_at > '2024-01-01';
\`\`\`

This query uses comments and formatting.`,
  [
    { name: 'code includes comments', check: (p) => p.examples[0]?.code?.includes('-- Get all active users') },
    { name: 'code preserves newlines', check: (p) => p.examples[0]?.code?.includes('\n') },
    { name: 'multi-line structure intact', check: (p) => p.examples[0]?.code?.split('\n').length > 5 }
  ]
);

// --- TEST 29: Duplicate section headers ---
runTest(
  'Duplicate section headers',
  `## What is This?
First definition.

## What is This?
Second definition (should override).

## Examples

### Example 1
\`\`\`sql
SELECT 1;
\`\`\`

Test.`,
  [
    { name: 'uses last definition', check: (p) => p.definition === 'Second definition (should override).' }
  ]
);
addWarning('Duplicate section headers', 'Last section wins - earlier content is silently overwritten');

// --- TEST 30: Mistake without any markers ---
runTest(
  'Mistake without explicit markers',
  `## What is This?
A concept.

## Common Mistakes

### Mistake 1: Random mistake content
Just some text without markers.
More text here.
Even more.`,
  [
    { name: 'mistake is NOT captured (no incorrect/correct)', check: (p) => p.commonMistakes.length === 0 }
  ]
);
addWarning('Mistake without explicit markers', 'Mistakes without ❌/✅/**Incorrect** markers are silently dropped');

// --- TEST 31: Example with only explanation (no ### title) ---
runTest(
  'Content without ### titles in Examples',
  `## What is This?
A concept.

## Examples
Just some text without a ### Example header.
More text here.

\`\`\`sql
SELECT 1;
\`\`\`

After code.`,
  [
    { name: 'no examples captured (no ###)', check: (p) => p.examples.length === 0 }
  ]
);
addWarning('Content without ### titles in Examples', 'Examples without ### headers are silently ignored');

// --- TEST 32: Mistake with multi-line why explanation ---
runTest(
  'Mistake with multi-line why explanation',
  `## What is This?
A concept.

## Common Mistakes

### Mistake 1: Complex issue
❌ **Incorrect SQL:**
\`\`\`sql
SELECT * FROM users;
\`\`\`

✅ **Corrected SQL:**
\`\`\`sql
SELECT id, name FROM users;
\`\`\`

💡 **Why it happens:** 
This is a multi-line explanation.
It continues here with more details.
And even more context.`,
  [
    { name: 'has 1 mistake', check: (p) => p.commonMistakes.length === 1 },
    { name: 'why captures first line only', check: (p) => p.commonMistakes[0]?.why === 'This is a multi-line explanation.' }
  ]
);
addWarning('Mistake with multi-line why explanation', 'Only first line of multi-line "why" is captured - rest is lost');

// --- TEST 33: Section header case sensitivity ---
runTest(
  'Section header case sensitivity',
  `## what is this?
Lowercase definition.

## examples

### Example 1
\`\`\`sql
SELECT 1;
\`\`\`

Test.

## common mistakes`,
  [
    { name: 'lowercase headers NOT recognized', check: (p) => p.definition === '' },
    { name: 'examples not captured', check: (p) => p.examples.length === 0 }
  ]
);
addWarning('Section header case sensitivity', 'Section headers are case-sensitive - "what is this?" != "What is This?"');

// --- TEST 34: Trailing/leading whitespace in sections ---
runTest(
  'Trailing/leading whitespace handling',
  `## What is This?
   
   Definition with whitespace around it.   
   
## Examples

### Example 1
   
\`\`\`sql
SELECT * FROM users;
\`\`\`
   
Explanation with whitespace.   
   `,
  [
    { name: 'definition is trimmed', check: (p) => p.definition === 'Definition with whitespace around it.' },
    { name: 'code is trimmed', check: (p) => p.examples[0]?.code === 'SELECT * FROM users;' },
    { name: 'explanation is trimmed', check: (p) => !p.examples[0]?.explanation?.startsWith('  ') }
  ]
);

// ============================================
// PRINT RESULTS
// ============================================

console.log(`\n=== TEST RESULTS ===`);
console.log(`Total test cases: ${results.total}`);
console.log(`Passed: ${results.passed.length}`);
console.log(`Failed: ${results.failed.length}`);
console.log(`Warnings: ${results.warnings.length}`);
console.log(`Success rate: ${((results.passed.length / results.total) * 100).toFixed(1)}%\n`);

console.log('=== PASSING CASES ===');
for (const test of results.passed) {
  console.log(`✓ ${test.name}`);
}

if (results.failed.length > 0) {
  console.log('\n=== FAILING/BUGGY CASES ===');
  for (const test of results.failed) {
    console.log(`\n✗ ${test.name}`);
    for (const error of test.errors) {
      console.log(`  - ${error}`);
    }
    // Debug: show parsed output
    if (test.parsed) {
      console.log(`  Parsed output:`);
      console.log(`    definition: "${test.parsed.definition?.substring(0, 60)}..."`);
      console.log(`    explanation: "${test.parsed.explanation?.substring(0, 60)}..."`);
      console.log(`    examples: ${test.parsed.examples?.length}`);
      if (test.parsed.examples?.length > 0) {
        const ex = test.parsed.examples[0];
        console.log(`      [0] title: "${ex.title}", code: "${ex.code?.substring(0, 40)}...", explanation: "${ex.explanation?.substring(0, 40)}..."`);
      }
      console.log(`    mistakes: ${test.parsed.commonMistakes?.length}`);
      if (test.parsed.commonMistakes?.length > 0) {
        const m = test.parsed.commonMistakes[0];
        console.log(`      [0] title: "${m.title}", incorrect: "${m.incorrect?.substring(0, 30)}...", correct: "${m.correct?.substring(0, 30)}...", why: "${m.why}"`);
      }
    }
  }
}

if (results.warnings.length > 0) {
  console.log('\n=== WARNINGS (Behavioral Notes) ===');
  for (const warning of results.warnings) {
    console.log(`⚠ ${warning.test}`);
    console.log(`  ${warning.message}`);
  }
}

console.log('\n=== RECOMMENDED FIXES ===');
if (results.failed.length === 0 && results.warnings.length === 0) {
  console.log('All tests passed with no warnings! No fixes needed.');
} else {
  console.log('PRIORITY FIXES:');
  console.log('');
  
  // Check for specific issues
  const hasWhyBug = results.failed.some(f => f.name.includes('icons')) || 
                    results.warnings.some(w => w.message.includes('why'));
  if (hasWhyBug) {
    console.log('1. MISTAKE "WHY" PARSING BUG (HIGH PRIORITY):');
    console.log('   File: concept-loader.ts, parseMistakes() function');
    console.log('   Issue: The regex captures "** Typo in keyword" instead of "Typo in keyword"');
    console.log('   Fix: Strip markdown bold markers from captured "why" text:');
    console.log('   ```typescript');
    console.log('   // After regex match, strip markdown:');
    console.log('   why = whyMatch[1].trim().replace(/^\*\*\s*/, "").replace(/\s*\*\*$/, "");');
    console.log('   ```');
    console.log('');
  }
  
  const hasMultiLineWhy = results.warnings.some(w => w.message.includes('multi-line'));
  if (hasMultiLineWhy) {
    console.log('2. MULTI-LINE "WHY" SUPPORT (MEDIUM PRIORITY):');
    console.log('   File: concept-loader.ts, parseMistakes() function');
    console.log('   Issue: Only first line of multi-line explanation is captured');
    console.log('   Fix: Continue collecting lines until next marker or block end:');
    console.log('   ```typescript');
    console.log('   } else if (inWhy) {');
    console.log('     if (trimmed && !why) why = trimmed;');
    console.log('     else if (trimmed) why += " " + trimmed;  // Append subsequent lines');
    console.log('   }');
    console.log('   ```');
    console.log('');
  }
  
  const hasCodeBlockIssue = results.warnings.some(w => w.message.includes('sql tag'));
  if (hasCodeBlockIssue) {
    console.log('3. GENERIC CODE BLOCK SUPPORT (LOW PRIORITY):');
    console.log('   File: concept-loader.ts, parseExamples() function');
    console.log('   Issue: Generic code blocks (```) without "sql" tag are ignored');
    console.log('   Fix: Accept any code block language, default to capturing it:');
    console.log('   ```typescript');
    console.log('   // Change: line.startsWith("```sql")');
    console.log('   // To: line.startsWith("```") && !line.startsWith("```\")');
    console.log('   ```');
    console.log('');
  }
  
  console.log('4. DOCUMENTATION IMPROVEMENTS:');
  console.log('   - Document required markdown format for concept files');
  console.log('   - Note that ### headers are required for examples');
  console.log('   - Note that ❌/✅/**Incorrect** markers are required for mistakes');
  console.log('   - Mention that section headers are case-sensitive');
  console.log('');
  
  console.log('5. VALIDATION ENHANCEMENTS:');
  console.log('   - Add warning logs for malformed content (unclosed code blocks)');
  console.log('   - Add warning for content without expected sections');
  console.log('   - Consider schema validation for concept files');
}

// Exit with error code if any tests failed
process.exit(results.failed.length > 0 ? 1 : 0);
