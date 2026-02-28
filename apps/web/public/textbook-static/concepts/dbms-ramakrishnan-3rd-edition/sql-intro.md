# Introduction to SQL

## Definition

SQL (Structured Query Language) is a programming language used for managing and manipulating relational databases. It allows users to create, retrieve, update, and delete data from databases efficiently.

## Explanation

SQL is essential for database management because it provides a standardized way to interact with databases. Here’s how it works and when to use it:

1. **What problem does SQL solve?** SQL addresses the need for efficient data management by allowing users to perform complex operations on large datasets without needing to manually handle each record.

2. **How does it work?** SQL uses a set of commands (like SELECT, INSERT, UPDATE, DELETE) to interact with databases. Each command is designed to perform a specific task, such as retrieving data that meets certain criteria or modifying existing data.

3. **When to use it?** Use SQL whenever you need to manage a relational database. This includes creating new databases, adding or removing data, updating records, and querying data based on specific conditions.

4. **Key things to remember:** Always ensure your SQL queries are well-structured and properly formatted. Common mistakes include forgetting to close parentheses or using incorrect syntax.

## Examples

### Basic Usage

```sql
-- SELECT all employees FROM the Employees TABLE SELECT * FROM Employees;
```

This example demonstrates how to retrieve all records from a table.

### Practical Example

```sql
-- Find all employees who work in the 'Sales' department SELECT name, ssn FROM Employees WHERE dept_id = (SELECT did FROM Departments WHERE dname = 'Sales');
```

This practical example shows how to use a subquery to filter data based on related tables.

## Common Mistakes

### Forgetting to close parentheses

**Incorrect:**

```sql
-- Incorrect query SELECT name, ssn FROM Employees WHERE dept_id = (SELECT did FROM Departments WHERE dname = 'Sales';
```

**Correct:**

```sql
-- Corrected query
SELECT name, ssn FROM Employees WHERE dept_id = (SELECT did FROM Departments WHERE dname = 'Sales')
```

**Why this happens:** This mistake can lead to syntax errors. Always ensure all parentheses are properly closed.

---

## Practice

**Question:** Write a SQL query that selects the names and social security numbers of all employees who work in departments with a budget greater than $50,000.

**Solution:** -- Solution
SELECT e.name, e.ssn FROM Employees e JOIN DepLMgr d ON e.ssn = d.ssn WHERE d.budget > 50000;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*