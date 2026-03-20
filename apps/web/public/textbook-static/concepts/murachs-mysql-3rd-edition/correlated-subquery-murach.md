# Correlated Subqueries

## Definition

Correlated subqueries are a type of SQL query where a subquery is nested within another query and references data from the outer query.

## Explanation

Correlated subqueries are essential when you need to compare or filter data based on values that exist in another part of your query. They allow you to perform complex operations by leveraging data from both the main query and the subquery. This is particularly useful when dealing with conditions that depend on specific rows within a dataset.

## Examples

### Basic Usage

```sql
-- Find employees who earn more than the average salary in their department SELECT employee_id, first_name, last_name, salary FROM employees e1 WHERE salary > (SELECT AVG(salary) FROM employees e2 WHERE e2.department_id = e1.department_id);
```

This example demonstrates how a correlated subquery is used to compare each employee's salary against the average salary in their department.

### Practical Example

```sql
-- Find customers who have made more than one purchase SELECT customer_id, first_name, last_name FROM customers c1 WHERE (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c1.customer_id) > 1;
```

This practical example shows how a correlated subquery can be used to identify customers who have made multiple purchases.

## Common Mistakes

### Incorrectly using an outer join instead of a correlated subquery

**Incorrect:**

```sql
-- Incorrect use of outer join
SELECT e.employee_id, e.first_name, e.last_name, AVG(o.order_amount) AS avg_order_amount
FROM employees e
LEFT JOIN orders o ON e.employee_id = o.employee_id
GROUP BY e.employee_id;
```

**Correct:**

```sql
-- Correct use of correlated subquery SELECT employee_id, first_name, last_name, (SELECT AVG(order_amount) FROM orders WHERE employee_id = e.employee_id) AS avg_order_amount FROM employees e;
```

**Why this happens:** This mistake occurs when a student tries to solve a problem with an outer join instead of a correlated subquery. The correct approach uses a correlated subquery to calculate the average order amount for each employee.

---

## Practice

**Question:** Write a query that finds products which have been ordered more than 10 times.

**Solution:** -- Solution using correlated subquery
SELECT product_id, product_name
FROM products p
WHERE (SELECT COUNT(*) FROM orders_items oi WHERE oi.product_id = p.product_id) > 10;

---

*Source: Murach's MySQL 3rd Edition*