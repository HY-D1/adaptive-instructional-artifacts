---
id: 1nf
title: First Normal Form (1NF)
definition: Every column holds a single atomic value, with no repeating groups or lists inside a cell
difficulty: intermediate
estimatedReadTime: 3
pageReferences: [328, 329, 330, 331]
tags:
  - database-design
  - normalization
  - 1nf
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# First Normal Form (1NF)

## Definition
A table is in first normal form when every cell holds one single value, each column holds one kind of data, and no group of columns repeats to store a list.

## Explanation
Normalization is the process of organising columns into tables so that each fact is stored exactly once. First normal form is the entry requirement, and it is about the shape of individual cells rather than relationships between tables.

The rule sounds obvious until you see how it is broken in practice. A cell holding the text 'SQL, Python, Stats' technically stores three facts in one place, and the database cannot see them. Counting how many students take Python means searching inside strings, a course cannot be renamed without rewriting every row that mentions it, and nothing stops a typo creating a course that never existed. The database offers no help because, as far as it is concerned, the column contains one opaque string.

The other common violation is a set of numbered columns such as course_1, course_2, and course_3. This looks more structured but has the same problem in a different costume: you have hard-coded a limit of three, querying across the columns requires repeating every condition, and a student with one course leaves two columns sitting empty.

Both are fixed the same way, by moving the repeating data into its own table with one row per value. The table grows taller instead of wider, which is exactly what relational databases are built to handle, and every ordinary query becomes straightforward again.

## Examples
### A table that violates the rule
```sql
CREATE TABLE student_courses (
  student_id INTEGER PRIMARY KEY,
  student_name TEXT,
  courses TEXT
);
```
The courses column stores a comma-separated list, so the database cannot count, filter, or join on individual courses.

### The same data in first normal form
```sql
CREATE TABLE students (
  student_id INTEGER PRIMARY KEY,
  student_name TEXT
);

CREATE TABLE enrollments (
  student_id INTEGER,
  course_name TEXT,
  PRIMARY KEY (student_id, course_name)
);
```
One row per student per course. Each cell holds a single value and the pair of columns forms the key.

### Questions that become easy afterwards
```sql
SELECT course_name, COUNT(*) AS students
FROM enrollments
GROUP BY course_name;
```
Counting enrolments per course is now an ordinary aggregate rather than string searching.

## Common Mistakes
### Storing a list inside one cell
❌ Incorrect
```sql
INSERT INTO student_courses VALUES (1, 'Alice', 'SQL, Python, Stats');
```
✅ Correct
```sql
INSERT INTO enrollments VALUES (1, 'SQL');
INSERT INTO enrollments VALUES (1, 'Python');
INSERT INTO enrollments VALUES (1, 'Stats');
```
💡 Why it happens: One cell per value keeps the data searchable. A comma-separated string forces every query to parse text the database cannot index.

### Numbering repeated columns
❌ Incorrect
```sql
CREATE TABLE students (
  student_id INTEGER PRIMARY KEY,
  course_1 TEXT,
  course_2 TEXT,
  course_3 TEXT
);
```
✅ Correct
```sql
CREATE TABLE enrollments (
  student_id INTEGER,
  course_name TEXT,
  PRIMARY KEY (student_id, course_name)
);
```
💡 Why it happens: Numbered columns hard-code an arbitrary limit and leave empty cells. A separate table takes any number of courses with no schema change.

### Mixing two kinds of data in one column
❌ Incorrect
```sql
CREATE TABLE contacts (
  contact_id INTEGER PRIMARY KEY,
  detail TEXT
);
```
✅ Correct
```sql
CREATE TABLE contacts (
  contact_id INTEGER PRIMARY KEY,
  email TEXT,
  phone TEXT
);
```
💡 Why it happens: A column that sometimes holds an email and sometimes a phone number cannot be validated or queried reliably. Give each kind of fact its own column.
