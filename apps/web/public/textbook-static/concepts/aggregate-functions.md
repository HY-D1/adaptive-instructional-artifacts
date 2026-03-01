# Aggregate Functions

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 20 minutes

## Learning Objectives

- Use COUNT, SUM, AVG, MAX, MIN for calculations on groups of data
- Understand the difference between COUNT(*) and COUNT(column)
- Combine aggregates with GROUP BY for summary statistics

## What is This?

Aggregate functions perform calculations on a set of values and return a single result.

They collapse many rows into a single value, computing totals, averages, counts, or extreme values. You use aggregates when you need statistics about your data—like total sales, average order value, or highest price—rather than individual records. Common aggregate functions include COUNT(), SUM(), AVG(), MAX(), and MIN(). Aggregates transform raw data into meaningful insights, letting you answer business questions without manually processing every row.

## Examples

### Example 1: Counting Records

**Difficulty:** Beginner

**Scenario:** Find the total number of users in the database.

```sql
SELECT COUNT(*) AS total_users FROM users;
```

**Explanation:** 
- `COUNT(*)` counts all rows in the table
- `COUNT(column)` counts only non-NULL values in that column
- Always returns a single number as the result

### Example 2: Calculating Statistics with GROUP BY

**Difficulty:** Intermediate

**Scenario:** Find the total order amount and average order value for each user.

```sql
SELECT 
    u.name,
    COUNT(o.id) AS order_count,
    SUM(o.total_amount) AS total_spent,
    AVG(o.total_amount) AS avg_order_value,
    MAX(o.total_amount) AS largest_order,
    MIN(o.total_amount) AS smallest_order
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name;
```

**Explanation:** 
- `COUNT(o.id)` counts orders per user
- `SUM()` adds up all order amounts
- `AVG()` calculates the mean order value
- `MAX()` and `MIN()` find the largest and smallest orders
- `GROUP BY` groups the results by user

### Example 3: Combining Multiple Aggregates

**Difficulty:** Intermediate

**Scenario:** Get summary statistics about products in each category.

```sql
SELECT 
    category,
    COUNT(*) AS product_count,
    AVG(price) AS avg_price,
    SUM(stock_quantity) AS total_stock,
    MAX(price) AS highest_price
FROM products
GROUP BY category
HAVING COUNT(*) > 2;
```

**Explanation:** This combines multiple aggregate functions to create a comprehensive product report. The `HAVING` clause filters to only show categories with more than 2 products.

## Common Mistakes

### Mistake 1: Mixing aggregate and non-aggregate columns without GROUP BY

**Incorrect:**
```sql
SELECT name, COUNT(*) FROM users;
```

**Error Message:** `Error: misuse of aggregate function COUNT()`

**Why it happens:** When using aggregates, non-aggregate columns must be in a GROUP BY clause. The database doesn't know which name to show when counting all users.

**Corrected:**
```sql
SELECT city, COUNT(*) FROM users GROUP BY city;
```

💡 **Key Takeaway:** All non-aggregated columns in your SELECT must appear in the GROUP BY clause.

### Mistake 2: Using WHERE to filter aggregate results

**Incorrect:**
```sql
SELECT city, COUNT(*) FROM users WHERE COUNT(*) > 2 GROUP BY city;
```

**Error Message:** `Error: misuse of aggregate: COUNT()`

**Why it happens:** WHERE filters rows BEFORE aggregation happens. You cannot use aggregate functions in WHERE clauses.

**Corrected:**
```sql
SELECT city, COUNT(*) 
FROM users 
GROUP BY city 
HAVING COUNT(*) > 2;
```

💡 **Key Takeaway:** Use WHERE to filter individual rows before grouping, and HAVING to filter groups after aggregation.

---

*Content generated for SQL-Adapt Learning Platform*
