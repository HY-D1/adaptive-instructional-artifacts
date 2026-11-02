import { CONCEPT_COMPATIBILITY_MAP } from '../lib/content/concept-compatibility-map';

/** Original instructional supplements, independent of generated textbook exports.
 * Sources below support the SQL semantics; examples are authored teaching fixtures,
 * not quotations or exercises attributed to the imported textbook pages.
 */
export const LESSON_VERSION = 'concept-lessons-v1';
export const TOPIC_LABELS: Record<string, string> = {
  foundations: 'Foundations', basics: 'Query Basics', combining: 'Combining and Summarizing',
  functions: 'Subqueries and Functions', schema: 'Schema and Data Changes', design: 'Design and Administration',
};
export interface ConceptExample {
  title: string; sql?: string; schema?: string; explanation: string;
  expectedRows?: unknown[][]; inspectSql?: string;
}
export interface ConceptLesson {
  title: string; topic: string; objectives: string[]; prerequisites: string[];
  explanation: string[]; examples: ConceptExample[];
  mistakes: Array<{title: string; incorrect: string; correct: string; why: string}>;
  checks: Array<{question: string; options: Array<{text: string; feedback: string}>; correctIndex: number}>;
  relatedConcepts: string[]; nextConcept?: string; dialect: string; sources: string[];
}
const seed = `CREATE TABLE people(id INTEGER PRIMARY KEY, name TEXT NOT NULL, team TEXT, score INTEGER);
INSERT INTO people VALUES (1,'Ada','Blue',10),(2,'Ben','Blue',20),(3,'Cy','Red',NULL),(4,'Dee',NULL,20);
CREATE TABLE teams(name TEXT PRIMARY KEY, city TEXT);
INSERT INTO teams VALUES ('Blue','Boston'),('Red','Seattle'),('Gold','Denver');`;

