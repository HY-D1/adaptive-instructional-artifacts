# Entity-Relationship Diagrams

## Definition

An Entity-Relationship (ER) diagram is a conceptual data model that describes a database in terms of entities (real-world objects), attributes (properties of entities), and relationships (associations between entities), serving as a blueprint before translating to a relational schema.

## Explanation

ER modeling bridges the gap between business requirements and database design. You identify the key objects in your domain (entities), describe their properties (attributes), and define how they relate (relationships) before writing a single line of SQL.

**Core components:**

| Component | Notation | Meaning |
|-----------|----------|---------|
| Entity    | Rectangle | A distinct object type (e.g., Student, Course) |
| Attribute | Oval      | A property of an entity (e.g., name, gpa) |
| Relationship | Diamond | An association between two or more entities |
| Key attribute | Underlined oval | Uniquely identifies entity instances |
| Weak entity | Double rectangle | Identified only through a relationship |

**Cardinality constraints** specify how many instances of one entity participate in a relationship with another:
- **One-to-One (1:1)** — each instance on both sides associates with at most one on the other.
- **One-to-Many (1:N)** — one instance on the "one" side associates with many on the "many" side.
- **Many-to-Many (M:N)** — many instances on both sides can associate with each other.

ER diagrams translate to relational schemas via systematic rules: entities become tables, key attributes become primary keys, and M:N relationships become separate join tables.

## Examples

### Example 1: Translating an Entity to a Table

```sql
-- ER: Entity Students with attributes sid (key), name, gpa
CREATE TABLE Students (
  sid  CHAR(20) PRIMARY KEY,
  name CHAR(30) NOT NULL,
  gpa  REAL
);
```

Each ER entity becomes a table; the key attribute becomes the primary key.

### Example 2: One-to-Many Relationship (Department → Employees)

```sql
-- ER: Department (1) ----< Employees (N)
CREATE TABLE Departments (
  deptno   INT         PRIMARY KEY,
  deptname VARCHAR(50) NOT NULL
);

CREATE TABLE Employees (
  empno  INT         PRIMARY KEY,
  name   VARCHAR(50) NOT NULL,
  deptno INT,
  FOREIGN KEY (deptno) REFERENCES Departments(deptno)
);
```

The foreign key in `Employees` captures the 1:N relationship — many employees belong to one department.

### Example 3: Many-to-Many Relationship (Students ↔ Courses)

```sql
-- ER: Students (M) ----<< Enrolled >>---- (N) Courses
CREATE TABLE Courses (
  cid   CHAR(20) PRIMARY KEY,
  title VARCHAR(100)
);

CREATE TABLE Enrolled (
  sid   CHAR(20),
  cid   CHAR(20),
  grade CHAR(2),
  PRIMARY KEY (sid, cid),
  FOREIGN KEY (sid) REFERENCES Students(sid),
  FOREIGN KEY (cid) REFERENCES Courses(cid)
);
```

An M:N relationship becomes its own table (`Enrolled`) whose primary key combines the keys of both participating entities.

## Common Mistakes

### Mistake 1: Modeling a Relationship as an Entity (or Vice Versa)

**Incorrect:**

```sql
-- Treating "Enrollment" as just a relationship with no extra data
-- then discovering you need to store grade, semester, etc.
```

**Correct:**

```sql
-- When a relationship has its own attributes, model it as a
-- relationship entity (also called an associative entity)
CREATE TABLE Enrolled (
  sid      CHAR(20),
  cid      CHAR(20),
  grade    CHAR(2),
  semester CHAR(10),
  PRIMARY KEY (sid, cid, semester)
);
```

**Why this happens:** Relationships with attributes must become tables in the relational translation; identify them early during ER modeling.

### Mistake 2: Missing Participation Constraints

**Incorrect:**

```sql
-- Allows employees without a department (NULL deptno)
-- when the business rule says every employee must belong to one
ALTER TABLE Employees ADD COLUMN deptno INT;
```

**Correct:**

```sql
ALTER TABLE Employees ADD COLUMN deptno INT NOT NULL
  REFERENCES Departments(deptno);
```

**Why this happens:** Total participation (every entity must participate) maps to NOT NULL; partial participation allows NULL. Mark this explicitly in both the ER diagram and the DDL.

### Mistake 3: Weak Entity Without Identifying Relationship

**Incorrect:**

```sql
-- OrderLine has no standalone identity — its key depends on Order
CREATE TABLE OrderLine (
  line_no INT PRIMARY KEY  -- wrong: not unique without order_id
);
```

**Correct:**

```sql
CREATE TABLE OrderLine (
  order_id INT,
  line_no  INT,
  qty      INT,
  PRIMARY KEY (order_id, line_no),
  FOREIGN KEY (order_id) REFERENCES Orders(order_id)
);
```

**Why this happens:** Weak entities are identified by their owner (the identifying entity) plus their own partial key; the combined pair forms the primary key in the relational table.

---

*Source: Database Management Systems, Ramakrishnan & Gehrke, 3rd Edition*
