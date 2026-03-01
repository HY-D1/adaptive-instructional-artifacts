# Introduction to Relational Databases

## Definition

A relational database is an organized collection of data that is structured using tables. Each table consists of rows and columns, where each row represents a record and each column represents a field. Relational databases use SQL (Structured Query Language) to manage and manipulate the data.

## Explanation

Relational databases solve the problem of managing large amounts of structured data efficiently. They work by organizing data into tables that are linked together through relationships. This structure allows for easy querying, updating, and management of data. Relational databases are widely used in various applications because they provide a robust framework for storing and retrieving information. Key features include ACID transactions, data integrity constraints, and support for complex queries.

## Examples

### Basic Usage

```sql
-- SELECT all records FROM a TABLE SELECT * FROM employees;
```

This example demonstrates how to retrieve all data from an 'employees' table. The asterisk (*) is used to select all columns.

### Practical Example

```sql
-- Find employees in a specific department
SELECT name, position FROM employees WHERE department = 'Sales';
```

This practical example shows how to query data based on a condition. It selects the names and positions of employees who work in the Sales department.

## Common Mistakes

### Forgetting to specify column names in SELECT statements

**Incorrect:**

```sql
-- Incorrect SQL
SELECT FROM employees;
```

**Correct:**

```sql
-- Correct SQL
SELECT * FROM employees;
```

**Why this happens:** This mistake happens when a student tries to select data without specifying any columns. The asterisk (*) is used to select all columns.

---

## Practice

**Question:** Create a table named 'students' with columns for 'id', 'name', and 'age'. Insert three records into the table.

**Solution:** -- Create students table
CREATE TABLE students (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    age INT
);
-- Insert records
INSERT INTO students (id, name, age) VALUES (1, 'Alice', 20);
INSERT INTO students (id, name, age) VALUES (2, 'Bob', 22);
INSERT INTO students (id, name, age) VALUES (3, 'Charlie', 21);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*