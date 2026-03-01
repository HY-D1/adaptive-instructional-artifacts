# Views

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 20 minutes

## Learning Objectives

- Create virtual tables using CREATE VIEW
- Simplify complex queries with views
- Understand when and why to use views

## What is This?

A view is a virtual table based on the result of a SQL query.

It doesn't store data itself but provides a saved query that can be referenced like a table. Views simplify complex queries, restrict access to specific data, and ensure consistent reporting. Use views when you have complex queries that are used repeatedly, when you want to restrict access to certain columns, or when you need to present data in a simplified, business-friendly format. Views act as an abstraction layer between your tables and your applications, letting you change underlying table structures without breaking existing queries.

## Examples

### Example 1: Creating a Simple View

**Difficulty:** Beginner

**Scenario:** Create a view that shows user order summaries without writing the join every time.

```sql
CREATE VIEW user_order_summary AS
SELECT 
    u.id AS user_id,
    u.name,
    u.email,
    COUNT(o.id) AS total_orders,
    COALESCE(SUM(o.total_amount), 0) AS lifetime_value
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.email;
```

**Usage:**
```sql
SELECT * FROM user_order_summary WHERE lifetime_value > 500;
```

**Explanation:** The view encapsulates the complex join and aggregation. Users can query it like a regular table without knowing the underlying structure.

### Example 2: Creating a View for Active Orders

**Difficulty:** Intermediate

**Scenario:** Create a view that shows only pending orders with user details.

```sql
CREATE VIEW pending_orders_detail AS
SELECT 
    o.id AS order_id,
    o.order_date,
    o.total_amount,
    u.name AS customer_name,
    u.email
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'pending';
```

**Usage:**
```sql
SELECT customer_name, order_id, total_amount 
FROM pending_orders_detail 
ORDER BY order_date;
```

**Explanation:** This view provides a convenient way to see pending orders with all relevant details pre-joined.

### Example 3: Creating a View with Calculated Columns

**Difficulty:** Intermediate

**Scenario:** Create a view that categorizes customers by their spending level.

```sql
CREATE VIEW customer_segments AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.city,
    COUNT(o.id) AS order_count,
    COALESCE(SUM(o.total_amount), 0) AS total_spent,
    CASE 
        WHEN SUM(o.total_amount) > 1000 THEN 'VIP'
        WHEN SUM(o.total_amount) > 500 THEN 'Regular'
        WHEN COUNT(o.id) > 0 THEN 'Occasional'
        ELSE 'Prospect'
    END AS segment
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.email, u.city;
```

**Usage:**
```sql
SELECT segment, COUNT(*) AS customer_count 
FROM customer_segments 
GROUP BY segment;
```

**Explanation:** Views can include complex logic like CASE statements, making them powerful for creating reusable, business-logic-enriched datasets.

## Common Mistakes

### Mistake 1: Forgetting that views don't store data

**Incorrect Understanding:**
```sql
CREATE VIEW current_inventory AS
SELECT name, stock_quantity FROM products WHERE stock_quantity > 0;

-- Later, thinking the view has snapshot data
SELECT * FROM current_inventory; -- Expecting old data
```

**Issue:** Views execute their underlying query each time they're accessed. They always return current data, not a snapshot from when the view was created.

**Corrected Understanding:**
```sql
-- The view always shows current state
SELECT * FROM current_inventory; -- Always reflects current products table

-- For a snapshot, use a table instead
CREATE TABLE inventory_snapshot AS 
SELECT name, stock_quantity FROM products WHERE stock_quantity > 0;
```

💡 **Key Takeaway:** Views are dynamic - they always reflect the current state of underlying tables. They don't cache or store data.

### Mistake 2: Creating overly complex views that hurt performance

**Incorrect:**
```sql
CREATE VIEW massive_report AS
SELECT 
    u.*, o.*, p.*,  -- Selecting all columns from multiple tables
    (SELECT COUNT(*) FROM orders o2 WHERE o2.user_id = u.id) AS order_count,
    (SELECT AVG(total_amount) FROM orders o3 WHERE o3.user_id = u.id) AS avg_order
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
LEFT JOIN products p ON o.product_id = p.id;
```

**Issue:** This view has correlated subqueries (which run once per row), unnecessary column selection, and complex joins. It will be very slow on large datasets.

**Corrected:**
```sql
-- Create focused views for specific use cases
CREATE VIEW user_metrics AS
SELECT 
    u.id, u.name, u.email,
    COUNT(o.id) AS order_count,
    AVG(o.total_amount) AS avg_order
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.email;
```

💡 **Key Takeaway:** Keep views focused and efficient. Avoid correlated subqueries and selecting unnecessary columns. Test performance on realistic data sizes.

---

*Content generated for SQL-Adapt Learning Platform*
