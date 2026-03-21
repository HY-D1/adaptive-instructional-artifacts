# Normalization

## Definition

Normalization is the process of structuring a relational database schema to reduce data redundancy and prevent update anomalies by decomposing relations into smaller, well-structured tables guided by normal forms (1NF, 2NF, 3NF, BCNF).

## Explanation

Poorly designed relations store the same fact in multiple rows. When that fact changes, every row must be updated — miss one and the database becomes inconsistent. Normalization eliminates these redundancies by decomposing a relation into two or more smaller relations that can be joined back without losing information (lossless-join decomposition).

The process is driven by functional dependencies: a functional dependency X → Y means that the value of X uniquely determines the value of Y in every valid instance of the relation.

**Normal forms (in order of strength):**

- **1NF** — every attribute holds atomic (indivisible) values; no repeating groups.
- **2NF** — 1NF plus no partial dependency: every non-key attribute depends on the whole primary key, not just part of it.
- **3NF** — 2NF plus no transitive dependency: no non-key attribute depends on another non-key attribute.
- **BCNF (Boyce–Codd)** — every functional dependency X → Y has X as a superkey.

Most practical schemas target 3NF or BCNF.

## Examples

### Example 1: Unnormalized Table (1NF Violation)

```sql
-- Violates 1NF: phones is a multi-valued, non-atomic attribute
CREATE TABLE Contacts (
  cid    INT PRIMARY KEY,
  name   VARCHAR(50),
  phones VARCHAR(200)  -- "555-1234, 555-5678"
);
```

Fix: extract phones into a separate table.

### Example 2: Partial Dependency (2NF Violation)

```sql
-- Primary key: (student_id, course_id)
-- student_name depends only on student_id → partial dependency
CREATE TABLE Enrollment (
  student_id   INT,
  course_id    INT,
  student_name VARCHAR(50),  -- partial dependency on student_id alone
  grade        CHAR(2),
  PRIMARY KEY (student_id, course_id)
);
```

Fix: move `student_name` to a separate `Students(student_id, student_name)` table.

### Example 3: Transitive Dependency (3NF Violation)

```sql
-- dept_budget depends on dept_name, which depends on employee_id
CREATE TABLE Employees (
  employee_id  INT PRIMARY KEY,
  dept_name    VARCHAR(50),
  dept_budget  DECIMAL(10,2)  -- transitive dependency via dept_name
);
```

Fix: decompose into `Employees(employee_id, dept_name)` and `Departments(dept_name, dept_budget)`.

## Common Mistakes

### Mistake 1: Over-Normalizing Performance-Critical Tables

**Incorrect:**

```sql
-- Splitting every possible fact into its own table
-- results in 8-way joins for a simple query
SELECT e.name, d.dept_name, l.city, ...
FROM   Employees e
JOIN   Departments d ON ...
JOIN   Locations l ON ...
...
```

**Correct:**

```sql
-- Denormalize lookup columns that never change and are read far more than written
ALTER TABLE Employees ADD COLUMN dept_name VARCHAR(50);
```

**Why this happens:** BCNF eliminates all redundancy but can hurt read performance. Know when a controlled redundancy (materialized column) is justified.

### Mistake 2: Lossy Decomposition

**Incorrect:**

```sql
-- Decomposing Courses(course_id, dept, instructor)
-- into (course_id, dept) and (dept, instructor) loses which instructor
-- teaches which course when a dept has multiple instructors
```

**Correct:**

```sql
-- Decompose as (course_id, instructor) and (instructor, dept)
-- so the join recovers the original relation exactly
```

**Why this happens:** Every decomposition must satisfy the lossless-join property; verify with the FD set before finalizing the schema.

### Mistake 3: Ignoring Multi-Valued Dependencies

**Incorrect:**

```sql
-- Storing both skills and languages for a person in one table
-- causes spurious tuples when joining
CREATE TABLE PersonInfo (
  person_id INT,
  skill     VARCHAR(50),
  language  VARCHAR(50)
);
```

**Correct:**

```sql
CREATE TABLE PersonSkills   (person_id INT, skill    VARCHAR(50));
CREATE TABLE PersonLanguages(person_id INT, language VARCHAR(50));
```

**Why this happens:** 4NF addresses multi-valued dependencies that 3NF/BCNF do not cover.

---

*Source: Database Management Systems, Ramakrishnan & Gehrke, 3rd Edition*
