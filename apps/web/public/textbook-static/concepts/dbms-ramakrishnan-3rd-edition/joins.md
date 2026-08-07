---
id: joins
title: SQL Joins
definition: Combining rows from two or more tables by matching values in a shared column
difficulty: intermediate
estimatedReadTime: 4
pageReferences: [140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150]
tags:
  - sql
  - joins
  - relationships
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# SQL Joins

## Definition
A join combines rows from two tables by matching values in a column they share, so a single query can return data that lives in both.

## Explanation
Relational databases deliberately split information across tables to avoid repeating it. In the practice database, users holds one row per person and orders holds one row per purchase, connected because orders.user_id stores the id of the user who placed the order. Without a join you can list people or list purchases, but you cannot say who bought what. A join is how you put them back together.

INNER JOIN keeps only rows that match on both sides. If a person has never ordered, that person is absent from the result, and an order pointing at a user who no longer exists is absent too. Reach for it when you only care about complete pairs.

LEFT JOIN keeps every row from the left table and fills the right-hand columns with NULL when nothing matches. Use it when the left table is the population you care about and the right side is optional detail, such as listing all users with their order counts including people who have ordered nothing. RIGHT JOIN is the mirror image, and FULL OUTER JOIN keeps unmatched rows from both sides.

The ON clause states the matching rule, and it is worth separating from WHERE: ON decides how rows pair up, while WHERE filters what survives after pairing. With INNER JOIN the difference rarely shows, but with LEFT JOIN a condition on the right-hand table placed in WHERE silently discards the unmatched rows and collapses it back into an inner join.

## Examples
### Pair each order with the person who placed it
```sql
SELECT users.name, orders.product, orders.amount
FROM users
INNER JOIN orders ON orders.user_id = users.id;
```
Only users who actually ordered appear. Charlie has no matching order rows, so he is left out entirely.

### Count orders per user, keeping everyone
```sql
SELECT users.name, COUNT(orders.order_id) AS order_count
FROM users
LEFT JOIN orders ON orders.user_id = users.id
GROUP BY users.id, users.name;
```
Every user appears. Charlie shows a count of 0 because COUNT skips the NULLs produced by the unmatched join.

### Join on a column both tables define
```sql
SELECT employees.emp_name, departments.dept_name
FROM employees
INNER JOIN departments ON employees.dept_id = departments.dept_id;
```
Both tables have a dept_id column, so each reference is qualified with its table name to stay unambiguous.

## Common Mistakes
### Filtering the optional table in WHERE
❌ Incorrect
```sql
SELECT users.name, orders.amount
FROM users
LEFT JOIN orders ON orders.user_id = users.id
WHERE orders.amount > 100;
```
✅ Correct
```sql
SELECT users.name, orders.amount
FROM users
LEFT JOIN orders ON orders.user_id = users.id AND orders.amount > 100;
```
💡 Why it happens: WHERE runs after the join, and a NULL amount is never greater than 100, so unmatched users get dropped. Conditions on the optional side belong in ON.

### Listing tables without a matching rule
❌ Incorrect
```sql
SELECT users.name, orders.product
FROM users, orders;
```
✅ Correct
```sql
SELECT users.name, orders.product
FROM users
INNER JOIN orders ON orders.user_id = users.id;
```
💡 Why it happens: With no matching rule the database pairs every row with every row. Four users and six orders return 24 rows instead of the 6 real purchases.

### Leaving a shared column name unqualified
❌ Incorrect
```sql
SELECT emp_name, dept_id
FROM employees
INNER JOIN departments ON employees.dept_id = departments.dept_id;
```
✅ Correct
```sql
SELECT employees.emp_name, employees.dept_id
FROM employees
INNER JOIN departments ON employees.dept_id = departments.dept_id;
```
💡 Why it happens: Both tables define dept_id, so on its own the name is ambiguous and the query is rejected. Prefix the column with the table you mean.
