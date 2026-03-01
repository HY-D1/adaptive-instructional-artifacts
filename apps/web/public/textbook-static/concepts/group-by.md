# The GROUP BY Clause

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 20 minutes

## Learning Objectives

- Group rows by one or more columns
- Apply aggregate functions to groups
- Use HAVING to filter groups based on aggregate values
- Understand the execution order of GROUP BY and HAVING

## Prerequisites

Before learning this concept, you should understand:

- [select-basic](./select-basic.md)
- [aggregate-functions](./aggregate-functions.md)

## What is This?

GROUP BY organizes rows with the same values into summary rows for aggregate calculations.

It "collapses" multiple rows into single summary rows based on the grouping column(s), enabling you to summarize data by categories. Without GROUP BY, aggregate functions would collapse ALL rows into a single result. Use GROUP BY whenever you need category-based summaries—like counting users per city, calculating average order value per customer, or summing sales by product category.

## Examples

### Example 1: Count Users Per City

**Difficulty:** Beginner

**Scenario:** Count how many users live in each city

```sql
SELECT city, COUNT(*) AS user_count
FROM users
GROUP BY city;
```

**Explanation:** GROUP BY collapses all rows with the same city into one row. COUNT(*) counts how many rows were in each group.

**Expected Output:**

| city | user_count |
|------|------------|
| Seattle | 45 |
| Portland | 23 |
| San Francisco | 32 |

### Example 2: Average Order Value Per User

**Difficulty:** Intermediate

**Scenario:** Find the average order amount for each user who has placed orders

```sql
SELECT 
    u.name, 
    AVG(o.total_amount) AS avg_order_amount,
    COUNT(o.id) AS total_orders
FROM users u
JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name;
```

**Explanation:** Groups by user (id and name), then calculates average order amount and total order count per user.

### Example 3: Multiple Column Grouping

**Difficulty:** Intermediate

**Scenario:** Find total sales by city and status

```sql
SELECT 
    u.city,
    o.status,
    SUM(o.total_amount) AS total_sales,
    COUNT(*) AS order_count
FROM orders o
JOIN users u ON o.user_id = u.id
GROUP BY u.city, o.status;
```

**Explanation:** Groups by the combination of city and status, showing sales breakdown across both dimensions.

## Common Mistakes

### Mistake 1: Missing column in GROUP BY

**Incorrect SQL:**
```sql
SELECT city, age, COUNT(*) FROM users GROUP BY city;
```

**Error Message:** `Error: column 'age' must appear in GROUP BY clause`

**Why it happens:** When grouping, any non-aggregated column in SELECT must be in GROUP BY. The database doesn't know which age value to show for each city group.

**Corrected SQL:**
```sql
SELECT city, age, COUNT(*) FROM users GROUP BY city, age;
```

💡 **Key Takeaway:** Include all non-aggregated columns in GROUP BY

### Mistake 2: Using WHERE to filter aggregates

**Incorrect SQL:**
```sql
SELECT city, COUNT(*) AS user_count 
FROM users 
WHERE COUNT(*) > 5 
GROUP BY city;
```

**Error Message:** `Error: aggregate functions are not allowed in WHERE`

**Why it happens:** WHERE filters rows BEFORE grouping happens. At that point, aggregate values don't exist yet.

**Corrected SQL:**
```sql
SELECT city, COUNT(*) AS user_count 
FROM users 
GROUP BY city
HAVING COUNT(*) > 5;
```

💡 **Key Takeaway:** Use WHERE to filter rows, HAVING to filter groups

## Practice Challenge

**Find cities that have more than 2 users, ordered by user count.**

💡 **Hint:** Use GROUP BY with HAVING and ORDER BY.

<details>
<summary>Click to see solution</summary>

```sql
SELECT city, COUNT(*) as user_count
FROM users
GROUP BY city
HAVING COUNT(*) > 2
ORDER BY user_count DESC;
```

**Explanation:** GROUP BY groups users by city, HAVING filters groups with more than 2 users, and ORDER BY sorts the results.
</details>

## Related Practice Problems

- [problem-4](/practice/problem-4)
- [problem-13](/practice/problem-13)
- [problem-14](/practice/problem-14)

---

*Content generated for SQL-Adapt Learning Platform*
