# Set Operations in SQL

## Definition

Set operations in SQL allow you to combine the results of two or more SELECT statements into a single result set. They are essential for performing complex queries and data analysis.

## Explanation

Set operations include UNION, INTERSECT, and EXCEPT. Each serves a different purpose:

1. **UNION**: Combines rows from two SELECT statements. It removes duplicate rows unless you use UNION ALL.
2. **INTERSECT**: Returns only the rows that are common to both SELECT statements.
3. **EXCEPT**: Returns rows that are in the first SELECT statement but not in the second.

These operations are particularly useful when you need to compare data across different tables or conditions, allowing for powerful data analysis and reporting.

## Examples

### Basic UNION Example

```sql
-- Selecting students FROM two different departments SELECT name FROM students WHERE department = 'CS' UNION SELECT name FROM students WHERE department = 'EE';
```

This query combines the names of students from Computer Science and Electrical Engineering departments, removing any duplicates.

### Practical INTERSECT Example

```sql
-- Finding common courses between two professors SELECT course_id FROM professor_courses WHERE professor_id = 101 INTERSECT SELECT course_id FROM professor_courses WHERE professor_id = 102;
```

This practical example helps identify which courses are taught by both Professor 101 and Professor 102.

## Common Mistakes

### Forgetting to match column counts and types in set operations

**Incorrect:**

```sql
-- Incorrect query due to mismatched columns SELECT name FROM students UNION SELECT id, name FROM employees;
```

**Correct:**

```sql
-- Correct query with matching columns SELECT name FROM students UNION SELECT name AS name FROM employees;
```

**Why this happens:** Ensure that each SELECT statement in a set operation has the same number of columns and compatible data types.

---

## Practice

**Question:** Write a SQL query using UNION to find all customers who have either made a purchase or subscribed to a service.

**Solution:** -- Solution
SELECT customer_id FROM purchases
UNION
SELECT customer_id FROM subscriptions;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*