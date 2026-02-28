# HAVING Clause

## Definition

The HAVING clause is used to filter groups of rows based on a condition after an aggregation has been applied. It's similar to WHERE but operates on aggregated data.

## Explanation

Imagine you have a dataset of sales transactions and you want to find out which products had total sales greater than $10,000. The HAVING clause allows you to specify this condition on the aggregated data (total sales). Here's how it works:
1. GROUP BY is used to group rows that have the same values in specified columns.
2. Aggregation functions like SUM(), COUNT(), AVG() are applied to each group.
3. The HAVING clause then filters these groups based on a condition.

## Examples

### Basic Usage

```sql
SELECT product_id, SUM(sales_amount) as total_sales
FROM sales
GROUP BY product_id
HAVING total_sales > 10000;
```

This query groups sales by product and filters out products with total sales less than or equal to $10,000.

### Practical Example

```sql
SELECT department_id, AVG(salary) as avg_salary
FROM employees
GROUP BY department_id
HAVING avg_salary > 5000;
```

This practical example finds departments where the average salary is more than $5,000.

## Common Mistakes

### Using WHERE instead of HAVING

**Incorrect:**

```sql
SELECT product_id, SUM(sales_amount) as total_sales
FROM sales
WHERE total_sales > 10000;
```

**Correct:**

```sql
SELECT product_id, SUM(sales_amount) as total_sales
FROM sales
group BY product_id
HAVING total_sales > 10000;
```

**Why this happens:** Remember, HAVING is for filtering groups after aggregation. WHERE filters rows before grouping.

---

## Practice

**Question:** Find the departments with more than 5 employees and list their IDs along with the number of employees in each department.

**Solution:** SELECT department_id, COUNT(employee_id) as employee_count
FROM employees
group BY department_id
HAVING employee_count > 5;

---

*Source: Murach's MySQL 3rd Edition*