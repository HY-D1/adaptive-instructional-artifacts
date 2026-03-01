# Creating Tables and Indexes

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand how to create tables with proper column definitions
- Learn to specify data types and constraints
- Avoid common CREATE TABLE mistakes

## What is This?

CREATE TABLE is a SQL statement used to create a new table in a database.

It defines the table structure by specifying column names, data types, and optional constraints like primary keys and foreign keys. Use CREATE TABLE when setting up a new database, adding new entity types to your schema, or building temporary tables for data processing. Proper table design is foundational to database performance and data integrity—well-designed tables with appropriate constraints prevent data errors and make queries more efficient.

## Examples

### Example 1: Basic CREATE TABLE

**Difficulty:** Beginner

**Scenario:** Create a simple users table

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    age INTEGER
);
```

**Explanation:** This creates a users table with four columns. id is the primary key (unique identifier), name cannot be NULL (must have a value), email and age can be NULL.

### Example 2: CREATE TABLE with constraints

**Difficulty:** Intermediate

**Scenario:** Create an orders table with foreign key

```sql
CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total_amount REAL,
    order_date TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Explanation:** This creates an orders table where user_id references the id column in the users table, establishing a relationship between the tables.

### Example 3: CREATE TABLE with DEFAULT values

**Difficulty:** Intermediate

**Scenario:** Create a products table with default stock quantity

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL,
    category TEXT,
    stock_quantity INTEGER DEFAULT 0
);
```

**Explanation:** The DEFAULT constraint ensures that if no value is provided for stock_quantity, it will be set to 0 automatically.

## Common Mistakes

### Mistake 1: Missing data type

**Incorrect SQL:**
```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name,
    price REAL
);
```

**Error Message:** `Error: near ")": syntax error`

**Why it happens:** Every column must have a data type specified. Here, the 'name' column is missing its data type.

**Corrected SQL:**
```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT,
    price REAL
);
```

💡 **Key Takeaway:** Always specify a data type for each column

### Mistake 2: Using reserved keyword as column name

**Incorrect SQL:**
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    order TEXT,
    date TEXT
);
```

**Error Message:** `Error: near "order": syntax error`

**Why it happens:** 'order' is a reserved keyword in SQL (used in ORDER BY). Using it as a column name causes a syntax error.

**Corrected SQL:**
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    event_order INTEGER,
    event_date TEXT
);
```

💡 **Key Takeaway:** Avoid using SQL reserved keywords (like order, select, from, where) as column names, or use different identifiers

## Practice Challenge

**Create a table called 'products' with columns: id (primary key), product_name (required), price (decimal number), and category (optional text field).**

💡 **Hint:** Remember to specify data types for all columns and use NOT NULL for required fields.

<details>
<summary>Click to see solution</summary>

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    product_name TEXT NOT NULL,
    price REAL,
    category TEXT
);
```

**Explanation:** This creates a products table with an auto-incrementing primary key, a required product name, and optional price and category fields.
</details>

## Related Practice Problems

- [problem-26](/practice/problem-26)
- [problem-27](/practice/problem-27)

---

*Content generated for SQL-Adapt Learning Platform*
