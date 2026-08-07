---
id: select-basic
title: SELECT Statement Basics
definition: Retrieving specific columns and rows from a table with SELECT
difficulty: beginner
estimatedReadTime: 3
pageReferences: [120, 121, 122, 123, 124]
tags:
  - sql
  - select
  - basics
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# SELECT Statement Basics

## Definition
SELECT reads data from a table. You name the columns you want and the table to read them from, and the database returns the matching rows as a result set.

## Explanation
Every query begins with the same two decisions: which columns you want, and which table they live in. SELECT lists the columns, FROM names the table, and the result is a new table that exists only for the duration of the query. Nothing is modified, so a SELECT is always safe to run and re-run while you experiment.

Naming columns explicitly is a habit worth forming. The asterisk shorthand returns every column, which is convenient while exploring, but it makes queries harder to read, moves more data than you need, and quietly changes meaning if someone later adds or reorders columns. Listing the three columns you actually care about states your intent and keeps working.

Column aliases rename a column in the output using AS. This matters most once you compute values, because an expression with no alias gets an unhelpful machine-generated name that is awkward to reference later.

DISTINCT removes duplicate rows from the result. It applies to the whole selected row, not to one column, which surprises people the first time they select two columns and still see repeated values in the first one. If the combination differs, the row is kept.

Order is not guaranteed unless you ask for it. Without ORDER BY, a database may return rows in any sequence it finds convenient, and that sequence can change as the data grows, so never rely on the incidental ordering you happen to observe.

## Examples
### Select specific columns
```sql
SELECT name, email, city
FROM users;
```
Returns one row per user with only the three named columns, in the order listed.

### Rename a computed column
```sql
SELECT name, age AS age_in_years
FROM users;
```
AS controls the column heading in the result, which makes computed output readable and easier to reference.

### Remove duplicate rows
```sql
SELECT DISTINCT city
FROM users;
```
Several users live in the same city, so DISTINCT collapses those repeats into one row per city.

## Common Mistakes
### Reaching for the asterisk by default
❌ Incorrect
```sql
SELECT * FROM users;
```
✅ Correct
```sql
SELECT name, email FROM users;
```
💡 Why it happens: The shorthand is quick while exploring, but it hides intent and silently changes what a query returns when the table gains columns later.

### Expecting DISTINCT to apply to one column
❌ Incorrect
```sql
SELECT DISTINCT city, name
FROM users;
```
✅ Correct
```sql
SELECT DISTINCT city
FROM users;
```
💡 Why it happens: DISTINCT de-duplicates whole rows, so adding a unique column such as name makes every row distinct again and nothing is removed.

### Assuming rows arrive in a stable order
❌ Incorrect
```sql
SELECT name, age FROM users;
```
✅ Correct
```sql
SELECT name, age FROM users ORDER BY age DESC;
```
💡 Why it happens: Without ORDER BY the database may return rows in any order, and the order you see today can change as the table grows.
