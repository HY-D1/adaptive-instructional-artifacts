# Subqueries

## Definition

Subqueries are queries nested within another query. They allow you to perform complex operations by breaking down a problem into smaller parts.

## Explanation

Subqueries are essential for performing more advanced data manipulation and analysis tasks. They can be used in the SELECT, FROM, WHERE, and HAVING clauses of SQL. Subqueries help simplify complex queries by breaking them down into manageable parts. For example, you might use a subquery to find the average age of sailors who are voting age (at least 18) for each rating level that has at least two such sailors.

## Examples

### Basic Usage

```sql
-- Find the average age of sailors who are voting age for each rating level
SELECT S.rating, AVG(S.age) AS avg_age FROM Sailors S WHERE S.age >= 18 GROUP BY S.rating;
```

This example demonstrates how to use a subquery in the WHERE clause to filter data before grouping.

### Practical Example

```sql
-- Find the average age of sailors who are voting age for each rating level that has at least two such sailors
SELECT S.rating, AVG(S.age) AS avg_age FROM Sailors S WHERE S.age >= 18 GROUP BY S.rating HAVING COUNT(*) >= 2;
```

This practical example shows how to use a subquery in the HAVING clause to filter groups based on their size.

## Common Mistakes

### Incorrect placement of subqueries

**Incorrect:**

```sql
-- Incorrect placement SELECT S.rating, AVG(S.age) AS avg_age FROM Sailors S WHERE (SELECT COUNT(*) FROM Sailors S2 WHERE S2.rating = S.rating) >= 2;
```

**Correct:**

```sql
-- Correct placement
SELECT S.rating, AVG(S.age) AS avg_age FROM Sailors S WHERE S.age >= 18 GROUP BY S.rating HAVING COUNT(*) >= 2;
```

**Why this happens:** This mistake occurs when a subquery is placed in the wrong clause. Subqueries should be used in SELECT, FROM, WHERE, or HAVING.

### Incorrect handling of data types

**Incorrect:**

```sql
-- Incorrect handling
SELECT S.rating, AVG(S.age) AS avg_age FROM Sailors S WHERE S.age >= '18' GROUP BY S.rating;
```

**Correct:**

```sql
-- Correct handling
SELECT S.rating, AVG(S.age) AS avg_age FROM Sailors S WHERE S.age >= 18 GROUP BY S.rating;
```

**Why this happens:** This mistake happens when data types are not handled correctly in comparisons. Always ensure that the comparison values match the column data type.

---

## Practice

**Question:** Create a subquery to find the average age of sailors who are voting age for each rating level that has at least three such sailors.

**Solution:** -- Solution
SELECT S.rating, AVG(S.age) AS avg_age FROM Sailors S WHERE S.age >= 18 GROUP BY S.rating HAVING COUNT(*) >= 3;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*