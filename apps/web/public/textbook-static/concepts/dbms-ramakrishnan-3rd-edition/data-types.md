# SQL Data Types

## Definition

SQL Data Types are specific formats used to store data in a database table. Understanding these types is crucial for designing efficient and accurate databases.

## Explanation

SQL Data Types define how data is stored and managed within a database. Each type has specific characteristics that dictate its usage, storage requirements, and operations. For example, INT stores integers, VARCHAR stores variable-length strings, and DATE stores dates. Choosing the right data type ensures that your database operates efficiently and accurately.

## Examples

### Basic Usage

```sql
-- Define a TABLE with various data types CREATE TABLE example_table ( id INT, name VARCHAR(100), birth_date DATE, salary FLOAT, is_active BOOLEAN );
```

This example demonstrates how to define a table with different SQL Data Types. Each column is assigned a specific data type that suits the type of data it will store.

### Practical Example

```sql
-- Inserting data into a TABLE with proper data types INSERT INTO example_table (id, name, birth_date, salary, is_active) VALUES (1, 'John Doe', '1985-06-23', 75000.00, TRUE);
```

This practical example shows how to insert data into a table using the correct SQL Data Types. Each value corresponds to its respective column's data type.

## Common Mistakes

### Using an incorrect data type for a column

**Incorrect:**

```sql
-- Incorrect use of VARCHAR CREATE TABLE example_table ( id INT, name INT, -- Incorrect: name should be VARCHAR birth_date DATE, salary FLOAT, is_active BOOLEAN );
```

**Correct:**

```sql
-- Correct use of VARCHAR CREATE TABLE example_table ( id INT, name VARCHAR(100), birth_date DATE, salary FLOAT, is_active BOOLEAN );
```

**Why this happens:** This mistake occurs when a column's data type does not match the data being stored. Always ensure that the data type accurately reflects the data.

---

## Practice

**Question:** Create a table named 'employees' with columns for id (INT), name (VARCHAR), hire_date (DATE), and salary (FLOAT). Insert a record into this table.

**Solution:** -- Create the employees table
CREATE TABLE employees (
    id INT,
    name VARCHAR(100),
    hire_date DATE,
    salary FLOAT
);
-- Insert data into the employees table
INSERT INTO employees (id, name, hire_date, salary)
VALUES (1, 'Jane Smith', '2015-07-14', 80000.00);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*