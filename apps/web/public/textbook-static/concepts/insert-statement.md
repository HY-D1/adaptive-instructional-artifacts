# The INSERT Statement

🟢 **Difficulty:** Beginner  
⏱️ **Estimated Time:** 12 minutes

## Learning Objectives

- Add new rows to tables using INSERT INTO
- Insert data into specific columns
- Insert multiple rows in a single statement

## What is This?

The **INSERT statement** adds new rows to a database table.

It's one of the four basic CRUD operations (Create, Read, Update, Delete) for database manipulation. You can insert values for all columns or specify only certain columns to populate. Use INSERT when you need to add new data to your database—new user registrations, new orders, new products, etc.

## Examples

### Example 1: Inserting a Complete Row

**Difficulty:** Beginner

**Scenario:** Add a new user to the users table with all required information.

```sql
INSERT INTO users (id, name, email, age, city)
VALUES (101, 'Diana Prince', 'diana@example.com', 28, 'Themyscira');
```

**Explanation:** This inserts a single row with values for all specified columns. The column list is optional if you provide values for ALL columns in the correct order, but explicitly listing columns is safer and more maintainable.

### Example 2: Inserting into Specific Columns

**Difficulty:** Intermediate

**Scenario:** Create a new order for an existing user.

```sql
INSERT INTO orders (order_id, user_id, product, amount)
VALUES (1001, 1, 'Laptop', 999.99);
```

**Explanation:** When you list specific columns, you only provide values for those columns. Other columns will receive default values (NULL if no default is defined). Explicit column lists make your code more readable and protect against schema changes.

### Example 3: Inserting Multiple Rows

**Difficulty:** Intermediate

**Scenario:** Add multiple products to the catalog at once.

```sql
INSERT INTO products (id, name, category, price)
VALUES 
    (201, 'Wireless Mouse', 'Electronics', 29.99),
    (202, 'Mechanical Keyboard', 'Electronics', 89.99),
    (203, 'USB-C Cable', 'Accessories', 12.99);
```

**Explanation:** Multiple row inserts are more efficient than separate INSERT statements. All rows must have the same structure matching the column list. This is useful for bulk data loading.

## Common Mistakes

### Mistake 1: Violating Primary Key Constraints

**Incorrect:**
```sql
INSERT INTO users (id, name, email)
VALUES (1, 'Duplicate User', 'duplicate@example.com');
```

**Error Message:** `Error: UNIQUE constraint failed: users.id`

**Why it happens:** The id 1 already exists in the users table. Primary keys must be unique across all rows in the table.

**Corrected:**
```sql
-- Option 1: Use a new unique ID
INSERT INTO users (id, name, email)
VALUES (999, 'New User', 'newuser@example.com');

-- Option 2: First check if the ID exists
SELECT * FROM users WHERE id = 1;
-- If no results, then proceed with INSERT
```

💡 **Key Takeaway:** Always verify that primary key values are unique before inserting. Consider using auto-incrementing IDs if your schema supports them.

### Mistake 2: Mismatched Column Count and Value Count

**Incorrect:**
```sql
INSERT INTO products (name, category)
VALUES ('Laptop Stand', 'Accessories', 45.99);
```

**Error Message:** `Error: 2 columns supplied but 3 values were supplied`

**Why it happens:** The VALUES clause has 3 values, but only 2 columns were specified. The column list and value list must match in count and order.

**Corrected:**
```sql
-- Option 1: Add the missing column
INSERT INTO products (name, category, price)
VALUES ('Laptop Stand', 'Accessories', 45.99);

-- Option 2: Remove the extra value
INSERT INTO products (name, category)
VALUES ('Laptop Stand', 'Accessories');
```

💡 **Key Takeaway:** The number of columns in your column list must exactly match the number of values in your VALUES clause. Double-check your counts before executing.

---

## Practice Challenge

**Insert a new product with id 301, name 'Desk Lamp', category 'Furniture', and price 39.99.**

💡 **Hint:** Make sure to match your column list with your VALUES list in the same order.

<details>
<summary>Click to see solution</summary>

```sql
INSERT INTO products (id, name, category, price)
VALUES (301, 'Desk Lamp', 'Furniture', 39.99);
```

**Explanation:** This inserts a single row with all four values matching the four specified columns in order.
</details>

---

*Content generated for SQL-Adapt Learning Platform*
