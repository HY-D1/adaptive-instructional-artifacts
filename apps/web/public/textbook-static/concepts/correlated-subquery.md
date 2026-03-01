# Correlated Subqueries

🔴 **Difficulty:** Advanced
⏱️ **Estimated Time:** 30 minutes

## Learning Objectives

- Understand how correlated subqueries differ from regular subqueries
- Write correlated subqueries that reference outer query columns
- Use EXISTS and NOT EXISTS effectively
- Recognize performance implications of correlated subqueries

## Prerequisites

Before learning this concept, you should understand:

- [select-basic](./select-basic.md)
- [subqueries](./subqueries.md)

## What is This?

A correlated subquery is a subquery that references columns from the outer query.

Unlike regular (non-correlated) subqueries that run once, a correlated subquery runs once for each row processed by the outer query—the inner query is "correlated" to the current row of the outer query. Use correlated subqueries when you need to compare each row against a value that depends on that row itself, such as finding users above their city's average age or products that outperform their category average. They solve "row-dependent" problems that regular subqueries cannot, enabling powerful comparisons like "above average for their group" that are essential for analytics.

## Examples

### Example 1: Finding Users Above Average (in their city)

**Difficulty:** Intermediate

**Scenario:** Find users whose age is above the average age of users in their city

```sql
SELECT u.name, u.city, u.age
FROM users u
WHERE u.age > (
    SELECT AVG(age) 
    FROM users 
    WHERE city = u.city  -- References outer query!
);
```

**Explanation:** For each user row, the subquery calculates the average age for that user's city. Only users above their city's average are returned. The subquery "correlates" to the outer row through `u.city`.

### Example 2: Finding Top Orders Per User with EXISTS

**Difficulty:** Advanced

**Scenario:** Find each user's most expensive order

```sql
SELECT u.name, o.id AS order_id, o.total_amount
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE NOT EXISTS (
    SELECT 1 
    FROM orders o2 
    WHERE o2.user_id = o.user_id 
      AND o2.total_amount > o.total_amount
);
```

**Explanation:** For each order, the subquery checks if any other order by the same user has a higher amount. If NOT EXISTS (no higher amount found), this is the user's most expensive order.

### Example 3: Products with Above-Average Price in Their Category

**Difficulty:** Advanced

**Scenario:** Find products whose price exceeds the average price of products in the same category

```sql
SELECT 
    p.name,
    p.category,
    p.price,
    (SELECT AVG(price) 
     FROM products 
     WHERE category = p.category) AS category_avg
FROM products p
WHERE p.price > (
    SELECT AVG(price) 
    FROM products 
    WHERE category = p.category
);
```

**Explanation:** This finds products where their price is higher than the average price of products in the same category. The subquery correlates to the outer product row through the category column.

## Common Mistakes

### Mistake 1: Using IN instead of EXISTS for existence checks

**Incorrect SQL:**
```sql
SELECT * FROM users u
WHERE u.id IN (
    SELECT o.user_id 
    FROM orders o 
    WHERE o.total_amount > 1000
);
```

**Why it happens:** While IN works, it can be slower with large datasets and doesn't clearly express "existence" intent.

**Better Approach:**
```sql
SELECT * FROM users u
WHERE EXISTS (
    SELECT 1 
    FROM orders o 
    WHERE o.user_id = u.id 
      AND o.total_amount > 1000
);
```

**Why it's better:** 
- EXISTS stops at the first match (more efficient)
- Better expresses the intent: "find users WHERE an order EXISTS"
- Handles NULL values more predictably

💡 **Key Takeaway:** Use EXISTS for "has any" checks; it's often faster and clearer than IN

### Mistake 2: Table alias confusion in correlated subqueries

**Incorrect SQL:**
```sql
SELECT name FROM users
WHERE age > (
    SELECT AVG(age) FROM users WHERE city = city
    -- ERROR: 'city' refers to inner users, not outer!
);
```

**Error:** The query compares each row's city to itself, not to the outer row's city.

**Corrected SQL:**
```sql
SELECT u1.name 
FROM users u1
WHERE u1.age > (
    SELECT AVG(u2.age) 
    FROM users u2 
    WHERE u2.city = u1.city  -- Explicitly reference outer table
);
```

💡 **Key Takeaway:** Always use table aliases in correlated subqueries to clearly distinguish inner and outer table references

## Practice Challenge

**Find users who have spent more than the average customer in their city.**

💡 **Hint:** Use a correlated subquery to calculate the average spending for each user's city, then compare their total to that average.

<details>
<summary>Click to see solution</summary>

```sql
SELECT u.name, u.city, SUM(o.total_amount) AS total_spent
FROM users u
JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.city
HAVING SUM(o.total_amount) > (
    SELECT AVG(customer_totals.total)
    FROM (
        SELECT SUM(o2.total_amount) AS total
        FROM users u2
        JOIN orders o2 ON u2.id = o2.user_id
        WHERE u2.city = u.city
        GROUP BY u2.id
    ) AS customer_totals
);
```

**Explanation:** For each user, the correlated subquery calculates the average spending of all customers in that user's city. The HAVING clause filters to show only users who spent more than that average.
</details>

## Related Practice Problems

- [problem-18](/practice/problem-18)
- [problem-19](/practice/problem-19)

---

*Content generated for SQL-Adapt Learning Platform*
