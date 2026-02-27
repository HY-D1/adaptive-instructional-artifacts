# HAVING Clause

## Definition

The HAVING clause is used to filter groups of rows based on aggregate functions, similar to how WHERE filters individual rows.

## Explanation

Imagine you have a group of students and you want to find out which classes have an average score above a certain threshold. The HAVING clause helps with this by allowing you to apply conditions after the data has been grouped. It works in conjunction with GROUP BY, which groups rows based on one or more columns. After grouping, HAVING allows you to specify conditions that must be met for the group to be included in the final result set.

## Examples

### Basic Usage

```sql
SELECT department, AVG(salary) AS avg_salary FROM employees GROUP BY department HAVING AVG(salary) > 5000;
```

This query groups employees by their department and calculates the average salary for each department. It then filters out departments where the average salary is not greater than 5000.

### Practical Example

```sql
SELECT customer_id, COUNT(order_id) AS order_count FROM orders GROUP BY customer_id HAVING COUNT(order_id) > 10;
```

This practical example shows how to find customers who have placed more than 10 orders. It groups the orders by customer ID and filters out those with an order count greater than 10.

## Common Mistakes

### Using WHERE instead of HAVING

**Incorrect:**

```sql
SELECT department, AVG(salary) AS avg_salary FROM employees WHERE AVG(salary) > 5000;
```

**Correct:**

```sql
SELECT department, AVG(salary) AS avg_salary FROM employees GROUP BY department HAVING AVG(salary) > 5000;
```

**Why this happens:** The mistake here is using WHERE instead of HAVING. WHERE filters rows before grouping, while HAVING filters groups after they are created.

---

## Practice

**Question:** Find the names and average ratings of sailors whose average rating is greater than 8.

**Solution:** SELECT sname, AVG(rating) AS avg_rating FROM Sailors GROUP BY sname HAVING AVG(rating) > 8;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*