type Spec = {
  title: string; topic: string; explanation: string; scenario: string;
  misconception: string; correction: string; question: string; answer: string; distractor: string;
  question2: string; answer2: string; distractor2: string;
  sql?: string; expectedRows?: unknown[][]; inspectSql?: string; dialect?: string; source?: string;
};
const specs: Record<string, Spec> = {
  "relational": {
    "title": "Relational databases",
    "topic": "foundations",
    "explanation": "A relational database represents facts as rows in named tables. Columns describe attributes, a key identifies a row, and foreign keys connect related facts. A query produces another table-shaped result; stored row order has no meaning without ORDER BY.",
    "scenario": "People contains one person per row. Teams contains one team per row. people.team can refer to teams.name instead of repeating a city for every person.",
    "misconception": "Rows always come back in insertion order.",
    "correction": "Use ORDER BY whenever the order matters.",
    "question": "What does one row in People represent?",
    "answer": "One person",
    "distractor": "One column",
    "question2": "How do you guarantee a result order?",
    "answer2": "Use ORDER BY",
    "distractor2": "Rely on insertion order",
    "sql": "SELECT name FROM people ORDER BY id;",
    "expectedRows": [
      [
        "Ada"
      ],
      [
        "Ben"
      ],
      [
        "Cy"
      ],
      [
        "Dee"
      ]
    ]
  },
  "sql-intro": {
    "title": "SQL and database systems",
    "topic": "foundations",
    "explanation": "SQL is a declarative language: state the data you want, and the database chooses an execution strategy. SELECT reads data; INSERT, UPDATE and DELETE change rows; CREATE TABLE defines structure. MySQL is a database system, not a synonym for SQL. This application executes practice queries in SQLite.",
    "scenario": "SELECT name FROM people requests names without describing how to scan storage. The browser examples are independent of your saved practice database.",
    "misconception": "A query that runs in MySQL must run unchanged in SQLite.",
    "correction": "Check the engine and the supported syntax before copying dialect-specific SQL.",
    "question": "What kind of statement reads rows?",
    "answer": "SELECT",
    "distractor": "UPDATE",
    "question2": "Which engine runs the examples here?",
    "answer2": "SQLite through sql.js",
    "distractor2": "A remote MySQL server",
    "sql": "SELECT name FROM people WHERE id = 1;",
    "expectedRows": [
      [
        "Ada"
      ]
    ]
  },
  "independence": {
    "title": "Data independence",
    "topic": "foundations",
    "explanation": "Data independence separates how data is stored from how applications see it. Physical independence lets an index or storage layout change without changing the logical tables. Logical independence uses stable views or interfaces to shield applications from some logical schema changes; it is not a guarantee that every schema change is invisible.",
    "scenario": "Adding an index to People changes the access path while the query SELECT name FROM people stays the same.",
    "misconception": "Adding an index requires renaming every application column.",
    "correction": "Keep the table interface stable while changing physical access paths.",
    "question": "Adding an index is mainly what kind of change?",
    "answer": "Physical storage/access change",
    "distractor": "A new business entity",
    "question2": "Does logical independence make every schema change harmless?",
    "answer2": "No; compatible interfaces still need to be preserved",
    "distractor2": "Yes; all changes are invisible"
  },
  "er": {
    "title": "Entity-relationship modeling",
    "topic": "foundations",
    "explanation": "An entity represents a thing such as a person or team. Attributes describe entities; relationships describe associations between them. Model business rules before choosing SQL columns. A conceptual ER model describes meaning and need not be a one-to-one picture of existing physical tables.",
    "scenario": "Person belongs to Team. A team can have many people, while a person in this example belongs to at most one team.",
    "misconception": "Store every entity and relationship in one comma-separated text field.",
    "correction": "Represent entity identities and explicit relationships with keys.",
    "question": "Which item is a relationship?",
    "answer": "Person belongs to Team",
    "distractor": "The spelling of a person name",
    "question2": "What should determine the model?",
    "answer2": "Business rules",
    "distractor2": "The order columns appeared in a spreadsheet"
  },
  "er-diagrams": {
    "title": "Reading ER diagrams",
    "topic": "foundations",
    "explanation": "ER diagrams show entity types, their attributes and relationships. Cardinality marks the maximum number of related entities; optionality gives the minimum. Notations vary, so read the legend instead of assuming every line uses the same symbols. Translate many-to-many relationships into an associative table when implementing them relationally.",
    "scenario": "A Student—Enrollment—Course model stores one enrollment per student/course pair and can attach a grade to that relationship.",
    "misconception": "Put several course IDs into a single Student column.",
    "correction": "Use Enrollment(student_id, course_id, grade) to represent separate enrollments.",
    "question": "Where does a grade for a student in a course belong?",
    "answer": "On the enrollment relationship",
    "distractor": "On the course name",
    "question2": "What should you check before interpreting diagram symbols?",
    "answer2": "The notation legend",
    "distractor2": "Only the drawing colors"
  },
  "cardinality": {
    "title": "Cardinality and optionality",
    "topic": "foundations",
    "explanation": "Cardinality expresses a relationship rule such as one-to-many or many-to-many. Optionality is separate: zero-or-one differs from exactly-one. A foreign key can enforce that a referenced row exists, while a NOT NULL constraint can require a reference on the referencing side. More complex minimum participation rules may need additional application or database logic.",
    "scenario": "A team can have zero people. A person may have no assigned team, represented here by NULL.",
    "misconception": "A foreign key guarantees every team has a person.",
    "correction": "A foreign key checks references from people to teams; it does not require teams to be referenced.",
    "question": "Can a team with zero members satisfy a people-to-team foreign key?",
    "answer": "Yes",
    "distractor": "No",
    "question2": "Which constraint requires a non-missing reference on a person?",
    "answer2": "NOT NULL on the team reference",
    "distractor2": "ORDER BY on teams"
  },
  "algebra": {
    "title": "Relational algebra",
    "topic": "foundations",
    "explanation": "Relational algebra combines operations on relations. Selection chooses rows; projection chooses attributes; joins combine related rows; union combines compatible relations. Classical relational algebra uses sets, whereas ordinary SQL SELECT keeps duplicates unless DISTINCT removes them.",
    "scenario": "Projecting team from People in SQL returns Blue twice; SELECT DISTINCT team removes the duplicate Blue row.",
    "misconception": "Classical projection and ordinary SELECT always preserve the same duplicate behavior.",
    "correction": "Use DISTINCT when SQL needs set-style duplicate elimination.",
    "question": "Which algebra operation chooses rows?",
    "answer": "Selection",
    "distractor": "Projection",
    "question2": "How does ordinary SQL SELECT treat duplicates?",
    "answer2": "Keeps them unless DISTINCT is used",
    "distractor2": "Always removes them",
    "sql": "SELECT DISTINCT team FROM people WHERE team IS NOT NULL ORDER BY team;",
    "expectedRows": [
      [
        "Blue"
      ],
      [
        "Red"
      ]
    ]
  },
  "projection": {
    "title": "Selection and projection",
    "topic": "basics",
    "explanation": "SELECT chooses output expressions (projection); WHERE chooses input rows (selection). DISTINCT removes duplicate result rows after output expressions are evaluated. Choosing fewer columns does not by itself remove duplicate values.",
    "scenario": "Two people belong to Blue. Projecting team without DISTINCT returns Blue twice; filtering team = Blue selects both people.",
    "misconception": "SELECT team removes duplicate team names automatically.",
    "correction": "Write SELECT DISTINCT team when unique team values are required.",
    "question": "Which clause filters people to the Blue team?",
    "answer": "WHERE team = 'Blue'",
    "distractor": "SELECT team",
    "question2": "How do you return each non-null team once?",
    "answer2": "SELECT DISTINCT team with a non-null filter",
    "distractor2": "SELECT team only",
    "sql": "SELECT DISTINCT team FROM people WHERE team IS NOT NULL ORDER BY team;",
    "expectedRows": [
      [
        "Blue"
      ],
      [
        "Red"
      ]
    ]
  },
  "select": {
    "title": "SELECT and aliases",
    "topic": "basics",
    "explanation": "SELECT computes the columns in a result. FROM identifies its input tables. Name only the columns you need and use AS to give expressions readable labels. SELECT * is convenient for exploration, but an explicit column list makes an application result more stable when a table gains columns.",
    "scenario": "The example returns the person name and a calculated next score. A NULL score stays NULL when 1 is added.",
    "misconception": "Adding a number to NULL treats the missing value as zero.",
    "correction": "Use COALESCE only when replacing a missing value with zero matches the business meaning.",
    "question": "What does AS next_score change?",
    "answer": "The result column label",
    "distractor": "The stored column name",
    "question2": "What is NULL + 1?",
    "answer2": "NULL",
    "distractor2": "1",
    "sql": "SELECT name, score + 1 AS next_score FROM people ORDER BY id;",
    "expectedRows": [
      [
        "Ada",
        11
      ],
      [
        "Ben",
        21
      ],
      [
        "Cy",
        null
      ],
      [
        "Dee",
        21
      ]
    ]
  },
  "where": {
    "title": "Filtering, logic and NULL",
    "topic": "basics",
    "explanation": "WHERE retains rows whose predicate is true. False and unknown are excluded. Comparisons with NULL produce unknown, so use IS NULL or IS NOT NULL to test missingness. AND binds more tightly than OR; add parentheses when combining conditions to make the intended logic explicit. LIKE uses % for any sequence and _ for one character; BETWEEN includes its endpoints.",
    "scenario": "Filtering score >= 20 returns Ben and Dee. Cy has a NULL score and does not satisfy that comparison.",
    "misconception": "WHERE score = NULL finds missing scores.",
    "correction": "Use WHERE score IS NULL to find missing scores.",
    "question": "Who satisfies score >= 20 in the sample?",
    "answer": "Ben and Dee",
    "distractor": "Ben, Cy and Dee",
    "question2": "Which predicate finds a missing score?",
    "answer2": "score IS NULL",
    "distractor2": "score = NULL",
    "sql": "SELECT name FROM people WHERE score >= 20 ORDER BY id;",
    "expectedRows": [
      [
        "Ben"
      ],
      [
        "Dee"
      ]
    ]
  },
  "order": {
    "title": "Sorting and pagination",
    "topic": "basics",
    "explanation": "ORDER BY defines output ordering. ASC sorts ascending and DESC descending. Equal sort keys need a tie-breaker when the exact sequence matters, especially with LIMIT and OFFSET. LIMIT chooses how many rows to return; OFFSET skips rows in that ordered result. The default placement of NULL values varies between engines.",
    "scenario": "Ben and Dee tie on score. ORDER BY score DESC, id ASC makes their relative order deterministic before taking a page.",
    "misconception": "LIMIT 2 alone means the two highest scores.",
    "correction": "Sort by score first, with a stable tie-breaker, then apply LIMIT.",
    "question": "Why add id after score in ORDER BY?",
    "answer": "To break ties deterministically",
    "distractor": "To remove duplicates",
    "question2": "What does OFFSET 1 do?",
    "answer2": "Skips the first ordered row",
    "distractor2": "Starts counting columns at one",
    "sql": "SELECT name, score FROM people WHERE score IS NOT NULL ORDER BY score DESC, id ASC LIMIT 2;",
    "expectedRows": [
      [
        "Ben",
        20
      ],
      [
        "Dee",
        20
      ]
    ]
  },
  "joins": {
    "title": "Joining tables",
    "topic": "combining",
    "explanation": "A JOIN forms row pairs from its inputs. ON or USING expresses the intended relationship. Missing or incomplete conditions can multiply rows; this is a semantic risk even when SQLite accepts the syntax. Qualify column names that exist in both tables. A one-to-many relationship can legitimately produce several result rows for one parent.",
    "scenario": "Joining People to Teams on team name gives Ada and Ben the city Boston, and Cy the city Seattle. Dee has no matching team.",
    "misconception": "A JOIN always requires ON or it raises a syntax error.",
    "correction": "SQLite can accept a JOIN without ON; use an explicit relationship to avoid unintended Cartesian combinations.",
    "question": "How many rows does an inner team join return for this seed?",
    "answer": "Three",
    "distractor": "Four",
    "question2": "Why can a team appear multiple times in a join result?",
    "answer2": "Several people can belong to it",
    "distractor2": "JOIN always removes team duplicates",
    "sql": "SELECT p.name, t.city FROM people p JOIN teams t ON p.team = t.name ORDER BY p.id;",
    "expectedRows": [
      [
        "Ada",
        "Boston"
      ],
      [
        "Ben",
        "Boston"
      ],
      [
        "Cy",
        "Seattle"
      ]
    ]
  },
  "inner": {
    "title": "INNER JOIN",
    "topic": "combining",
    "explanation": "INNER JOIN keeps only row pairs that satisfy its join condition. Unmatched rows from either input disappear. NULL compared with = does not match another NULL. Add WHERE to filter matching pairs after the join, and qualify repeated column names with table aliases.",
    "scenario": "Dee has no team and is absent from the inner join. Gold has no people and is also absent.",
    "misconception": "INNER JOIN preserves every row from its left table.",
    "correction": "Use LEFT JOIN if unmatched left rows must survive.",
    "question": "Does Dee appear in this inner join?",
    "answer": "No, there is no matching team",
    "distractor": "Yes, with a NULL city",
    "question2": "Which join preserves unmatched left rows?",
    "answer2": "LEFT JOIN",
    "distractor2": "INNER JOIN",
    "sql": "SELECT p.name, t.city FROM people p INNER JOIN teams t ON p.team = t.name ORDER BY p.id;",
    "expectedRows": [
      [
        "Ada",
        "Boston"
      ],
      [
        "Ben",
        "Boston"
      ],
      [
        "Cy",
        "Seattle"
      ]
    ]
  },
  "outer": {
    "title": "OUTER JOIN",
    "topic": "combining",
    "explanation": "LEFT JOIN preserves every left-side row and fills right-side columns with NULL when no match exists. A WHERE predicate on the right table can remove these unmatched rows. Put a right-side matching restriction in ON when unmatched left rows should remain. RIGHT and FULL JOIN availability depends on the database version; LEFT JOIN is sufficient for this example.",
    "scenario": "Dee remains in the result with a NULL city. Filtering WHERE t.city = Boston would remove Dee.",
    "misconception": "A right-table filter in WHERE always preserves unmatched people.",
    "correction": "Put the matching restriction in ON when preserving all people is the goal.",
    "question": "What city appears for Dee?",
    "answer": "NULL",
    "distractor": "Boston",
    "question2": "Where can a right-side match restriction go to preserve unmatched people?",
    "answer2": "In the ON condition",
    "distractor2": "Only in WHERE",
    "sql": "SELECT p.name, t.city FROM people p LEFT JOIN teams t ON p.team = t.name ORDER BY p.id;",
    "expectedRows": [
      [
        "Ada",
        "Boston"
      ],
      [
        "Ben",
        "Boston"
      ],
      [
        "Cy",
        "Seattle"
      ],
      [
        "Dee",
        null
      ]
    ]
  },
  "aggregate": {
    "title": "Aggregate functions",
    "topic": "combining",
    "explanation": "COUNT, SUM, AVG, MIN and MAX summarize rows. COUNT(*) counts rows; COUNT(column) counts non-null values. SUM and AVG ignore NULL inputs, rather than treating them as zero. Except for COUNT, aggregates over no qualifying input generally return NULL.",
    "scenario": "There are four people but only three known scores. AVG(score) is 50 / 3, not 50 / 4.",
    "misconception": "COUNT(score) and COUNT(*) always agree.",
    "correction": "COUNT(score) excludes NULL scores; COUNT(*) counts all four rows.",
    "question": "What is COUNT(score) for the sample?",
    "answer": "3",
    "distractor": "4",
    "question2": "Does AVG(score) count Cy as a zero?",
    "answer2": "No; it ignores the NULL input",
    "distractor2": "Yes; NULL is always zero",
    "sql": "SELECT COUNT(*) AS people, COUNT(score) AS known_scores, SUM(score) AS total FROM people;",
    "expectedRows": [
      [
        4,
        3,
        50
      ]
    ]
  },
  "group": {
    "title": "GROUP BY",
    "topic": "combining",
    "explanation": "GROUP BY partitions rows by equal grouping values before computing aggregates for each group. Include the grouping key in the result to identify each summary. Portable SQL normally groups or aggregates each selected expression. SQLite permits bare columns in aggregate queries, but their values can be arbitrary; acceptance does not establish that the query expresses the intended summary.",
    "scenario": "The Blue group contains two people with a score total of 30. The Red group has one person and a NULL score total.",
    "misconception": "An ungrouped person name beside SUM(score) reliably identifies the whole group.",
    "correction": "Select the group key and aggregate the measure instead of selecting an arbitrary person name.",
    "question": "What is the Blue team score total?",
    "answer": "30",
    "distractor": "20",
    "question2": "Why avoid bare names in a grouped summary?",
    "answer2": "They can be arbitrary and are not portable",
    "distractor2": "SQLite always raises a syntax error",
    "sql": "SELECT team, COUNT(*) AS members, SUM(score) AS total FROM people WHERE team IS NOT NULL GROUP BY team ORDER BY team;",
    "expectedRows": [
      [
        "Blue",
        2,
        30
      ],
      [
        "Red",
        1,
        null
      ]
    ]
  },
  "having": {
    "title": "HAVING",
    "topic": "combining",
    "explanation": "WHERE filters individual rows before grouping. HAVING filters groups after aggregates have been calculated. A condition such as COUNT(*) >= 2 belongs in HAVING. Filtering input rows first can change both which groups exist and the values of their aggregates.",
    "scenario": "Blue has two members and satisfies HAVING COUNT(*) >= 2. Red has one and is removed.",
    "misconception": "WHERE COUNT(*) >= 2 is the right way to filter a grouped count.",
    "correction": "Use HAVING COUNT(*) >= 2 after GROUP BY.",
    "question": "Which team has at least two members?",
    "answer": "Blue",
    "distractor": "Red",
    "question2": "When does WHERE act relative to GROUP BY?",
    "answer2": "Before grouping",
    "distractor2": "After group totals are computed",
    "sql": "SELECT team, COUNT(*) FROM people WHERE team IS NOT NULL GROUP BY team HAVING COUNT(*) >= 2 ORDER BY team;",
    "expectedRows": [
      [
        "Blue",
        2
      ]
    ]
  },
  "subquery": {
    "title": "Subqueries",
    "topic": "functions",
    "explanation": "A subquery is a query nested inside another statement. A scalar subquery supplies one value; IN checks membership in a result set; EXISTS checks whether any row exists. Match the subquery shape to the operator. NULL in a NOT IN result can make non-matching comparisons unknown; NOT EXISTS is often clearer when testing absence.",
    "scenario": "The scalar subquery computes AVG(score). The outer query keeps people whose score is greater than that average.",
    "misconception": "Every subquery can return multiple rows in a scalar comparison.",
    "correction": "Use a scalar aggregate or an operator designed for multiple rows.",
    "question": "Who scores above the known-score average?",
    "answer": "Ben and Dee",
    "distractor": "Ada and Cy",
    "question2": "What does EXISTS test?",
    "answer2": "Whether the subquery returns any row",
    "distractor2": "Whether every selected value is non-null",
    "sql": "SELECT name FROM people WHERE score > (SELECT AVG(score) FROM people) ORDER BY id;",
    "expectedRows": [
      [
        "Ben"
      ],
      [
        "Dee"
      ]
    ]
  },
  "correlated": {
    "title": "Correlated subqueries",
    "topic": "functions",
    "explanation": "A correlated subquery refers to a value from the current outer row. This makes its result depend on that row, though the optimizer may transform how it is executed. Use distinct aliases and verify the correlation predicate: an uncorrelated EXISTS can return the same answer for every outer row.",
    "scenario": "For each team, EXISTS checks for a person with p.team = t.name. Blue and Red qualify; Gold does not.",
    "misconception": "EXISTS (SELECT 1 FROM people) finds only populated teams.",
    "correction": "Correlate People to the current team with p.team = t.name.",
    "question": "Which team fails the correlated EXISTS check?",
    "answer": "Gold",
    "distractor": "Blue",
    "question2": "What happens if the correlation predicate is removed here?",
    "answer2": "Every team passes because People is nonempty",
    "distractor2": "No team passes",
    "sql": "SELECT t.name FROM teams t WHERE EXISTS (SELECT 1 FROM people p WHERE p.team = t.name) ORDER BY t.name;",
    "expectedRows": [
      [
        "Blue"
      ],
      [
        "Red"
      ]
    ]
  },
  "sets": {
    "title": "UNION and set operations",
    "topic": "combining",
    "explanation": "UNION combines compatible query results and removes duplicate rows; UNION ALL keeps them. INTERSECT retains rows common to both inputs and EXCEPT retains rows from the left that are absent from the right. Inputs must have the same number of result columns, with compatible meanings. An outer ORDER BY controls the final result order.",
    "scenario": "Blue appears in both queries but UNION returns it once. Use UNION ALL if both occurrences represent events that must be counted.",
    "misconception": "UNION ALL removes repeated rows.",
    "correction": "Use UNION for duplicate elimination and UNION ALL for preserving multiplicity.",
    "question": "How many Blue rows does UNION return here?",
    "answer": "One",
    "distractor": "Two",
    "question2": "Which operator preserves duplicates?",
    "answer2": "UNION ALL",
    "distractor2": "UNION",
    "sql": "SELECT team FROM people WHERE team IS NOT NULL UNION SELECT name FROM teams ORDER BY 1;",
    "expectedRows": [
      [
        "Blue"
      ],
      [
        "Gold"
      ],
      [
        "Red"
      ]
    ]
  },
  "strings": {
    "title": "String functions",
    "topic": "functions",
    "explanation": "String functions transform text values. SQLite provides functions including upper, lower, length and substr, and uses || for concatenation. Functions and case-conversion behavior differ between dialects; SQLite built-in upper/lower primarily handle ASCII. NULL inputs frequently produce NULL outputs, so decide whether a replacement value is meaningful.",
    "scenario": "upper(name) produces ADA for Ada. substr(name,1,1) uses a one-based start index and produces A.",
    "misconception": "SQLite substr starts counting at zero like many programming languages.",
    "correction": "Use a start index of 1 for the first character.",
    "question": "What does substr('Ada',1,1) return?",
    "answer": "A",
    "distractor": "d",
    "question2": "Which SQLite operator joins text values?",
    "answer2": "||",
    "distractor2": "+",
    "sql": "SELECT upper(name), substr(name,1,1) FROM people WHERE id = 1;",
    "expectedRows": [
      [
        "ADA",
        "A"
      ]
    ],
    "source": "https://www.sqlite.org/lang_corefunc.html"
  },
  "dates": {
    "title": "Date and time functions",
    "topic": "functions",
    "explanation": "SQLite date/time functions operate on supported time-value representations, commonly ISO-8601 text. date returns a calendar date and datetime includes time. Modifiers transform values, for example adding one day. Do not rely on locale-specific dates such as 03/04/2025, or assume MySQL DATE_ADD syntax works in SQLite.",
    "scenario": "date(2025-01-31, +1 day) becomes 2025-02-01. Use explicit fixed dates in tests rather than now so the result is reproducible.",
    "misconception": "The text 03/04/2025 has one universal database meaning.",
    "correction": "Use an unambiguous ISO date such as 2025-04-03.",
    "question": "What date follows 2025-01-31 by one day?",
    "answer": "2025-02-01",
    "distractor": "2025-01-32",
    "question2": "Why use fixed dates in examples?",
    "answer2": "Results stay reproducible",
    "distractor2": "They make dates sort randomly",
    "sql": "SELECT date('2025-01-31', '+1 day');",
    "expectedRows": [
      [
        "2025-02-01"
      ]
    ],
    "source": "https://www.sqlite.org/lang_datefunc.html"
  },
  "functions": {
    "title": "Scalar, aggregate and window functions",
    "topic": "functions",
    "explanation": "A scalar function returns a value for each input row. An aggregate summarizes a group. A window function computes over related rows while retaining individual rows. Choose based on the result shape you need, and check dialect support rather than assuming a MySQL function name is portable.",
    "scenario": "SUM(score) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) returns a running total without collapsing people into one row.",
    "misconception": "A window aggregate always reduces the result to one row.",
    "correction": "Use a window when you need both detail rows and a calculated summary.",
    "question": "How many rows does the running-total example return?",
    "answer": "Four",
    "distractor": "One",
    "question2": "What makes the running-total order deterministic?",
    "answer2": "ORDER BY the unique id in OVER",
    "distractor2": "The table name alone",
    "sql": "SELECT name, SUM(score) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total FROM people ORDER BY id;",
    "expectedRows": [
      [
        "Ada",
        10
      ],
      [
        "Ben",
        30
      ],
      [
        "Cy",
        30
      ],
      [
        "Dee",
        50
      ]
    ],
    "source": "https://www.sqlite.org/windowfunctions.html"
  },
  "create": {
    "title": "CREATE TABLE",
    "topic": "schema",
    "explanation": "CREATE TABLE declares columns and constraints. Choose a key, decide which attributes may be missing, and express rules such as NOT NULL and CHECK near the data they protect. CREATE TABLE does not insert any business rows. SQLite type names generally establish affinity rather than the rigid type enforcement of many server databases.",
    "scenario": "The example creates badges with a non-null label and inserts one row. A later INSERT without a label would violate NOT NULL.",
    "misconception": "A newly created table automatically contains example records.",
    "correction": "Insert records explicitly after defining the table.",
    "question": "How many rows exist immediately after CREATE TABLE?",
    "answer": "Zero",
    "distractor": "One per declared column",
    "question2": "Which constraint rejects a missing label?",
    "answer2": "NOT NULL",
    "distractor2": "ORDER BY",
    "sql": "CREATE TABLE badges(id INTEGER PRIMARY KEY, label TEXT NOT NULL); INSERT INTO badges VALUES (1,'Starter'); SELECT label FROM badges;",
    "expectedRows": [
      [
        "Starter"
      ]
    ],
    "source": "https://www.sqlite.org/lang_createtable.html"
  },
  "alter": {
    "title": "ALTER TABLE",
    "topic": "schema",
    "explanation": "ALTER TABLE changes an existing table definition. SQLite supports operations such as renaming a table or column and adding a column, with restrictions that differ from MySQL. A schema migration must consider existing rows, defaults and constraints. Test a copy and provide a recovery plan before changing production data.",
    "scenario": "Adding nickname TEXT leaves existing people with NULL nicknames. A SELECT of name still works because that column has not changed.",
    "misconception": "Adding a nullable column fills old rows with an empty string.",
    "correction": "Existing rows receive NULL unless a declared default supplies another value.",
    "question": "What nickname do existing rows receive in this example?",
    "answer": "NULL",
    "distractor": "Their current name",
    "question2": "Why test a schema migration on existing rows?",
    "answer2": "Old data may violate the proposed rules",
    "distractor2": "ALTER TABLE deletes old data automatically",
    "sql": "ALTER TABLE people ADD COLUMN nickname TEXT; SELECT name, nickname FROM people WHERE id = 1;",
    "expectedRows": [
      [
        "Ada",
        null
      ]
    ],
    "source": "https://www.sqlite.org/lang_altertable.html"
  },
  "types": {
    "title": "SQL data types",
    "topic": "schema",
    "explanation": "Types describe the domain and representation of values. MySQL enforces declared types according to its type rules and SQL modes. SQLite generally uses dynamic typing and column affinity; a type declaration alone is not a universal validation rule. SQLite has no separate storage classes for BOOLEAN or DATETIME. Use constraints and consistent representations deliberately.",
    "scenario": "An INTEGER score is stored alongside a TEXT name. A NULL score represents missing data, not a zero score.",
    "misconception": "VARCHAR(10) in SQLite always rejects an eleven-character value.",
    "correction": "Use an explicit CHECK constraint or a suitable strict schema when length enforcement is required.",
    "question": "Does SQLite VARCHAR(10) enforce length by itself?",
    "answer": "No",
    "distractor": "Yes",
    "question2": "What does NULL score mean in this lesson?",
    "answer2": "The score is missing",
    "distractor2": "The score is definitely zero",
    "source": "https://www.sqlite.org/datatype3.html"
  },
  "constraints": {
    "title": "Integrity constraints",
    "topic": "schema",
    "explanation": "Constraints encode rules the database checks when data changes. NOT NULL requires a value, UNIQUE prevents duplicate non-null key combinations, CHECK tests an expression, and foreign keys enforce valid references. In SQLite, a CHECK expression that evaluates to NULL is not a failure, so combine CHECK with NOT NULL when missingness is forbidden.",
    "scenario": "A score rule can be score INTEGER NOT NULL CHECK(score >= 0). Both clauses matter: CHECK alone does not reject NULL.",
    "misconception": "CHECK(score >= 0) always rejects a missing score.",
    "correction": "Add NOT NULL if missing scores are prohibited.",
    "question": "Which combination forbids both NULL and negative scores?",
    "answer": "NOT NULL CHECK(score >= 0)",
    "distractor": "CHECK(score >= 0) alone",
    "question2": "When are constraints checked?",
    "answer2": "When affected data is written",
    "distractor2": "Only when a SELECT is run",
    "sql": "CREATE TABLE marks(score INTEGER NOT NULL CHECK(score >= 0)); INSERT INTO marks VALUES (0); SELECT score FROM marks;",
    "expectedRows": [
      [
        0
      ]
    ],
    "source": "https://www.sqlite.org/lang_createtable.html"
  },
  "primary": {
    "title": "Primary keys",
    "topic": "schema",
    "explanation": "A primary key identifies a row. It may contain one column or a composite of several columns. Choose a key that is unique and stable. SQLite INTEGER PRIMARY KEY has special rowid behavior; ordinary primary keys in legacy SQLite tables have some NULL exceptions, so declare required columns NOT NULL explicitly when appropriate.",
    "scenario": "Enrollment(student_id, course_id) can use the pair as its key, allowing a student to enroll in several courses but preventing duplicate pairs.",
    "misconception": "A composite key makes every component individually unique.",
    "correction": "Only the complete key combination must be unique unless separate constraints say otherwise.",
    "question": "Can student 1 appear in two different course key pairs?",
    "answer": "Yes",
    "distractor": "No",
    "question2": "What should a row identifier be?",
    "answer2": "Unique and stable",
    "distractor2": "A display label that can freely repeat",
    "source": "https://www.sqlite.org/lang_createtable.html"
  },
  "foreign": {
    "title": "Foreign keys",
    "topic": "schema",
    "explanation": "A foreign key relates child columns to a declared parent key. It prevents orphan references when enforcement is enabled. SQLite applications must enable PRAGMA foreign_keys = ON for each connection before transactions requiring enforcement. A nullable foreign key may represent an optional relationship; delete and update actions must be chosen deliberately.",
    "scenario": "A membership row can reference an existing team. A nonexistent team should be rejected when foreign-key enforcement is on.",
    "misconception": "Declaring REFERENCES always enables SQLite foreign-key checking.",
    "correction": "Enable PRAGMA foreign_keys = ON on the connection.",
    "question": "What does a foreign key prevent when enforced?",
    "answer": "References to missing parent keys",
    "distractor": "All duplicate child rows",
    "question2": "Can a nullable foreign key represent no relationship?",
    "answer2": "Yes",
    "distractor2": "No",
    "source": "https://www.sqlite.org/foreignkeys.html"
  },
  "insert": {
    "title": "INSERT",
    "topic": "schema",
    "explanation": "INSERT creates rows. List target columns explicitly so the query does not depend on every column position. Omitted values use declared defaults or NULL, subject to constraints. A successful write may return no result rows; inspect the table to verify what was stored.",
    "scenario": "Adding Eli explicitly sets id, name, team and score. The following inspection reads the new row.",
    "misconception": "An INSERT with no returned rows proves nothing was inserted.",
    "correction": "Read the resulting table state to verify the mutation.",
    "question": "What does INSERT change?",
    "answer": "The stored rows",
    "distractor": "Only a displayed column label",
    "question2": "Why name target columns explicitly?",
    "answer2": "To associate each value with the intended column",
    "distractor2": "To bypass constraints",
    "sql": "INSERT INTO people(id,name,team,score) VALUES (5,'Eli','Red',15);",
    "expectedRows": [
      [
        "Eli",
        15
      ]
    ],
    "inspectSql": "SELECT name, score FROM people WHERE id = 5;"
  },
  "update": {
    "title": "UPDATE",
    "topic": "schema",
    "explanation": "UPDATE changes values in existing rows. WHERE identifies the rows to change; without it every row is eligible. Preview the intended rows with SELECT before writing. Expressions such as score = score + 5 use the existing row value, and NULL arithmetic stays NULL unless explicitly handled.",
    "scenario": "The example raises only Ada’s score from 10 to 15. Ben remains at 20.",
    "misconception": "UPDATE people SET score = 15 changes only the first row.",
    "correction": "Add WHERE id = 1 to target Ada.",
    "question": "How many people does WHERE id = 1 target?",
    "answer": "One",
    "distractor": "All four",
    "question2": "What does omitting WHERE mean?",
    "answer2": "All rows are eligible",
    "distractor2": "Only the first row is eligible",
    "sql": "UPDATE people SET score = score + 5 WHERE id = 1;",
    "expectedRows": [
      [
        "Ada",
        15
      ],
      [
        "Ben",
        20
      ],
      [
        "Cy",
        null
      ],
      [
        "Dee",
        20
      ]
    ],
    "inspectSql": "SELECT name, score FROM people ORDER BY id;"
  },
  "delete": {
    "title": "DELETE",
    "topic": "schema",
    "explanation": "DELETE removes rows, whereas DROP TABLE removes the table definition and its data. A missing WHERE makes all rows eligible for deletion. Check references and cascade actions before deleting. In the lesson sandbox every run starts with fresh seed data, but production changes require transactions and recovery planning.",
    "scenario": "Deleting id = 4 removes Dee and leaves Ada, Ben and Cy. The table continues to exist.",
    "misconception": "DELETE FROM people without WHERE deletes just one person.",
    "correction": "Use a precise WHERE and inspect the remaining rows.",
    "question": "What remains after DELETE WHERE id = 4?",
    "answer": "Ada, Ben and Cy",
    "distractor": "An absent People table",
    "question2": "What does DROP TABLE remove?",
    "answer2": "The table itself",
    "distractor2": "Only the first row",
    "sql": "DELETE FROM people WHERE id = 4;",
    "expectedRows": [
      [
        "Ada"
      ],
      [
        "Ben"
      ],
      [
        "Cy"
      ]
    ],
    "inspectSql": "SELECT name FROM people ORDER BY id;"
  },
  "views": {
    "title": "Views",
    "topic": "schema",
    "explanation": "A normal view stores a query definition, not a permanent snapshot of its result. Selecting from the view evaluates its query against current data. Views can simplify interfaces, but update support and security behavior vary by database. SQLite views are read-only unless suitable INSTEAD OF triggers provide writes.",
    "scenario": "A Blue-team view shows Ada and Ben. Future changes to People are reflected the next time the view is queried.",
    "misconception": "A view is automatically a frozen copy of its source rows.",
    "correction": "Use a separate snapshot table when a fixed historical result is required.",
    "question": "What does a normal view store?",
    "answer": "A query definition",
    "distractor": "A frozen copy of every result row",
    "question2": "Can every SQLite view be updated directly?",
    "answer2": "No",
    "distractor2": "Yes",
    "sql": "CREATE VIEW blue_people AS SELECT name FROM people WHERE team = 'Blue'; SELECT name FROM blue_people ORDER BY name;",
    "expectedRows": [
      [
        "Ada"
      ],
      [
        "Ben"
      ]
    ],
    "source": "https://www.sqlite.org/lang_createview.html"
  },
  "normalization": {
    "title": "Database normalization",
    "topic": "design",
    "explanation": "Normalization uses keys and functional dependencies to reduce avoidable redundancy and update anomalies. Decompose tables according to the business facts, and preserve the ability to reconstruct valid information with joins. Normalization does not mean creating one table for every column or eliminating all joins.",
    "scenario": "Store Team(name, city) separately from Person(id, name, team), so changing a team city updates one fact instead of every person row.",
    "misconception": "Normalization means never joining tables.",
    "correction": "Use joins to reconstruct related facts from well-defined tables.",
    "question": "Why separate a team city from every person row?",
    "answer": "To avoid repeated facts and update anomalies",
    "distractor": "To stop all queries using JOIN",
    "question2": "What should guide decomposition?",
    "answer2": "Keys and functional dependencies",
    "distractor2": "A fixed maximum column count"
  },
  "1nf": {
    "title": "First normal form",
    "topic": "design",
    "explanation": "First normal form models a relation with a single value from the chosen domain in each attribute position and no repeating column groups. Atomicity depends on how the application treats a value: text is not invalid simply because it contains several characters. Separate independently queried memberships rather than storing a comma-separated list.",
    "scenario": "Replace Person(id, courses = SQL,Python) with Enrollment(person_id, course) rows (1, SQL) and (1, Python).",
    "misconception": "Any text containing spaces violates first normal form.",
    "correction": "Use the domain and intended operations to decide whether an attribute is a single value.",
    "question": "How should independently queried course memberships be represented?",
    "answer": "Separate enrollment rows",
    "distractor": "A comma-separated course list",
    "question2": "Does a multiword person name automatically violate 1NF?",
    "answer2": "No",
    "distractor2": "Yes"
  },
  "2nf": {
    "title": "Second normal form",
    "topic": "design",
    "explanation": "A relation is in second normal form when it is in 1NF and each non-prime attribute depends on the whole of every candidate key, rather than a proper subset of a composite key. A single-column key cannot have a partial dependency on part of that key. Examine the business dependencies rather than just a sample of currently unique values.",
    "scenario": "Enrollment(student_id, course_id, student_name, grade) repeats student_name because it depends only on student_id. Put student_name in Student and retain grade in Enrollment.",
    "misconception": "student_name depends on the full enrollment key just because it is in the same table.",
    "correction": "Move the attribute whose dependency is only on student_id to Student.",
    "question": "Which value depends on the full student/course pair?",
    "answer": "The enrollment grade",
    "distractor": "The student name",
    "question2": "What anomaly comes from repeating student_name?",
    "answer2": "One name change requires multiple row updates",
    "distractor2": "Every course becomes unique automatically"
  },
  "3nf": {
    "title": "Third normal form",
    "topic": "design",
    "explanation": "Third normal form requires that for each nontrivial functional dependency X → A, X is a superkey or A is a prime attribute (part of a candidate key). In common single-key designs, this means avoiding dependencies of non-key attributes on other non-key attributes. Confirm the intended dependencies before decomposing.",
    "scenario": "Person(id, team, team_city) repeats team_city through id → team → team_city. Move the team-city fact to Team(team, city).",
    "misconception": "Putting a primary key on Person removes all transitive dependencies.",
    "correction": "Store team_city with the team key that determines it.",
    "question": "Which table should own team_city in this scenario?",
    "answer": "Team",
    "distractor": "Every Person row",
    "question2": "What must justify a claimed dependency?",
    "answer2": "The business rule",
    "distractor2": "Coincidence in a tiny data sample"
  },
  "transactions": {
    "title": "Transactions",
    "topic": "design",
    "explanation": "A transaction groups changes into one unit that can COMMIT or ROLLBACK. Atomicity prevents partial committed work. A transaction is not the same as a single SQL statement, and changes may remain visible to the current connection before commit. SQLite BEGIN starts a transaction; engine locking and isolation differ from MySQL.",
    "scenario": "The example temporarily raises Ada’s score, then rolls back. Inspecting People shows the original score 10.",
    "misconception": "ROLLBACK preserves the uncommitted update.",
    "correction": "ROLLBACK discards changes made in the active transaction.",
    "question": "What score remains after this rollback?",
    "answer": "10",
    "distractor": "15",
    "question2": "What makes several writes commit as one unit?",
    "answer2": "A transaction",
    "distractor2": "ORDER BY",
    "sql": "BEGIN; UPDATE people SET score = 15 WHERE id = 1; ROLLBACK;",
    "expectedRows": [
      [
        10
      ]
    ],
    "inspectSql": "SELECT score FROM people WHERE id = 1;",
    "source": "https://www.sqlite.org/lang_transaction.html"
  },
  "acid": {
    "title": "ACID properties",
    "topic": "design",
    "explanation": "Atomicity means a transaction commits all its changes or none. Consistency means valid transactions preserve defined invariants, not that the database invents business rules. Isolation controls how concurrent work is observed. Durability means committed work survives according to the engine and storage guarantees. An in-memory lesson database deliberately does not persist after disposal.",
    "scenario": "A transfer deducts from one account and adds to another within one transaction. A failed second write must not leave only the deduction committed.",
    "misconception": "Atomicity means every SQL query is fast.",
    "correction": "Atomicity concerns all-or-nothing effects, not speed.",
    "question": "Which property prevents a half-committed transfer?",
    "answer": "Atomicity",
    "distractor": "Isolation alone",
    "question2": "Does ACID invent an undeclared balance rule?",
    "answer2": "No; invariants must be implemented",
    "distractor2": "Yes; all business rules are automatic"
  },
  "isolation": {
    "title": "Transaction isolation",
    "topic": "design",
    "explanation": "Isolation describes which effects concurrent transactions may observe. Dirty reads, non-repeatable reads and phantoms are distinct phenomena. SQL isolation-level names do not imply identical engine behavior. SQLite normally isolates separate connections and permits only one writer at a time; a single in-memory browser connection cannot demonstrate a multi-client isolation experiment.",
    "scenario": "Reading an uncommitted change from another transaction is a dirty read. Seeing a different committed value on a later read is a non-repeatable read.",
    "misconception": "The single-connection sandbox proves all MySQL isolation levels.",
    "correction": "Study engine-specific concurrency behavior with multiple connections in the relevant database.",
    "question": "What is a dirty read?",
    "answer": "Reading another transaction’s uncommitted change",
    "distractor": "Reading a value that was committed yesterday",
    "question2": "Can one isolated browser connection validate multi-client isolation?",
    "answer2": "No",
    "distractor2": "Yes",
    "source": "https://www.sqlite.org/isolation.html"
  },
  "indexes": {
    "title": "Indexes",
    "topic": "design",
    "explanation": "An index is an additional access structure that can speed selected reads. It consumes storage and adds maintenance cost to writes. Column order matters for multi-column indexes, and a database may choose a scan when it estimates that to be cheaper. An index never replaces ORDER BY as a result-order contract.",
    "scenario": "An index on People(team) can help find Blue members. The query still explicitly orders by id.",
    "misconception": "Adding an index guarantees every query becomes faster.",
    "correction": "Choose indexes for measured query patterns and inspect the execution plan.",
    "question": "What cost does an index add?",
    "answer": "Storage and write maintenance",
    "distractor": "Only a different column label",
    "question2": "Does an index guarantee result ordering?",
    "answer2": "No; use ORDER BY",
    "distractor2": "Yes",
    "sql": "CREATE INDEX people_team ON people(team); SELECT name FROM people WHERE team = 'Blue' ORDER BY id;",
    "expectedRows": [
      [
        "Ada"
      ],
      [
        "Ben"
      ]
    ],
    "source": "https://www.sqlite.org/queryplanner.html"
  },
  "authorization": {
    "title": "Authorization and least privilege",
    "topic": "design",
    "explanation": "Authentication establishes identity; authorization determines permitted actions. Grant only the operations and data access required for a role. MySQL supports users and GRANT/REVOKE. SQLite is embedded and has no equivalent SQL user-management server; application and operating-system controls establish its access boundary.",
    "scenario": "A reporting role may need SELECT on a reporting view but no UPDATE permission on the source tables.",
    "misconception": "Signing in means every database action should be allowed.",
    "correction": "Check authorization for each operation and apply least privilege.",
    "question": "Which permission should a read-only reporting role need?",
    "answer": "SELECT on the intended reporting data",
    "distractor": "All privileges on every table",
    "question2": "Does SQLite provide MySQL-style CREATE USER?",
    "answer2": "No",
    "distractor2": "Yes",
    "dialect": "MySQL administration / conceptual; not executable in SQLite",
    "source": "https://dev.mysql.com/doc/refman/8.4/en/privileges-provided.html"
  },
  "procedures": {
    "title": "Stored procedures",
    "topic": "design",
    "explanation": "A stored procedure is a named routine executed by the server, typically using CALL in MySQL. Procedures can encapsulate several operations and expose parameters. They are different from scalar functions used inside expressions. DELIMITER is a client command for entering routine definitions, not a portable SQL statement. SQLite has no CREATE PROCEDURE support.",
    "scenario": "A MySQL procedure can accept a team identifier and perform several validated writes. This browser lesson explains the contract without pretending to execute a server routine.",
    "misconception": "DELIMITER is required by every SQL database engine.",
    "correction": "Use the client’s routine-entry mechanism only where appropriate; SQLite cannot create these routines.",
    "question": "How is a MySQL stored procedure typically invoked?",
    "answer": "CALL",
    "distractor": "SELECT * FROM procedure without a call",
    "question2": "Can the SQLite sandbox execute CREATE PROCEDURE?",
    "answer2": "No",
    "distractor2": "Yes",
    "dialect": "MySQL only; conceptual example",
    "source": "https://dev.mysql.com/doc/refman/8.4/en/stored-routines.html"
  },
  "stored-functions": {
    "title": "Stored functions",
    "topic": "design",
    "explanation": "A MySQL stored function is a user-defined routine that returns a value and can be called in an expression. Distinguish stored functions from built-in functions and stored procedures. Engine permissions, side effects and restrictions matter. SQLite supports application-defined functions through an API, but not MySQL CREATE FUNCTION routine definitions.",
    "scenario": "A MySQL function might calculate a business fee from an amount. A built-in function such as upper is already provided by the engine and requires no stored-routine definition.",
    "misconception": "A built-in scalar function and a stored routine are the same implementation feature.",
    "correction": "Distinguish engine-provided functions from user-defined server routines.",
    "question": "What does a stored function return?",
    "answer": "A value",
    "distractor": "Only a new table definition",
    "question2": "Does SQLite support MySQL CREATE FUNCTION routine syntax?",
    "answer2": "No",
    "distractor2": "Yes",
    "dialect": "MySQL only; conceptual example",
    "source": "https://dev.mysql.com/doc/refman/8.4/en/stored-routines.html"
  },
  "triggers": {
    "title": "Triggers",
    "topic": "design",
    "explanation": "A trigger responds automatically to a configured table event. In SQLite, row triggers can access NEW and OLD values as appropriate for INSERT, UPDATE or DELETE. Triggers can enforce or record rules but hide work from the visible statement, so avoid duplicate responsibilities and test side effects. MySQL and SQLite trigger syntax differs.",
    "scenario": "An AFTER INSERT trigger records the new person id in an audit table. The application does not issue the audit INSERT separately.",
    "misconception": "A trigger runs only when the application explicitly calls it.",
    "correction": "The database invokes it on the configured event.",
    "question": "What activates an AFTER INSERT trigger?",
    "answer": "An insertion into its target table",
    "distractor": "A SELECT on any table",
    "question2": "What must a trigger test inspect?",
    "answer2": "Both the direct change and its side effects",
    "distractor2": "Only whether the SQL text compiles",
    "sql": "CREATE TABLE audit(person_id INTEGER); CREATE TRIGGER audit_person AFTER INSERT ON people BEGIN INSERT INTO audit VALUES (NEW.id); END; INSERT INTO people VALUES (5,'Eli','Red',15);",
    "expectedRows": [
      [
        5
      ]
    ],
    "inspectSql": "SELECT person_id FROM audit;",
    "source": "https://www.sqlite.org/lang_createtrigger.html"
  },
  "events": {
    "title": "Scheduled events",
    "topic": "design",
    "explanation": "MySQL scheduled events run actions according to a server schedule when its Event Scheduler is enabled. Unlike triggers, they are driven by time rather than row changes. Design scheduled work to handle retries, permissions, time zones and duplicate execution safely. SQLite has no built-in MySQL Event Scheduler; use an external scheduler when appropriate.",
    "scenario": "A daily cleanup event removes expired staging rows at a chosen server time. It should remain safe if operational recovery causes a repeated run.",
    "misconception": "A scheduled event fires whenever any row is inserted.",
    "correction": "Use a trigger for a row event and a scheduler for time-based work.",
    "question": "What activates a scheduled event?",
    "answer": "Its time schedule",
    "distractor": "Every table read",
    "question2": "What should scheduled cleanup tolerate?",
    "answer2": "A safe retry",
    "distractor2": "Only one perfect execution forever",
    "dialect": "MySQL only; conceptual example",
    "source": "https://dev.mysql.com/doc/refman/8.4/en/event-scheduler.html"
  },
  "backup": {
    "title": "Backup and restore",
    "topic": "design",
    "explanation": "A backup is a recoverable copy made using a consistent, engine-appropriate process. A successful file copy alone does not prove recoverability. Test restoration, include schema and required dependent objects, protect access to backups, and define acceptable data-loss and recovery windows. MySQL and SQLite require different tooling.",
    "scenario": "Restore a backup into an isolated database and verify table counts and application behavior before relying on it for recovery.",
    "misconception": "A backup is proven useful as soon as its file exists.",
    "correction": "Perform a restoration test and verify the recovered data and application.",
    "question": "What validates recoverability?",
    "answer": "A tested restore",
    "distractor": "A backup filename alone",
    "question2": "Where should a routine restore test run?",
    "answer2": "An isolated recovery database",
    "distractor2": "Over the live production database",
    "dialect": "Engine-specific administration; conceptual example",
    "source": "https://www.sqlite.org/backup.html"
  }
};

