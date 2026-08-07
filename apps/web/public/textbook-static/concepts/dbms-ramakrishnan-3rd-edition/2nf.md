---
id: 2nf
title: Second Normal Form (2NF)
definition: Already in 1NF, and every non-key column depends on the whole composite key rather than part of it
difficulty: intermediate
estimatedReadTime: 3
pageReferences: [332, 333, 334]
tags:
  - database-design
  - normalization
  - 2nf
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Second Normal Form (2NF)

## Definition
A table is in second normal form when it is already in first normal form and every non-key column depends on the entire primary key, not merely on part of it.

## Explanation
Second normal form only has something to say about tables whose primary key spans more than one column. If the key is a single column, every non-key column necessarily depends on the whole of it, so any table in first normal form with a single-column key is already in second normal form.

The problem it addresses is called a partial dependency. Consider an enrolments table keyed on the pair of student and course, also carrying the course title. The grade genuinely depends on both halves of the key, because it is the grade this student earned in this course. The course title does not: it depends on the course alone and would be identical no matter which student the row described.

That mismatch causes the same fact to be stored repeatedly, and repetition is where inconsistency creeps in. A course with two hundred enrolled students stores its title two hundred times, renaming it means updating every one of those rows, and an update that stops halfway leaves the database disagreeing with itself. There is also no way to record a course that nobody has enrolled in yet, because a row cannot exist without a student to complete the key.

The fix is to move the partially dependent column into a table keyed by the part it actually depends on. The course title lives in a courses table keyed by course, and the enrolments table keeps only what genuinely belongs to the pair.

## Examples
### A table with a partial dependency
```sql
CREATE TABLE enrollments (
  student_id INTEGER,
  course_id INTEGER,
  course_title TEXT,
  grade TEXT,
  PRIMARY KEY (student_id, course_id)
);
```
The grade depends on both key columns, but course_title depends only on course_id, so it is repeated for every enrolled student.

### The same data split into second normal form
```sql
CREATE TABLE courses (
  course_id INTEGER PRIMARY KEY,
  course_title TEXT
);

CREATE TABLE enrollments (
  student_id INTEGER,
  course_id INTEGER,
  grade TEXT,
  PRIMARY KEY (student_id, course_id)
);
```
The title is stored once per course, and the enrolments table keeps only the grade, which truly depends on the whole key.

### Reassembling the original view
```sql
SELECT enrollments.student_id, courses.course_title, enrollments.grade
FROM enrollments
INNER JOIN courses ON courses.course_id = enrollments.course_id;
```
Splitting the tables costs nothing at read time: a join reproduces the combined result on demand.

## Common Mistakes
### Renaming a value in only some rows
❌ Incorrect
```sql
UPDATE enrollments
SET course_title = 'Advanced SQL'
WHERE course_id = 2 AND student_id = 1;
```
✅ Correct
```sql
UPDATE courses
SET course_title = 'Advanced SQL'
WHERE course_id = 2;
```
💡 Why it happens: With the title duplicated per enrolment, a partial update leaves the same course under two different names. Storing it once removes the possibility.

### Assuming every table needs splitting
❌ Incorrect
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  city TEXT
);
```
✅ Correct
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  city TEXT
);
```
💡 Why it happens: This table is already in second normal form. With a single-column key there is no part of the key to depend on, so no partial dependency can exist.

### Keeping a column that ignores half the key
❌ Incorrect
```sql
CREATE TABLE enrollments (
  student_id INTEGER,
  course_id INTEGER,
  student_email TEXT,
  PRIMARY KEY (student_id, course_id)
);
```
✅ Correct
```sql
CREATE TABLE students (
  student_id INTEGER PRIMARY KEY,
  student_email TEXT
);
```
💡 Why it happens: The email depends on the student alone, so it repeats for every course they take. It belongs in the table keyed by student.
