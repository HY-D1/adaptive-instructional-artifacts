# Introduction to Relational Databases

🟢 **Difficulty:** Beginner  
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand what tables, rows, and columns represent in a database
- Learn about primary keys and foreign keys and their roles
- Grasp the concept of relationships between tables
- Understand how data is organized in a relational model

## What is This?

A relational database organizes data into tables that relate to each other through shared information.

Each table represents one type of entity (like users, orders, or products) and consists of rows (individual records) and columns (attributes). Relationships between tables are created using keys—primary keys uniquely identify rows, while foreign keys link tables together—allowing you to connect data across multiple tables without duplication. Use a relational database whenever you have structured data with relationships between entities. Relational databases prevent data duplication, ensure data integrity, and allow you to answer complex questions by combining data from multiple tables.

## Examples

### Example 1: Understanding Table Structure

**Difficulty:** Beginner

**Scenario:** You want to see the structure of your database - what tables exist and what columns they have.

```sql
-- View all tables in the database
SELECT name FROM sqlite_master WHERE type='table';

-- View the structure (columns) of the users table
PRAGMA table_info(users);
```

**Explanation:** 
- A **table** is a collection of related data organized in rows and columns (like `users`, `orders`, `products`)
- **Columns** define the attributes: `id`, `name`, `email`, `age` in the `users` table
- **Rows** are individual records: each user is one row
- `PRAGMA table_info()` shows column names, data types, and which column is the primary key

The `users` table might look like this:

| id (PK) | name | email | age | city |
|---------|------|-------|-----|------|
| 1 | Alice | alice@email.com | 25 | Seattle |
| 2 | Bob | bob@email.com | 30 | Portland |

### Example 2: Primary Keys - Unique Identifiers

**Difficulty:** Beginner

**Scenario:** Retrieve a specific user's information using their unique identifier.

```sql
SELECT * FROM users WHERE id = 1;
```

**Explanation:** 
- A **Primary Key (PK)** is a column (or combination of columns) that uniquely identifies each row
- In the `users` table, `id` is the primary key - no two users can have the same ID
- Primary keys cannot contain NULL values
- They ensure data integrity and enable fast lookups

The `orders` table also has a primary key (`id`), plus a foreign key (`user_id`) that links to the `users` table:

| id (PK) | user_id (FK) | order_date | total_amount |
|---------|--------------|------------|--------------|
| 101 | 1 | 2024-01-15 | 150.00 |
| 102 | 1 | 2024-01-20 | 89.50 |
| 103 | 2 | 2024-01-18 | 245.00 |

### Example 3: Foreign Keys and Relationships

**Difficulty:** Intermediate

**Scenario:** Find all orders placed by a specific user by connecting the `users` and `orders` tables.

```sql
SELECT 
    u.name AS customer_name,
    o.id AS order_id,
    o.order_date,
    o.total_amount
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE u.name = 'Alice';
```

**Explanation:**
- A **Foreign Key (FK)** is a column that creates a link between two tables
- In the `orders` table, `user_id` is a foreign key that references `users.id`
- This establishes a **one-to-many relationship**: one user can have many orders
- The `JOIN` clause uses this relationship to combine data from both tables
- Foreign keys maintain **referential integrity** - you can't create an order for a user that doesn't exist

## Common Mistakes

### Mistake 1: Not Understanding the Relationship Direction

**Incorrect:**
```sql
SELECT * FROM users u JOIN orders o ON o.id = u.order_id;
```

**Error Message:** `Error: no such column: u.order_id` or query returns no results

**Why it happens:** The relationship direction is wrong. Users don't have an `order_id` column - orders have a `user_id` column that points to users. You must join on the foreign key in the child table (orders) to the primary key in the parent table (users).

**Corrected:**
```sql
SELECT * FROM users u JOIN orders o ON u.id = o.user_id;
```

💡 **Key Takeaway:** Foreign keys always exist in the "many" side of a one-to-many relationship. Orders belong to users, so the `user_id` foreign key is in the `orders` table, not the other way around.

### Mistake 2: Assuming Column Names Are the Same Across Tables

**Incorrect:**
```sql
SELECT * FROM users JOIN orders ON users.id = orders.id;
```

**Error Message:** Query runs but returns wrong data or empty results

**Why it happens:** This joins `users.id` (user ID) with `orders.id` (order ID), which are completely different things. The correct column to join is `orders.user_id`, not `orders.id`.

**Corrected:**
```sql
SELECT * FROM users JOIN orders ON users.id = orders.user_id;
```

💡 **Key Takeaway:** Primary keys in different tables are independent. Always check which column in the related table is the foreign key (it usually has a descriptive name like `user_id`, `customer_id`, `product_id`).

### Mistake 3: Duplicate Data from Missing Join Conditions

**Incorrect:**
```sql
SELECT users.name, products.name 
FROM users, orders, products;
```

**Error Message:** No syntax error, but returns a Cartesian product (every user paired with every product)

**Why it happens:** Without JOIN conditions, SQL combines every row from every table, creating a massive result with incorrect combinations. For 3 users and 4 products, you'd get 12 rows of meaningless combinations.

**Corrected:**
```sql
SELECT u.name AS customer, p.name AS product
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN products p ON o.product_id = p.id;
```

💡 **Key Takeaway:** Always specify how tables relate to each other using ON clauses. The foreign key relationships define which rows should be paired together.

---

*Content generated for SQL-Adapt Learning Platform*
