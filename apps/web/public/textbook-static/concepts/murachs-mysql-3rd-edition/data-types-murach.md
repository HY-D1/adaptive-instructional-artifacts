# MySQL Data Types

## Definition

MySQL data types are specific formats used to store different kinds of data in a database table. Understanding and using the correct data type is crucial for efficient data storage and retrieval.

## Explanation

Data types in MySQL determine how data is stored and manipulated within a database. Common data types include INT for integers, VARCHAR for variable-length strings, DATE for dates, and FLOAT for floating-point numbers. Choosing the right data type ensures that data is stored efficiently and accurately. For example, using an INT instead of a VARCHAR for numerical data can save space and improve query performance.

## Examples

### Basic Usage

```sql
-- Define a TABLE with appropriate data types CREATE TABLE products ( product_id INT PRIMARY KEY, product_name VARCHAR(100), price FLOAT );
```

This example demonstrates how to create a table with columns of different data types. The product_id is an integer, product_name is a variable-length string, and price is a floating-point number.

### Practical Example

```sql
-- INSERT data into the products TABLE INSERT INTO products (product_id, product_name, price) VALUES (1, 'Laptop', 999.99);
```

This practical example shows how to insert data into a table using the correct data types for each column.

## Common Mistakes

### Using VARCHAR for numeric data

**Incorrect:**

```sql
-- Incorrect usage CREATE TABLE products ( product_id INT PRIMARY KEY, product_name VARCHAR(100), price VARCHAR(10) );
```

**Correct:**

```sql
-- Correct usage CREATE TABLE products ( product_id INT PRIMARY KEY, product_name VARCHAR(100), price FLOAT );
```

**Why this happens:** Using VARCHAR for numeric data can lead to issues with sorting and calculations. Always use the appropriate numeric data type like INT or FLOAT.

---

## Practice

**Question:** Create a table called 'employees' with columns: employee_id (INT), first_name (VARCHAR), last_name (VARCHAR), hire_date (DATE), salary (FLOAT). Insert one row of data into the table.

**Solution:** -- Create and insert data into employees table
CREATE TABLE employees (
  employee_id INT PRIMARY KEY,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  hire_date DATE,
  salary FLOAT
);
INSERT INTO employees (employee_id, first_name, last_name, hire_date, salary) VALUES (1, 'John', 'Doe', '2020-06-15', 75000.00);

---

*Source: Murach's MySQL 3rd Edition*