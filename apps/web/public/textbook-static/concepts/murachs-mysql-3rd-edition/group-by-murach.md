# GROUP BY Clause

## Definition

The GROUP BY clause is used to group rows that have the same values in specified columns into summary rows.

## Explanation

The GROUP BY clause is essential for performing aggregate functions like SUM, AVG, COUNT, MAX, and MIN on grouped data. It works by dividing the table's rows into groups based on one or more columns. Each group can then be processed separately to compute aggregated values. This is particularly useful when you need to analyze data in a summarized form, such as calculating total sales per product category.

## Examples

### Basic Usage

```sql
SELECT category, SUM(sales) AS total_sales
FROM products
GROUP BY category;
```

This example groups the 'products' table by the 'category' column and calculates the total sales for each category.

### Practical Example

```sql
SELECT department, AVG(salary) AS avg_salary
FROM employees
GROUP BY department;
```

This practical example groups the 'employees' table by the 'department' column and calculates the average salary for each department.

## Common Mistakes

### Forgetting to include non-aggregated columns in GROUP BY

**Incorrect:**

```sql
SELECT category, SUM(sales)
FROM products;
```

**Correct:**

```sql
SELECT category, SUM(sales) AS total_sales
FROM products
GROUP BY category;
```

**Why this happens:** This mistake occurs when you try to select a column that is not aggregated without including it in the GROUP BY clause. It results in an error because MySQL doesn't know how to group rows for non-aggregated columns.

---

## Practice

**Question:** Create a query that groups employees by their department and calculates the total number of employees in each department.

**Solution:** SELECT department, COUNT(*) AS employee_count
FROM employees
GROUP BY department;

---

*Source: Murach's MySQL 3rd Edition*