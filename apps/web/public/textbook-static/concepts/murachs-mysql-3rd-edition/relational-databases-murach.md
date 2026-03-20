# Relational Databases

## Definition

A relational database is a collection of related tables that store data in rows and columns. It uses SQL (Structured Query Language) to manage and manipulate this data.

## Explanation

Relational databases are essential for organizing and retrieving information efficiently. They solve the problem of managing large amounts of data by breaking it into smaller, manageable pieces called tables. Each table has a unique structure with specific columns and rows. SQL is used to interact with these tables, allowing you to query, insert, update, and delete data. Understanding relational databases is crucial for anyone working with data in a structured format.

## Examples

### Basic Usage

```sql
-- SELECT all columns FROM a TABLE SELECT * FROM employees;
```

This example demonstrates how to retrieve all data from an 'employees' table. The asterisk (*) is a wildcard that selects all columns.

### Practical Example

```sql
-- Retrieve specific information based on a condition
SELECT name, salary FROM employees WHERE department = 'Sales';
```

This practical example shows how to query the 'employees' table for names and salaries of those in the Sales department.

## Common Mistakes

### Forgetting to specify a column name or using an asterisk without context

**Incorrect:**

```sql
-- Incorrect usage
SELECT FROM employees;
```

**Correct:**

```sql
-- Correct usage
SELECT * FROM employees;
```

**Why this happens:** Always specify the columns you need. Using an asterisk is fine if you want all columns, but it's better to be specific for clarity and performance.

---

## Practice

**Question:** Create a table named 'students' with columns for id (integer), name (varchar), and age (integer). Insert two students into the table. Then, write a query to retrieve all student names.

**Solution:** -- Create the table
CREATE TABLE students (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  age INT
);
-- Insert data
INSERT INTO students (id, name, age) VALUES (1, 'Alice', 20);
INSERT INTO students (id, name, age) VALUES (2, 'Bob', 22);
-- Query for names
SELECT name FROM students;

---

*Source: Murach's MySQL 3rd Edition*