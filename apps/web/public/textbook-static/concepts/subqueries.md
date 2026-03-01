# Subqueries

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 25 minutes

## Learning Objectives

- Write subqueries in SELECT, FROM, and WHERE clauses
- Understand correlated vs non-correlated subqueries
- Use EXISTS and IN operators with subqueries
- Know when to use subqueries vs joins

## Prerequisites

Before learning this concept, you should understand:

- [select-basic](./select-basic.md)
- [where-clause](./where-clause.md)

## What is This?

A subquery is a SELECT statement nested inside another SQL statement.

It can be used to retrieve data that will be used in the main query as a condition, a value, or a data source. Subqueries let you break complex problems into manageable steps, using the result of one query as input for another. You might use subqueries to find users who meet criteria based on their order history, or to filter based on aggregate values. Subqueries can return a single value (scalar), one row with multiple columns, or multiple rows and columns (table).

## Examples

### Example 1: Subquery in WHERE with IN

**Difficulty:** Beginner

**Scenario:** Find all users who have placed orders

```sql
SELECT name, email
FROM users
WHERE id IN (
    SELECT DISTINCT user_id 
    FROM orders
);
```

**Explanation:** The subquery returns all user_ids that appear in the orders table. The outer query finds users whose id is in that list.

### Example 2: Subquery in FROM (Derived Table)

**Difficulty:** Intermediate

**Scenario:** Find users whose average order value is above the overall average

```sql
SELECT u.name, user_stats.avg_order
FROM users u
JOIN (
    SELECT 
        user_id, 
        AVG(total_amount) AS avg_order
    FROM orders
    GROUP BY user_id
) AS user_stats ON u.id = user_stats.user_id
WHERE user_stats.avg_order > (
    SELECT AVG(total_amount) FROM orders
);
```

**Explanation:** The subquery in FROM creates a temporary table of user order statistics. We join it with users and filter where the average exceeds the global average (calculated by another subquery).

### Example 3: Subquery in SELECT (Scalar Subquery)

**Difficulty:** Intermediate

**Scenario:** List all products with their total sales amount

```sql
SELECT 
    p.name,
    p.price,
    (SELECT COALESCE(SUM(total_amount), 0)
     FROM orders o 
     WHERE o.product_id = p.id) AS total_sales
FROM products p;
```

**Explanation:** For each product, the scalar subquery calculates the sum of all order amounts for that product. COALESCE ensures we get 0 instead of NULL for products with no sales.

## Common Mistakes

### Mistake 1: Subquery returns multiple rows for single-row operator

**Incorrect SQL:**
```sql
SELECT * FROM users WHERE id = (SELECT user_id FROM orders);
```

**Error Message:** `Error: subquery returns more than one row`

**Why it happens:** The = operator expects a single value, but the subquery returns multiple rows (one for each order).

**Corrected SQL:**
```sql
-- Option 1: Use IN for multiple values
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders);

-- Option 2: Add LIMIT 1 if you only want one
SELECT * FROM users 
WHERE id = (SELECT user_id FROM orders ORDER BY total_amount DESC LIMIT 1);
```

💡 **Key Takeaway:** Use IN when the subquery may return multiple rows; use LIMIT 1 or aggregate functions to ensure single-row results

### Mistake 2: Using subqueries when JOIN is more efficient

**Incorrect Approach:**
```sql
SELECT name FROM users
WHERE id IN (SELECT user_id FROM orders WHERE total_amount > 100);
```

**Why it happens:** While this works, modern databases often optimize JOINs better than IN with subqueries for large datasets.

**Better Alternative:**
```sql
SELECT DISTINCT u.name 
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.total_amount > 100;
```

💡 **Key Takeaway:** For filtering based on related table data, JOINs are often more efficient than subqueries

## Practice Challenge

**Find users who have not placed any orders.**

💡 **Hint:** Use NOT EXISTS or NOT IN with a subquery.

<details>
<summary>Click to see solution</summary>

```sql
-- Using NOT EXISTS
SELECT * FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);

-- Alternative using NOT IN
SELECT * FROM users
WHERE id NOT IN (
    SELECT DISTINCT user_id FROM orders WHERE user_id IS NOT NULL
);

-- Alternative using LEFT JOIN
SELECT u.* 
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.id IS NULL;
```

**Explanation:** NOT EXISTS is often preferred as it handles NULL values gracefully and can be more efficient. The LEFT JOIN approach finds users with no matching orders.
</details>

## Related Practice Problems

- [problem-16](/practice/problem-16)
- [problem-17](/practice/problem-17)
- [problem-18](/practice/problem-18)

---

*Content generated for SQL-Adapt Learning Platform*