export const CONCEPT_LESSON_TOPICS: Record<string, string> = {
  "murachs-mysql-3rd-edition/mysql-intro": "sql-intro",
  "murachs-mysql-3rd-edition/relational-databases-murach": "relational",
  "murachs-mysql-3rd-edition/select-statement-murach": "select",
  "murachs-mysql-3rd-edition/where-clause-murach": "where",
  "murachs-mysql-3rd-edition/order-by-murach": "order",
  "murachs-mysql-3rd-edition/joins-murach": "joins",
  "murachs-mysql-3rd-edition/inner-join-murach": "inner",
  "murachs-mysql-3rd-edition/outer-join-murach": "outer",
  "murachs-mysql-3rd-edition/insert-murach": "insert",
  "murachs-mysql-3rd-edition/update-murach": "update",
  "murachs-mysql-3rd-edition/delete-murach": "delete",
  "murachs-mysql-3rd-edition/data-types-murach": "types",
  "murachs-mysql-3rd-edition/mysql-functions": "functions",
  "murachs-mysql-3rd-edition/string-functions": "strings",
  "murachs-mysql-3rd-edition/date-functions": "dates",
  "murachs-mysql-3rd-edition/aggregate-functions-murach": "aggregate",
  "murachs-mysql-3rd-edition/group-by-murach": "group",
  "murachs-mysql-3rd-edition/having-murach": "having",
  "murachs-mysql-3rd-edition/subqueries-murach": "subquery",
  "murachs-mysql-3rd-edition/correlated-subquery-murach": "correlated",
  "murachs-mysql-3rd-edition/unions": "sets",
  "murachs-mysql-3rd-edition/create-table-murach": "create",
  "murachs-mysql-3rd-edition/alter-table-murach": "alter",
  "murachs-mysql-3rd-edition/constraints-murach": "constraints",
  "murachs-mysql-3rd-edition/views-murach": "views",
  "murachs-mysql-3rd-edition/stored-procedures": "procedures",
  "murachs-mysql-3rd-edition/functions-murach": "stored-functions",
  "murachs-mysql-3rd-edition/triggers": "triggers",
  "murachs-mysql-3rd-edition/events": "events",
  "murachs-mysql-3rd-edition/transactions-murach": "transactions",
  "murachs-mysql-3rd-edition/isolation-levels-murach": "isolation",
  "murachs-mysql-3rd-edition/user-management": "authorization",
  "murachs-mysql-3rd-edition/backup-restore": "backup",
  "dbms-ramakrishnan-3rd-edition/relational-model-intro": "relational",
  "dbms-ramakrishnan-3rd-edition/data-independence": "independence",
  "dbms-ramakrishnan-3rd-edition/er-model": "er",
  "dbms-ramakrishnan-3rd-edition/er-diagrams": "er-diagrams",
  "dbms-ramakrishnan-3rd-edition/cardinality": "cardinality",
  "dbms-ramakrishnan-3rd-edition/relational-algebra": "algebra",
  "dbms-ramakrishnan-3rd-edition/selection-projection": "projection",
  "dbms-ramakrishnan-3rd-edition/set-operations": "sets",
  "dbms-ramakrishnan-3rd-edition/sql-intro": "sql-intro",
  "dbms-ramakrishnan-3rd-edition/select-basic": "select",
  "dbms-ramakrishnan-3rd-edition/where-clause": "where",
  "dbms-ramakrishnan-3rd-edition/joins": "joins",
  "dbms-ramakrishnan-3rd-edition/inner-join": "inner",
  "dbms-ramakrishnan-3rd-edition/outer-join": "outer",
  "dbms-ramakrishnan-3rd-edition/aggregate-functions": "aggregate",
  "dbms-ramakrishnan-3rd-edition/group-by": "group",
  "dbms-ramakrishnan-3rd-edition/having": "having",
  "dbms-ramakrishnan-3rd-edition/subqueries": "subquery",
  "dbms-ramakrishnan-3rd-edition/correlated-subquery": "correlated",
  "dbms-ramakrishnan-3rd-edition/create-table": "create",
  "dbms-ramakrishnan-3rd-edition/data-types": "types",
  "dbms-ramakrishnan-3rd-edition/constraints": "constraints",
  "dbms-ramakrishnan-3rd-edition/primary-key": "primary",
  "dbms-ramakrishnan-3rd-edition/foreign-key": "foreign",
  "dbms-ramakrishnan-3rd-edition/insert": "insert",
  "dbms-ramakrishnan-3rd-edition/update": "update",
  "dbms-ramakrishnan-3rd-edition/delete": "delete",
  "dbms-ramakrishnan-3rd-edition/views": "views",
  "dbms-ramakrishnan-3rd-edition/normalization": "normalization",
  "dbms-ramakrishnan-3rd-edition/1nf": "1nf",
  "dbms-ramakrishnan-3rd-edition/2nf": "2nf",
  "dbms-ramakrishnan-3rd-edition/3nf": "3nf",
  "dbms-ramakrishnan-3rd-edition/transactions": "transactions",
  "dbms-ramakrishnan-3rd-edition/acid": "acid",
  "dbms-ramakrishnan-3rd-edition/isolation-levels": "isolation",
  "dbms-ramakrishnan-3rd-edition/indexes": "indexes",
  "dbms-ramakrishnan-3rd-edition/authorization": "authorization"
};
const learningObjectives: Record<string, string[]> = {
  "relational": [
    "Identify rows, attributes and keys in a relational table",
    "Explain how keys connect facts without relying on row order"
  ],
  "sql-intro": [
    "Distinguish SQL statements from database products",
    "Identify which statements read, change or define data"
  ],
  "independence": [
    "Distinguish physical from logical data independence",
    "Describe how a stable interface protects an application"
  ],
  "er": [
    "Identify entities, attributes and relationships",
    "Translate a business association into a key relationship"
  ],
  "er-diagrams": [
    "Read entity and relationship symbols using a diagram legend",
    "Model an enrollment with its relationship attributes"
  ],
  "cardinality": [
    "Distinguish relationship cardinality from optionality",
    "Explain what a foreign key does and does not enforce"
  ],
  "algebra": [
    "Distinguish selection, projection and join",
    "Compare set semantics with SQL duplicate preservation"
  ],
  "projection": [
    "Use WHERE to select rows and SELECT to choose attributes",
    "Use DISTINCT to remove duplicate result rows"
  ],
  "select": [
    "Select named columns and label calculated expressions",
    "Predict NULL propagation in an arithmetic expression"
  ],
  "where": [
    "Filter rows using comparisons, logic and missing-value tests",
    "Predict which rows survive a predicate containing NULL"
  ],
  "order": [
    "Sort results with a deterministic tie-breaker",
    "Apply LIMIT and OFFSET after defining result order"
  ],
  "joins": [
    "Join tables using their intended relationship",
    "Recognize unintended Cartesian multiplication"
  ],
  "inner": [
    "Predict which rows survive an INNER JOIN",
    "Qualify shared column names with table aliases"
  ],
  "outer": [
    "Preserve unmatched rows with LEFT JOIN",
    "Distinguish an ON restriction from a right-table WHERE filter"
  ],
  "aggregate": [
    "Compare COUNT(*) with COUNT(column)",
    "Explain how SUM and AVG handle NULL inputs"
  ],
  "group": [
    "Compute separate aggregates for each grouping key",
    "Avoid arbitrary bare-column values in grouped queries"
  ],
  "having": [
    "Filter individual rows with WHERE and groups with HAVING",
    "Predict how input filtering changes grouped results"
  ],
  "sets": [
    "Choose UNION or UNION ALL according to duplicate requirements",
    "Combine compatible result shapes and order the final result"
  ],
  "subquery": [
    "Match scalar and set subqueries to their operators",
    "Predict the result of an aggregate scalar subquery"
  ],
  "correlated": [
    "Correlate an inner query to the current outer row",
    "Identify how removing a correlation changes EXISTS results"
  ],
  "strings": [
    "Transform text with SQLite string functions",
    "Use one-based substr positions and text concatenation"
  ],
  "dates": [
    "Use unambiguous fixed date values and modifiers",
    "Predict date changes across a month boundary"
  ],
  "functions": [
    "Distinguish scalar, aggregate and window result shapes",
    "Calculate a deterministic running total with a window frame"
  ],
  "create": [
    "Declare a table with a key and required attributes",
    "Distinguish schema creation from inserting records"
  ],
  "alter": [
    "Change a table while accounting for existing records",
    "Predict the value of a newly added nullable column"
  ],
  "types": [
    "Distinguish SQLite affinity from rigid type enforcement",
    "Choose explicit validation for length and missing values"
  ],
  "constraints": [
    "Express required nonnegative values with combined constraints",
    "Recognize why CHECK alone may allow NULL"
  ],
  "primary": [
    "Identify single-column and composite candidate keys",
    "Distinguish combination uniqueness from component uniqueness"
  ],
  "foreign": [
    "Explain how a child key references a parent key",
    "Enable and verify foreign-key enforcement in SQLite"
  ],
  "insert": [
    "Insert explicit values into named target columns",
    "Verify a write by inspecting the resulting table state"
  ],
  "update": [
    "Target an update with a precise WHERE predicate",
    "Predict the effect of updating a NULL expression"
  ],
  "delete": [
    "Delete selected rows while retaining the table",
    "Distinguish DELETE from DROP TABLE"
  ],
  "views": [
    "Define a reusable query with a normal view",
    "Distinguish a view definition from a historical snapshot"
  ],
  "normalization": [
    "Identify repeated facts that cause update anomalies",
    "Decompose a design using keys and functional dependencies"
  ],
  "1nf": [
    "Replace repeating membership groups with separate rows",
    "Judge atomicity against the intended attribute domain"
  ],
  "2nf": [
    "Identify a partial dependency on a composite candidate key",
    "Separate student attributes from enrollment attributes"
  ],
  "3nf": [
    "Identify a transitive dependency in a common single-key design",
    "Place a team attribute with the key that determines it"
  ],
  "transactions": [
    "Group changes into an explicit transaction",
    "Verify that ROLLBACK restores the original values"
  ],
  "acid": [
    "Distinguish the four ACID properties",
    "Explain why business invariants still require implementation"
  ],
  "isolation": [
    "Distinguish dirty reads from non-repeatable reads",
    "Recognize the limits of a single-connection isolation demonstration"
  ],
  "indexes": [
    "Describe read benefits and write costs of indexes",
    "Preserve explicit ordering independently of an index"
  ],
  "authorization": [
    "Distinguish authentication from authorization",
    "Choose least-privilege access for a reporting role"
  ],
  "procedures": [
    "Describe a MySQL procedure and its invocation",
    "Distinguish client DELIMITER commands from SQL engine syntax"
  ],
  "stored-functions": [
    "Distinguish stored functions from built-in functions",
    "Identify SQLite limitations on MySQL routine definitions"
  ],
  "triggers": [
    "Explain when a table trigger runs automatically",
    "Verify both direct writes and triggered side effects"
  ],
  "events": [
    "Distinguish scheduled events from row triggers",
    "Design scheduled cleanup to tolerate retries"
  ],
  "backup": [
    "Validate a backup by restoring it in isolation",
    "Distinguish a backup file from demonstrated recoverability"
  ]
};
const prerequisiteTopics: Record<string, string[]> = {
  'relational': [], 'sql-intro': ['relational'], 'independence': ['relational'],
  'er': ['relational'], 'er-diagrams': ['er'], 'cardinality': ['er'],
  'algebra': ['relational'], 'projection': ['algebra'], 'select': ['sql-intro'],
  'where': ['select'], 'order': ['select'], 'joins': ['select', 'cardinality'],
  'inner': ['joins'], 'outer': ['inner'], 'aggregate': ['select', 'where'],
  'group': ['aggregate'], 'having': ['group'], 'sets': ['select'],
  'subquery': ['where', 'aggregate'], 'correlated': ['subquery', 'joins'],
  'strings': ['select'], 'dates': ['select'], 'functions': ['aggregate', 'order'],
  'create': ['relational'], 'types': ['create'], 'constraints': ['create'],
  'primary': ['constraints'], 'foreign': ['primary', 'cardinality'],
  'insert': ['create', 'constraints'], 'update': ['where'], 'delete': ['where', 'foreign'],
  'alter': ['create'], 'views': ['select'], 'normalization': ['primary', 'foreign'],
  '1nf': ['normalization'], '2nf': ['1nf'], '3nf': ['2nf'],
  'transactions': ['update'], 'acid': ['transactions'], 'isolation': ['acid'],
  'indexes': ['where'], 'authorization': ['views'], 'procedures': ['transactions'],
  'stored-functions': ['functions'], 'triggers': ['insert', 'update'],
  'events': ['procedures'], 'backup': ['transactions'],
};
const theorySources: Record<string, string> = {
  relational: 'https://opentextbc.ca/dbdesign01/chapter/chapter-7-the-relational-data-model/',
  independence: 'https://opentextbc.ca/dbdesign01/chapter/chapter-3-characteristics-and-benefits-of-a-database/',
  er: 'https://opentextbc.ca/dbdesign01/chapter/chapter-8-entity-relationship-model/',
  'er-diagrams': 'https://opentextbc.ca/dbdesign01/chapter/chapter-8-entity-relationship-model/',
  cardinality: 'https://opentextbc.ca/dbdesign01/chapter/chapter-8-entity-relationship-model/',
  normalization: 'https://opentextbc.ca/dbdesign01/chapter/chapter-12-normalization/',
  '1nf': 'https://opentextbc.ca/dbdesign01/chapter/chapter-12-normalization/',
  '2nf': 'https://opentextbc.ca/dbdesign01/chapter/chapter-12-normalization/',
  '3nf': 'https://opentextbc.ca/dbdesign01/chapter/chapter-12-normalization/',
  acid: 'https://www.sqlite.org/atomiccommit.html',
};
const curriculum = ["relational", "sql-intro", "independence", "er", "er-diagrams", "cardinality", "algebra", "projection", "select", "where", "order", "joins", "inner", "outer", "aggregate", "group", "having", "sets", "subquery", "correlated", "strings", "dates", "functions", "create", "types", "constraints", "primary", "foreign", "insert", "update", "delete", "alter", "views", "normalization", "1nf", "2nf", "3nf", "transactions", "acid", "isolation", "indexes", "authorization", "procedures", "stored-functions", "triggers", "events", "backup"] as const;
const preferredCorpusId = (key: string): string | undefined =>
  Object.keys(CONCEPT_LESSON_TOPICS).find(id => id.startsWith('dbms-') && CONCEPT_LESSON_TOPICS[id] === key)
  ?? Object.keys(CONCEPT_LESSON_TOPICS).find(id => CONCEPT_LESSON_TOPICS[id] === key);

