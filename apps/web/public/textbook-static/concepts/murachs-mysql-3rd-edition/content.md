# Content

## Definition

The SELECT statement is used to retrieve data from a database. It's essential for querying information and is one of the most fundamental SQL commands.

## Explanation

The SELECT statement allows you to specify which columns to retrieve from a table or tables, filter the results based on conditions, and sort them as needed. This is crucial for developers who need to extract specific data from databases to display in applications or perform further analysis. Understanding how to use the SELECT statement effectively can save time and reduce errors in data retrieval.

## Examples

### Basic Usage

```sql
-- SELECT all columns FROM a TABLE SELECT * FROM employees;
```

This example retrieves all columns and rows from the 'employees' table. The asterisk (*) is a wildcard that selects every column.

### Practical Example

```sql
-- SELECT specific columns with conditions SELECT name, salary FROM employees WHERE department = 'Sales';
```

This practical example retrieves the names and salaries of all employees in the Sales department. It demonstrates how to specify column names and use a WHERE clause for filtering.

## Common Mistakes

### Forgetting the FROM clause

**Incorrect:**

```sql
-- Incorrect SQL
SELECT name;
```

**Correct:**

```sql
-- Correct SQL
SELECT name FROM employees;
```

**Why this happens:** This mistake occurs when a developer tries to select data without specifying which table it should come from. The FROM clause is essential for defining the source of the data.

---

## Practice

**Question:** Write an SQL query that selects the names and email addresses of all customers who have made more than 5 purchases.

**Solution:** -- Solution
SELECT c.name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.customer_id HAVING COUNT(o.order_id) > 5;

---

*Source: Murach's MySQL 3rd Edition*