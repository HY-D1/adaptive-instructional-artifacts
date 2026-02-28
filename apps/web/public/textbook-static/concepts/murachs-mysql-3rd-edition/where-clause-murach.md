# WHERE Clause

## Definition

The WHERE clause is used in SQL to filter records and only return those that meet certain conditions.

## Explanation

The WHERE clause is essential for narrowing down data in a database. It allows you to specify conditions that rows must meet to be included in the result set. For example, if you want to find all customers who live in New York City, you would use the WHERE clause to filter out only those records where the city column equals 'New York City'. This is crucial for retrieving specific data efficiently and avoiding unnecessary processing of large datasets.

## Examples

### Basic Usage

```sql
-- SELECT all customers FROM New York City SELECT * FROM customers WHERE city = 'New York City';
```

This example selects all columns (indicated by *) from the 'customers' table where the 'city' column equals 'New York City'.

### Practical Example

```sql
-- Find employees who earn more than $50,000
SELECT name, salary FROM employees WHERE salary > 50000;
```

This practical example retrieves the 'name' and 'salary' of all employees whose salary is greater than $50,000.

## Common Mistakes

### Forgetting to include a semicolon at the end of the condition

**Incorrect:**

```sql
-- Incorrect: No semicolon
SELECT * FROM customers WHERE city = 'New York City'
```

**Correct:**

```sql
-- Correct: Semicolon included
SELECT * FROM customers WHERE city = 'New York City';
```

**Why this happens:** SQL statements must end with a semicolon to indicate the end of the command. Forgetting it can lead to syntax errors.

---

## Practice

**Question:** Write a SQL query that selects all products from the 'products' table where the price is less than $100 and the category is 'Electronics'.

**Solution:** -- Solution: Selecting products based on multiple conditions
SELECT * FROM products WHERE price < 100 AND category = 'Electronics';
Explanation: This query filters the 'products' table to return only those rows where both the 'price' column is less than $100 and the 'category' column equals 'Electronics'.

---

*Source: Murach's MySQL 3rd Edition*