# Inner Joins

🟢 **Difficulty:** Beginner
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand how INNER JOIN combines rows from two tables
- Learn to write proper JOIN syntax with ON clause
- Identify common JOIN mistakes

## Prerequisites

Before learning this concept, you should understand:

- [select-basic](./select-basic.md)
- [joins](./joins.md)

## What is This?

An INNER JOIN combines rows from two tables where there is a match based on a specified condition.

Only rows that satisfy the join condition appear in the result—if a row in one table has no matching row in the other table, it is excluded. Use INNER JOIN when you only want rows that exist in BOTH tables, such as showing orders with their customer details while excluding orphaned orders or customers without orders. INNER JOIN helps you work with related data across tables efficiently without duplicating data in your tables.

### Visual Diagram

```
users (LEFT)    INNER JOIN    orders (RIGHT)
    +----+------+                  +----------+--------+
    |  1 |Alice |<---------------->| order_id |user_id |
    |  2 |Bob   |<---------------->|   101    |   1    |
    |  3 |Carol |   (no match)     |   102    |   1    |
    +----+------+                  +----------+--------+
    Result: Only rows with matches in BOTH tables
```

## Examples

### Example 1: Basic INNER JOIN

**Difficulty:** Beginner

**Scenario:** Get user names with their order IDs

```sql
SELECT users.name, orders.id
FROM users
INNER JOIN orders ON users.id = orders.user_id;
```

**Explanation:** This query joins the users and orders tables, returning only users who have placed at least one order. The ON clause specifies that rows match when users.id equals orders.user_id.

**Expected Output:**

| name | id |
| --- | --- |
| Alice | 101 |
| Alice | 102 |

### Example 2: JOIN with multiple columns

**Difficulty:** Beginner

**Scenario:** Get detailed order information with user details

```sql
SELECT users.name, users.email, orders.id, orders.total_amount
FROM users
INNER JOIN orders ON users.id = orders.user_id
WHERE orders.total_amount > 100;
```

**Explanation:** This query joins users with their orders and filters for orders with a total_amount greater than 100.

### Example 3: JOINing Three Tables

**Difficulty:** Intermediate

**Scenario:** Get complete order details including product information

```sql
SELECT 
    u.name AS customer,
    o.id AS order_id,
    p.name AS product,
    o.total_amount
FROM users u
INNER JOIN orders o ON u.id = o.user_id
INNER JOIN products p ON o.product_id = p.id;
```

**Explanation:** This demonstrates chaining JOINs to combine data from three related tables - users, orders, and products.

## Common Mistakes

### Mistake 1: Missing ON clause

**Incorrect SQL:**
```sql
SELECT * FROM users INNER JOIN orders;
```

**Error Message:** `Error: a JOIN clause is required before ON`

**Why it happens:** INNER JOIN requires an ON clause to specify how the tables relate to each other. Without it, the database doesn't know which columns to match.

**Corrected SQL:**
```sql
SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id;
```

💡 **Key Takeaway:** Always include an ON clause with your JOINs

### Mistake 2: Wrong join condition

**Incorrect SQL:**
```sql
SELECT users.name, orders.id
FROM users
INNER JOIN orders ON users.id = orders.id;
```

**Error/Result:** Returns empty results or incorrect matches

**Why it happens:** The join condition uses the wrong columns. Here we're comparing users.id with orders.id, but the foreign key in orders is user_id, not id.

**Corrected SQL:**
```sql
SELECT users.name, orders.id
FROM users
INNER JOIN orders ON users.id = orders.user_id;
```

💡 **Key Takeaway:** Verify you're joining on the correct columns - foreign keys should match primary keys in the related table

## Practice Challenge

**Get all users who have placed orders, showing the user's name and the order total.**

💡 **Hint:** You'll need to JOIN users and orders on the correct columns.

<details>
<summary>Click to see solution</summary>

```sql
SELECT users.name, orders.total_amount
FROM users
INNER JOIN orders ON users.id = orders.user_id;
```

**Explanation:** This query joins the users table with the orders table where the user's ID matches the order's user_id, returning only users who have placed orders along with their order totals.
</details>

## Related Practice Problems

- [problem-3](/practice/problem-3)
- [problem-8](/practice/problem-8)

---

*Content generated for SQL-Adapt Learning Platform*
