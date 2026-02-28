# Introduction to MySQL

## Definition

The SELECT statement is used to retrieve data from a database. It allows you to specify which columns and rows to fetch based on certain conditions.

## Explanation

The SELECT statement is one of the most fundamental tools in SQL, allowing developers to extract specific information from a database. It works by specifying the columns you want to retrieve and optionally filtering the data with WHERE clauses. This statement is crucial for querying databases and retrieving the necessary data for applications. Understanding how to use SELECT effectively can greatly enhance your ability to interact with and manipulate data in MySQL.

## Examples

### Basic Usage

```sql
-- Selecting specific columns FROM a TABLE SELECT name, age FROM users;
```

This example demonstrates how to select the 'name' and 'age' columns from the 'users' table. It retrieves all rows in the table.

### Practical Example

```sql
-- Selecting data with a condition
SELECT name FROM users WHERE age > 18;
```

This practical example shows how to select only the names of users who are older than 18 years. It uses a WHERE clause to filter the results based on the 'age' column.

## Common Mistakes

### Forgetting to specify columns

**Incorrect:**

```sql
-- Incorrect: SELECT FROM users;
```

**Correct:**

```sql
-- Correct: SELECT * FROM users;
```

**Why this happens:** This mistake occurs when a developer tries to run a SELECT statement without specifying any columns. This will result in an error because SQL needs to know which data to retrieve.

### Using incorrect column names

**Incorrect:**

```sql
-- Incorrect: SELECT name, age FROM users WHERE email = 'test@example.com';
```

**Correct:**

```sql
-- Correct: SELECT name, age FROM users WHERE email = 'test@example.com';
```

**Why this happens:** This mistake happens when a developer specifies a column that does not exist in the table. It's crucial to double-check column names and ensure they match exactly with those in the database schema.

---

## Practice

**Question:** Write a SELECT statement to retrieve the 'product_name' and 'price' from the 'products' table where the 'category' is 'Electronics'.

**Solution:** SELECT product_name, price FROM products WHERE category = 'Electronics';
This query will return the names and prices of all products in the 'Electronics' category.

---

*Source: Murach's MySQL 3rd Edition*