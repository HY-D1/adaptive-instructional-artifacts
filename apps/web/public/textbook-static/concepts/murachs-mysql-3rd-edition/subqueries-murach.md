# Subqueries

## Definition

A subquery is a query nested within another query. It allows you to perform complex data retrieval operations by breaking down the task into smaller parts.

## Explanation

Subqueries are incredibly useful for performing more advanced data analysis and manipulation. They allow you to filter, sort, or aggregate data based on results from other queries. For example, if you want to find all employees who earn more than the average salary, you can use a subquery to calculate the average salary first and then compare it with individual employee salaries.

## Examples

### Basic Usage

```sql
-- Find employees earning more than the average salary SELECT name, salary FROM employees WHERE salary > (SELECT AVG(salary) FROM employees);
```

This example demonstrates how a subquery can be used in the WHERE clause to filter data based on results from another query.

### Practical Example

```sql
-- Find products with stock less than 10 units SELECT product_name, stock FROM products WHERE stock < (SELECT MIN(stock) FROM products GROUP BY category HAVING COUNT(*) > 5);
```

This practical example shows how subqueries can be used to filter data based on aggregated results from another query.

## Common Mistakes

### Forgetting to use parentheses around the subquery.

**Incorrect:**

```sql
-- Incorrect: SELECT name, salary FROM employees WHERE salary > AVG(salary);
```

**Correct:**

```sql
-- Correct: SELECT name, salary FROM employees WHERE salary > (SELECT AVG(salary) FROM employees);
```

**Why this happens:** Subqueries must be enclosed in parentheses to ensure they are evaluated correctly.

### Using the wrong comparison operator.

**Incorrect:**

```sql
-- Incorrect: SELECT name, salary FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);
```

**Correct:**

```sql
-- Correct: SELECT name, salary FROM employees WHERE salary > (SELECT AVG(salary) FROM employees);
```

**Why this happens:** It's crucial to use the correct comparison operator based on the desired outcome.

---

## Practice

**Question:** Write a query that finds all customers who have made more than one purchase.

**Solution:** -- Solution: SELECT customer_id FROM purchases GROUP BY customer_id HAVING COUNT(*) > 1;

---

*Source: Murach's MySQL 3rd Edition*