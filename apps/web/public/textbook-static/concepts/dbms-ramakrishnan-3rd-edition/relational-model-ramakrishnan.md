# Relational Model

## Definition

The relational model organizes data into tables (relations) composed of rows (tuples) and columns (attributes), where each relation has a schema defining its structure and a unique primary key identifying each tuple.

## Explanation

The relational model, introduced by E.F. Codd, is the foundation of modern database systems. A relation is a set of tuples sharing the same schema — a named list of attribute-type pairs. Because a relation is a set, no two tuples are identical and order does not matter.

Every relation has a primary key: one or more attributes whose values uniquely identify each tuple. Foreign keys express references between relations, enforcing referential integrity across the database.

The strength of the relational model is that data is accessed through declarative queries (SQL) rather than by navigating pointer structures. The query optimizer decides the physical access path, freeing application developers from low-level storage concerns.

## Examples

### Example 1: Defining a Relation Schema

```sql
CREATE TABLE Students (
  sid    CHAR(20),
  name   CHAR(30),
  login  CHAR(20),
  age    INTEGER,
  gpa    REAL,
  PRIMARY KEY (sid)
);
```

The `Students` relation has five attributes. `sid` is the primary key — every student row must have a unique `sid` value.

### Example 2: Foreign Key Reference

```sql
CREATE TABLE Enrolled (
  sid    CHAR(20),
  cid    CHAR(20),
  grade  CHAR(10),
  PRIMARY KEY (sid, cid),
  FOREIGN KEY (sid) REFERENCES Students(sid)
);
```

`Enrolled.sid` is a foreign key referencing `Students.sid`. Any `sid` value inserted into `Enrolled` must already exist in `Students`.

### Example 3: Querying with a Join

```sql
SELECT s.name, e.cid, e.grade
FROM   Students s
JOIN   Enrolled e ON s.sid = e.sid
WHERE  s.gpa > 3.0;
```

This query joins the two relations on the primary-key / foreign-key link to retrieve enrolled courses for high-GPA students.

## Common Mistakes

### Mistake 1: Treating a Relation as an Ordered List

**Incorrect:**

```sql
-- Assuming row 1 is always the "first" student inserted
SELECT * FROM Students LIMIT 1;
```

**Correct:**

```sql
SELECT * FROM Students ORDER BY sid LIMIT 1;
```

**Why this happens:** Relations are sets; without an ORDER BY clause the database may return rows in any order. Never rely on insertion order for correctness.

### Mistake 2: NULL in a Primary Key

**Incorrect:**

```sql
INSERT INTO Students (sid, name, login, age, gpa)
VALUES (NULL, 'Alice', 'alice@db', 20, 3.8);
```

**Correct:**

```sql
INSERT INTO Students (sid, name, login, age, gpa)
VALUES ('S001', 'Alice', 'alice@db', 20, 3.8);
```

**Why this happens:** A primary key must be NOT NULL and unique. NULL means "unknown", so a NULL primary key makes the tuple unidentifiable.

### Mistake 3: Violating Referential Integrity

**Incorrect:**

```sql
INSERT INTO Enrolled (sid, cid, grade)
VALUES ('S999', 'CS101', 'A');
-- S999 does not exist in Students
```

**Correct:**

```sql
-- Insert the student first, then enroll
INSERT INTO Students VALUES ('S999', 'Bob', 'bob@db', 22, 3.5);
INSERT INTO Enrolled  VALUES ('S999', 'CS101', 'A');
```

**Why this happens:** A foreign key constraint rejects any insertion where the referenced parent row does not yet exist.

---

*Source: Database Management Systems, Ramakrishnan & Gehrke, 3rd Edition*
