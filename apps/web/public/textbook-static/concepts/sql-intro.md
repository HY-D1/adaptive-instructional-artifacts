# Introduction to SQL

🟢 **Difficulty:** Beginner  
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand what SQL is and why it's used
- Learn the four main types of SQL commands (CRUD operations)
- Write your first SELECT and INSERT statements
- Understand the basic syntax structure of SQL queries

## What is This?

**SQL (Structured Query Language)** is the standard language for interacting with relational databases.

It allows you to ask questions about your data, add new records, update existing ones, and remove data you no longer need. SQL is **declarative**—you describe *what* data you want, and the database figures out *how* to retrieve it. Nearly all modern applications use SQL to store and retrieve information, from simple mobile apps to complex enterprise systems.

## Examples

### Example 1: SELECT - Reading Data

**Difficulty:** Beginner

**Scenario:** You want to see information about users in your database.

```sql
-- Get all columns for all users
SELECT * FROM users;

-- Get specific columns only
SELECT name, email FROM users;

-- Get users with a condition
SELECT * FROM users WHERE city = 'Seattle';
```

**Explanation:** 
- **SELECT** retrieves data from the database
- ***** means "all columns"
- **FROM** specifies which table to query
- **WHERE** filters results based on conditions

Sample output shows columns like: id, name, email, age, city

### Example 2: INSERT - Adding Data

**Difficulty:** Beginner

**Scenario:** A new user named Diana has signed up and you need to add her to the database.

```sql
-- Insert with all columns specified
INSERT INTO users (id, name, email, age, city)
VALUES (6, 'Diana', 'diana@email.com', 27, 'Portland');

-- Verify the insert worked
SELECT * FROM users WHERE name = 'Diana';
```

**Explanation:**
- **INSERT INTO** specifies the table and columns
- **VALUES** provides the data to insert
- String values must be in **single quotes**
- Always verify inserts with a SELECT query

### Example 3: UPDATE and DELETE - Modifying and Removing Data

**Difficulty:** Intermediate

**Scenario:** User Alice moved from Seattle to Portland, and you need to update her record and learn how to safely delete data.

```sql
-- First, verify what you're about to change
SELECT * FROM users WHERE name = 'Alice';

-- Update Alice's city
UPDATE users
SET city = 'Portland'
WHERE name = 'Alice';

-- Verify the update
SELECT * FROM users WHERE name = 'Alice';

-- To delete (always use WHERE!)
-- DELETE FROM users WHERE id = 99;
```

**Explanation:**
- **UPDATE** modifies existing rows; **SET** defines new values
- **WHERE is crucial**—without it, ALL rows would be updated or deleted!
- Always verify your WHERE clause with a SELECT first

## Common Mistakes

### Mistake 1: Forgetting the WHERE Clause in UPDATE or DELETE

**Incorrect:**
```sql
UPDATE users SET city = 'Portland';
```

**Error Message:** Query succeeds but changes every user's city to Portland!

**Why it happens:** Without a WHERE clause, SQL applies the change to every row in the table. This is one of the most common and damaging mistakes for beginners.

**Corrected:**
```sql
-- Step 1: Verify what will be affected
SELECT * FROM users WHERE name = 'Alice';

-- Step 2: Then apply the change
UPDATE users SET city = 'Portland' WHERE name = 'Alice';
```

💡 **Key Takeaway:** Always write the WHERE clause first, verify it with a SELECT query, then add the UPDATE or DELETE. This habit prevents accidental mass changes.

### Mistake 2: Using Double Quotes Instead of Single Quotes for Strings

**Incorrect:**
```sql
SELECT * FROM users WHERE name = "Alice";
```

**Error Message:** `Error: column "Alice" does not exist` (in strict mode)

**Why it happens:** SQL uses **single quotes** `'` for string literals. Double quotes `"` are used for identifiers (column/table names) in standard SQL.

**Corrected:**
```sql
SELECT * FROM users WHERE name = 'Alice';
```

💡 **Key Takeaway:** Always use single quotes `'` for text/string values in SQL. Double quotes are for column/table names in ANSI SQL.

### Mistake 3: Incorrect ORDER of SQL Clauses

**Incorrect:**
```sql
SELECT * FROM users
WHERE age > 25
ORDER BY name
SELECT name, email;
```

**Error Message:** `Error: near 'SELECT': syntax error`

**Why it happens:** SQL has a specific clause order that must be followed: **SELECT → FROM → WHERE → ORDER BY**. You cannot put SELECT after WHERE or ORDER BY.

**Corrected:**
```sql
SELECT name, email 
FROM users 
WHERE age > 25 
ORDER BY name;
```

💡 **Key Takeaway:** SQL clauses must appear in this order: SELECT → FROM → WHERE → ORDER BY. Not following this order causes syntax errors.

---

## Practice Challenge

**Select the names and emails of all users who are from Portland, sorted alphabetically by name.**

💡 **Hint:** You'll need SELECT, FROM, WHERE, and ORDER BY clauses in the correct order.

<details>
<summary>Click to see solution</summary>

```sql
SELECT name, email
FROM users
WHERE city = 'Portland'
ORDER BY name;
```

**Explanation:** This query selects specific columns, filters for Portland users, and sorts the results alphabetically by name.
</details>

---

*Content generated for SQL-Adapt Learning Platform*
