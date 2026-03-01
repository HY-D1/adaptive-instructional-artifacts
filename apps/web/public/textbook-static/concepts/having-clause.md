# The HAVING Clause

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand when to use HAVING vs WHERE
- Filter grouped data based on aggregate conditions
- Combine HAVING with GROUP BY for powerful summaries

## What is This?

The HAVING clause filters groups of rows after aggregation has been applied.

Unlike WHERE which filters individual rows before grouping, HAVING allows you to filter based on aggregate function results like COUNT, SUM, or AVG. Use HAVING when you need to filter based on aggregated values—such as showing only cities with more than 10 users, or customers who've spent over $1000. Without HAVING, you'd have to retrieve all grouped data and filter it in your application code, but HAVING lets the database do this work efficiently.

## Examples

### Example 1: Filtering Groups by Count

**Difficulty:** Beginner

**Scenario:** Find cities that have more than 3 users.

```sql
SELECT city, COUNT(*) AS user_count
FROM users
GROUP BY city
HAVING COUNT(*) > 3;
```

**Explanation:** 
- `GROUP BY city` groups users by their city
- `COUNT(*)` counts users in each city
- `HAVING COUNT(*) > 3` keeps only cities with more than 3 users
- Without HAVING, you'd see all cities including those with few users

### Example 2: Filtering by Average Value

**Difficulty:** Intermediate

**Scenario:** Find users who have made orders with an average amount greater than $100.

```sql
SELECT 
    u.name,
    COUNT(o.id) AS order_count,
    AVG(o.total_amount) AS avg_amount
FROM users u
JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name
HAVING AVG(o.total_amount) > 100;
```

**Explanation:** This query identifies high-value customers by calculating their average order amount and filtering for those above $100.

### Example 3: Multiple Conditions in HAVING

**Difficulty:** Intermediate

**Scenario:** Find product categories with high total stock and average price above $50.

```sql
SELECT 
    category,
    COUNT(*) AS product_count,
    SUM(stock_quantity) AS total_stock,
    AVG(price) AS avg_price
FROM products
GROUP BY category
HAVING SUM(stock_quantity) > 100 
   AND AVG(price) > 50;
```

**Explanation:** HAVING can include multiple conditions combined with AND/OR. This finds well-stocked, higher-priced categories.

## Common Mistakes

### Mistake 1: Using WHERE instead of HAVING for aggregate conditions

**Incorrect:**
```sql
SELECT city, COUNT(*) 
FROM users 
WHERE COUNT(*) > 2 
GROUP BY city;
```

**Error Message:** `Error: misuse of aggregate: COUNT()`

**Why it happens:** WHERE executes before GROUP BY and aggregation. At that point, COUNT(*) hasn't been calculated yet, so it can't be used in WHERE.

**Corrected:**
```sql
SELECT city, COUNT(*) 
FROM users 
GROUP BY city 
HAVING COUNT(*) > 2;
```

💡 **Key Takeaway:** Use WHERE for filtering individual rows before grouping; use HAVING for filtering groups based on aggregate values.

### Mistake 2: Trying to use column aliases in HAVING

**Incorrect:**
```sql
SELECT city, COUNT(*) AS city_count
FROM users
GROUP BY city
HAVING city_count > 2;
```

**Error Message:** `Error: no such column: city_count`

**Why it happens:** HAVING is evaluated before the SELECT list generates column aliases. The alias doesn't exist yet when HAVING runs.

**Corrected:**
```sql
SELECT city, COUNT(*) AS city_count
FROM users
GROUP BY city
HAVING COUNT(*) > 2;
```

💡 **Key Takeaway:** In HAVING clauses, always use the full aggregate expression (like COUNT(*)) rather than the column alias.

---

*Content generated for SQL-Adapt Learning Platform*
