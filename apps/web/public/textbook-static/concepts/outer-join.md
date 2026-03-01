# Outer Joins

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 20 minutes

## Learning Objectives

- Understand the difference between LEFT JOIN, RIGHT JOIN, and FULL OUTER JOIN
- Know when to use outer joins vs inner joins
- Handle NULL values from unmatched rows

## What is This?

Outer joins return all rows from one or both tables, even when there's no match in the other table.

Unlike INNER JOIN which only returns matching rows, outer joins preserve rows from the specified side(s) and fill in NULL for missing matches. Use OUTER JOIN when you need to see ALL rows from one table regardless of matches—such as showing all users including those who haven't placed orders, or finding customers without any activity. OUTER JOINs are essential for data completeness and finding gaps, helping you answer questions like "Which customers haven't made a purchase?" that INNER JOINs would miss entirely.

## Examples

### Example 1: LEFT JOIN - All Users With or Without Orders

**Difficulty:** Beginner

**Scenario:** List all users and their orders, including users who haven't placed any orders.

```sql
SELECT 
    u.name,
    u.email,
    o.id AS order_id,
    o.total_amount
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
ORDER BY u.name;
```

**Explanation:** 
- `LEFT JOIN` keeps ALL rows from the left table (users)
- Users without orders will have NULL for order_id and total_amount
- This ensures you don't miss users who haven't purchased yet

### Example 2: Finding Users Without Orders

**Difficulty:** Intermediate

**Scenario:** Find users who have never placed an order.

```sql
SELECT 
    u.name,
    u.email,
    u.city
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.id IS NULL;
```

**Explanation:** By filtering for `o.id IS NULL`, we find only users who have no matching orders. This is a common pattern for finding "orphaned" or unmatched records.

### Example 3: RIGHT JOIN Example

**Difficulty:** Intermediate

**Scenario:** List all orders with user information, including any orphaned orders (if user was deleted).

```sql
SELECT 
    o.id AS order_id,
    o.total_amount,
    o.order_date,
    u.name AS customer_name,
    u.email
FROM users u
RIGHT JOIN orders o ON u.id = o.user_id
ORDER BY o.order_date DESC;
```

**Explanation:** `RIGHT JOIN` keeps ALL rows from the right table (orders). If an order's user was deleted, customer_name and email will be NULL, but the order will still appear.

## Common Mistakes

### Mistake 1: Filtering in WHERE clause defeats the outer join

**Incorrect:**
```sql
SELECT u.name, o.total_amount
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.total_amount > 100;
```

**Result:** Users with no orders or smaller orders disappear - acts like an INNER JOIN!

**Why it happens:** The WHERE filter removes rows where o.total_amount is NULL (users without orders).

**Corrected:**
```sql
SELECT u.name, o.total_amount
FROM users u
LEFT JOIN orders o ON u.id = o.user_id AND o.total_amount > 100;
```

💡 **Key Takeaway:** To filter the joined table while preserving outer join behavior, put conditions in the ON clause, not the WHERE clause.

### Mistake 2: Using the wrong join direction

**Incorrect:**
```sql
-- Trying to find all orders with user info
SELECT o.id, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE u.name IS NULL;
```

**Why it happens:** LEFT JOIN from orders keeps all orders. Filtering for NULL user names finds orders without valid users, which is the opposite of what's typically wanted.

**Corrected:**
```sql
-- Find orders that have valid users
SELECT o.id, u.name
FROM orders o
JOIN users u ON o.user_id = u.id;

-- Or if you want all users and their orders
SELECT u.name, o.id
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;
```

💡 **Key Takeaway:** Choose the table direction carefully. LEFT JOIN keeps all from the LEFT table. If you want all from the right table, use RIGHT JOIN or swap the table order.

---

*Content generated for SQL-Adapt Learning Platform*
