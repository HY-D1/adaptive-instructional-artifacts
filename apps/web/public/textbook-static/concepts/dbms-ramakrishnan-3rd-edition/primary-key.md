---
id: primary-key
title: Primary Keys
definition: The column or columns whose value uniquely identifies each row in a table
difficulty: beginner
estimatedReadTime: 3
pageReferences: [70, 71, 72, 73, 74]
tags:
  - sql
  - keys
  - constraints
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Primary Keys

## Definition
A primary key is the column, or combination of columns, whose value uniquely identifies every row in a table. No two rows may share it and it can never be NULL.

## Explanation
A table without a reliable way to identify a single row is difficult to work with. If two people are both named Alice in the same city, an update meant for one of them may hit both. The primary key solves this by guaranteeing that one specific value always points at exactly one row.

The guarantee has two halves that the database enforces on every insert and update. Uniqueness means a value cannot be repeated, so an attempt to insert a duplicate is rejected rather than silently accepted. NOT NULL means the value must actually be present, because a missing identifier could not identify anything. Declaring a column as the primary key applies both automatically, which is why you rarely see them written out separately.

A table has at most one primary key, though that key may span several columns. Such a composite key is the natural choice for a table that records a relationship, such as one row per student per course, where neither column alone is unique but the pair always is.

Choosing the key is a design decision. A natural key uses real data that is already unique, such as an email address. A surrogate key is an arbitrary number the database generates, which is the safer default because real-world values change more often than people expect, and updating a key means updating everything that references it.

## Examples
### Declare a single-column key
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT
);
```
The id column identifies each user. Uniqueness and NOT NULL both come with the declaration.

### Declare a composite key
```sql
CREATE TABLE enrollments (
  student_id INTEGER,
  course_id INTEGER,
  enrolled_on TEXT,
  PRIMARY KEY (student_id, course_id)
);
```
Neither column alone is unique, but the pair is, so a student cannot enrol in the same course twice.

### Query by the key to reach one row
```sql
SELECT name, email
FROM users
WHERE id = 3;
```
Because id is the primary key, this returns at most one row, which is what makes targeted reads and updates safe.

## Common Mistakes
### Choosing a value that can change
❌ Incorrect
```sql
CREATE TABLE users (
  email TEXT PRIMARY KEY,
  name TEXT
);
```
✅ Correct
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT
);
```
💡 Why it happens: People do change email addresses, and changing a primary key means updating every row that references it. A surrogate id stays stable while email stays unique.

### Expecting a nullable primary key
❌ Incorrect
```sql
INSERT INTO users (id, name) VALUES (NULL, 'Alice');
```
✅ Correct
```sql
INSERT INTO users (id, name) VALUES (6, 'Alice');
```
💡 Why it happens: A primary key is implicitly NOT NULL, since a missing value cannot identify a row. Supply a value, or let the database generate one.

### Declaring two primary keys instead of one composite key
❌ Incorrect
```sql
CREATE TABLE enrollments (
  student_id INTEGER PRIMARY KEY,
  course_id INTEGER PRIMARY KEY
);
```
✅ Correct
```sql
CREATE TABLE enrollments (
  student_id INTEGER,
  course_id INTEGER,
  PRIMARY KEY (student_id, course_id)
);
```
💡 Why it happens: A table has only one primary key. To key on two columns, declare a single composite key naming both.
