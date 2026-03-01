# Content

## Definition

The Relational Model is a framework for organizing data that uses tables (relations) to store and manage information. It's crucial because it provides a structured way to handle data, ensuring consistency and integrity.

## Explanation

The Relational Model solves the problem of managing complex data by breaking it down into simple, tabular structures called relations. Each relation is made up of rows (tuples) and columns (attributes). The model uses SQL (Structured Query Language) to define, manipulate, and query these relations. It's widely used because it allows for efficient data retrieval and manipulation, ensuring that data remains consistent across the database.

## Examples

### Basic Usage

```sql
-- CREATE a simple TABLE CREATE TABLE students ( id INT PRIMARY KEY, name VARCHAR(100), age INT );
```

This example shows how to create a table named 'students' with columns for student ID, name, and age. The primary key constraint ensures that each student has a unique ID.

### Practical Example

```sql
-- INSERT data into the students TABLE INSERT INTO students (id, name, age) VALUES (1, 'Alice', 20);
```

This example demonstrates inserting data into the 'students' table. It shows how to add a new student with ID 1, name Alice, and age 20.

## Common Mistakes

### Forgetting to define primary keys

**Incorrect:**

```sql
-- Incorrect: No primary key CREATE TABLE students ( id INT, name VARCHAR(100), age INT );
```

**Correct:**

```sql
-- Correct: Primary key defined CREATE TABLE students ( id INT PRIMARY KEY, name VARCHAR(100), age INT );
```

**Why this happens:** Primary keys are essential for ensuring data integrity. Forgetting to define one can lead to duplicate entries and other issues.

---

## Practice

**Question:** Create a table named 'employees' with columns for employee ID, name, department, and salary. Ensure that the employee ID is unique.

**Solution:** -- Solution
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    department VARCHAR(50),
    salary DECIMAL(10, 2)
);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*