function buildLesson(key: string): ConceptLesson {
  const spec = specs[key];
  const index = curriculum.indexOf(key as typeof curriculum[number]);
  // Suggested curriculum neighbors and reading prerequisites do not change adaptive policies.
  const previous = index > 0 ? preferredCorpusId(curriculum[index - 1]) : undefined;
  const next = index >= 0 && index < curriculum.length - 1 ? preferredCorpusId(curriculum[index + 1]) : undefined;
  const hasSql = Boolean(spec.sql);
  const source = spec.source ?? theorySources[key] ?? 'https://www.sqlite.org/lang_select.html';
  return {
    title: spec.title, topic: spec.topic,
    objectives: learningObjectives[key],
    prerequisites: (prerequisiteTopics[key] ?? []).map(preferredCorpusId).filter((id): id is string => Boolean(id)),
    explanation: [spec.explanation, spec.scenario],
    examples: [{title: hasSql ? 'Try the worked SQL example' : 'Worked scenario',
      explanation: spec.scenario,
      ...(hasSql ? {sql: spec.sql, schema: seed, expectedRows: spec.expectedRows, inspectSql: spec.inspectSql} : {}),
    }],
    mistakes: [{title: 'A misconception to avoid', incorrect: spec.misconception,
      correct: spec.correction, why: spec.correction + ' ' + spec.scenario}],
    checks: [
      {question: spec.question, correctIndex: 0, options: [
        {text: spec.answer, feedback: spec.scenario + ' ' + spec.explanation},
        {text: spec.distractor, feedback: spec.correction + ' ' + spec.scenario},
      ]},
      {question: spec.question2, correctIndex: 1, options: [
        {text: spec.distractor2, feedback: spec.correction + ' ' + spec.explanation},
        {text: spec.answer2, feedback: spec.explanation},
      ]},
    ],
    relatedConcepts: [previous, next].filter((id): id is string => Boolean(id)), nextConcept: next,
    dialect: spec.dialect ?? (hasSql ? 'SQLite (sql.js); portable SQL where noted' : 'Relational theory / engine differences noted'),
    sources: [source],
  };
}
const lessons = Object.fromEntries(Object.keys(specs).map(key => [key, buildLesson(key)]));

export function getConceptLesson(id: string): ConceptLesson | undefined {
  const exact = CONCEPT_LESSON_TOPICS[id];
  if (exact) return lessons[exact];
  if (id.includes('/')) return undefined; // unknown remote namespaces must retain their own content
  const candidates = CONCEPT_COMPATIBILITY_MAP[id] ?? [];
  for (const candidate of candidates) {
    if (CONCEPT_LESSON_TOPICS[candidate]) return lessons[CONCEPT_LESSON_TOPICS[candidate]];
  }
  const plain = Object.keys(CONCEPT_LESSON_TOPICS).find(key => key.split('/').pop() === id);
  return plain ? lessons[CONCEPT_LESSON_TOPICS[plain]] : undefined;
}

export function getLessonReadTime(lesson: ConceptLesson): number {
  return Math.max(1, Math.ceil(lesson.explanation.join(' ').split(/\s+/).length / 180));
}
