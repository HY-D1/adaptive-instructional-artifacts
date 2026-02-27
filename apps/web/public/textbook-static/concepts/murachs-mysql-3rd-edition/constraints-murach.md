# Constraints

## Definition

Constraints are rules that ensure data integrity and consistency within a database. They prevent invalid or duplicate data from being entered into tables.

## Explanation

Constraints are essential for maintaining the accuracy and reliability of your database. Think of them as quality control checks that ensure only valid data is stored. There are several types of constraints, including NOT NULL, UNIQUE, PRIMARY KEY, FOREIGN KEY, CHECK, and DEFAULT. Each serves a specific purpose in ensuring data consistency and completeness.

## Examples

### Basic Usage

```sql
-- Adding a NOT NULL constraint to a column ALTER TABLE employees ADD COLUMN email VARCHAR(255) NOT NULL;
```

This example adds a NOT NULL constraint to the 'email' column, ensuring that every employee must have an email address.

### Practical Example

```sql
-- Adding a UNIQUE constraint to ensure no duplicate emails ALTER TABLE employees ADD CONSTRAINT unique_email UNIQUE (email);
```

This practical example ensures that all email addresses in the 'employees' table are unique, preventing duplicates.

## Common Mistakes

### Forgetting to specify NOT NULL when creating a column

**Incorrect:**

```sql
-- Incorrect SQL CREATE TABLE employees (id INT);
```

**Correct:**

```sql
-- Correct SQL CREATE TABLE employees (id INT NOT NULL);
```

**Why this happens:** This mistake can lead to null values in columns where they should not be allowed. Always specify NOT NULL when it's appropriate.

### Using UNIQUE instead of PRIMARY KEY for a column that needs to uniquely identify rows

**Incorrect:**

```sql
-- Incorrect SQL CREATE TABLE employees (id INT UNIQUE);
```

**Correct:**

```sql
-- Correct SQL CREATE TABLE employees (id INT PRIMARY KEY);
```

**Why this happens:** PRIMARY KEY is more than just UNIQUE; it also ensures NOT NULL. Use PRIMARY KEY when you need a column to uniquely identify rows.

---

## Practice

**Question:** Create a table named 'products' with columns for product_id (primary key), name, and price. Ensure that the 'name' column cannot be null and must be unique.

**Solution:** -- Solution
CREATE TABLE products (
    product_id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    price DECIMAL(10, 2)
);

---

*Source: Murach's MySQL 3rd Edition*