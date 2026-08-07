---
id: subqueries
title: Subqueries
definition: Nesting one SELECT inside another so the inner result feeds the outer query
difficulty: advanced
estimatedReadTime: 4
pageReferences: [180, 181, 182, 183, 184, 185]
tags:
  - sql
  - subqueries
  - nested-queries
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Subqueries

## Definition
A subquery is a SELECT written inside another statement. The inner query runs first and its result is used by the outer query as a value, a list, or a table.

## Explanation
Subqueries answer questions that need a second pass over the data, such as comparing each row against an aggregate of the whole table. Because you cannot put an aggregate directly in WHERE, computing it in a nested SELECT is the standard way to ask which products cost more than average.

The shape of the inner result determines how it can be used. A scalar subquery returns exactly one row and one column, so it can sit anywhere a single value is allowed. A subquery returning one column and many rows works with IN, NOT IN, ANY, or ALL. A subquery returning a full result set can appear in FROM as a derived table, in which case it needs an alias.

Subqueries are either uncorrelated or correlated. An uncorrelated subquery is self-contained: it does not mention the outer query, so the database can evaluate it once and reuse the answer. A correlated subquery references a column from the outer row, so conceptually it is re-evaluated for each row the outer query considers. Correlated subqueries are more expressive but more expensive, and many can be rewritten as joins that run faster.

EXISTS deserves a mention because it tests only whether the inner query produced any row at all, ignoring the values themselves. It pairs naturally with correlated subqueries, and NOT EXISTS is usually the safer way to express absence, since NOT IN behaves surprisingly when the inner query returns NULL.

## Examples
### Compare each row against an aggregate
```sql
SELECT name, price
FROM products
WHERE price > (SELECT AVG(price) FROM products);
```
The inner query yields a single number, so it can be used directly in the comparison. Only products priced above the average survive.

### Test membership against a list of values
```sql
SELECT name
FROM users
WHERE id IN (SELECT user_id FROM orders);
```
The inner query returns one column of user ids, and IN keeps the users that appear in it. Users who never ordered are excluded.

### Reference the outer row from inside
```sql
SELECT users.name,
       (SELECT COUNT(*) FROM orders WHERE orders.user_id = users.id) AS order_count
FROM users;
```
This correlated subquery mentions users.id, so it is evaluated per user and reports each person's order count, including zero.

## Common Mistakes
### Using equals with a multi-row subquery
❌ Incorrect
```sql
SELECT name FROM users
WHERE id = (SELECT user_id FROM orders);
```
✅ Correct
```sql
SELECT name FROM users
WHERE id IN (SELECT user_id FROM orders);
```
💡 Why it happens: Equals compares against a single value, so a subquery returning several rows is an error. IN is the operator for a list of candidates.

### NOT IN against a column that contains NULL
❌ Incorrect
```sql
SELECT emp_name FROM employees
WHERE manager_id NOT IN (SELECT manager_id FROM employees);
```
✅ Correct
```sql
SELECT emp_name FROM employees
WHERE manager_id NOT IN (
  SELECT manager_id FROM employees WHERE manager_id IS NOT NULL
);
```
💡 Why it happens: If the inner query yields even one NULL, every NOT IN test evaluates to unknown and the query returns nothing. Exclude NULLs, or use NOT EXISTS.

### Returning two columns where one value is expected
❌ Incorrect
```sql
SELECT name,
       (SELECT product, amount FROM orders WHERE orders.user_id = users.id LIMIT 1)
FROM users;
```
✅ Correct
```sql
SELECT name,
       (SELECT product FROM orders WHERE orders.user_id = users.id LIMIT 1) AS first_product
FROM users;
```
💡 Why it happens: A subquery used as a value must produce exactly one column and at most one row. Select the single column you actually need.
