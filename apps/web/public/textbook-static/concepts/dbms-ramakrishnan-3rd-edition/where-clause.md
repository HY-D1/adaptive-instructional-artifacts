---
id: where-clause
title: WHERE Clause
definition: Filtering which rows a query returns by testing a condition against each row
difficulty: beginner
estimatedReadTime: 4
pageReferences: [130, 131, 132, 133, 134, 135]
tags:
  - sql
  - filtering
  - where
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# WHERE Clause

## Definition
WHERE filters rows, keeping only those for which its condition is true. Rows that test false, or unknown because of NULL, are discarded.

## Explanation
WHERE is evaluated after FROM has assembled the candidate rows but before GROUP BY, HAVING, and SELECT. That ordering explains most of its behaviour: it decides which rows the rest of the query ever sees, which is why it cannot refer to aggregates like COUNT (they do not exist yet) and usually cannot refer to column aliases defined in SELECT.

Conditions are built from comparisons such as equals, not-equals, greater-than, and less-than, combined with AND, OR, and NOT. Precedence matters and is a common source of quiet bugs: AND binds more tightly than OR, so a mixed condition without parentheses rarely means what it looks like. Adding explicit parentheses costs nothing and removes the ambiguity.

Several operators exist purely for readability. IN tests membership in a list, BETWEEN tests an inclusive range, and LIKE does simple pattern matching with the percent sign standing for any run of characters. Each can be written with plain comparisons instead, but the shorter form is easier to read and harder to get wrong.

NULL deserves particular care. It means unknown, not zero and not empty text, so any comparison against it returns unknown rather than true. Testing whether something equals NULL therefore never matches anything, even for rows that really do hold NULL. Use IS NULL and IS NOT NULL, which are the only operators that inspect NULL directly.

## Examples
### Combine conditions with AND
```sql
SELECT name, age, city
FROM users
WHERE city = 'Seattle' AND age >= 25;
```
Both tests must hold. Charlie lives in Seattle but is 22, so only Alice comes back.

### Match a list and a range
```sql
SELECT name, age, city
FROM users
WHERE city IN ('Seattle', 'Portland')
  AND age BETWEEN 25 AND 32;
```
IN is shorthand for a chain of OR comparisons, and BETWEEN includes both endpoints.

### Find rows where a value is missing
```sql
SELECT task_name, status
FROM tasks
WHERE status IS NULL;
```
IS NULL is the only way to match a missing value. The task with no recorded status is returned.

## Common Mistakes
### Comparing to NULL with equals
❌ Incorrect
```sql
SELECT task_name FROM tasks WHERE status = NULL;
```
✅ Correct
```sql
SELECT task_name FROM tasks WHERE status IS NULL;
```
💡 Why it happens: NULL means unknown, so equals returns unknown rather than true and the row never survives the filter. Only IS NULL inspects it directly.

### Mixing AND and OR without parentheses
❌ Incorrect
```sql
SELECT name, city, age
FROM users
WHERE city = 'Seattle' OR city = 'Portland' AND age > 30;
```
✅ Correct
```sql
SELECT name, city, age
FROM users
WHERE (city = 'Seattle' OR city = 'Portland') AND age > 30;
```
💡 Why it happens: AND binds tighter than OR, so the first version returns every Seattle user at any age. Parentheses make the intended grouping explicit.

### Filtering an aggregate in WHERE
❌ Incorrect
```sql
SELECT city, COUNT(*) AS people
FROM users
WHERE COUNT(*) > 1
GROUP BY city;
```
✅ Correct
```sql
SELECT city, COUNT(*) AS people
FROM users
GROUP BY city
HAVING COUNT(*) > 1;
```
💡 Why it happens: WHERE runs before rows are grouped, so no aggregate has been computed yet. HAVING filters the groups after aggregation.
