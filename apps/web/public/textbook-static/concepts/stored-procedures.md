# Stored Procedures and Functions

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 20 minutes

## Learning Objectives

- Understand what stored procedures are and when to use them
- Learn how to create and call stored procedures
- Know the difference between procedures and functions
- Understand the benefits of code reuse and security

## What is This?

**Stored procedures** are precompiled SQL statements stored in the database that can be executed repeatedly by calling them with parameters.

They allow you to encapsulate business logic directly in the database, improving performance by reducing network traffic (you send just the procedure name and parameters instead of full SQL statements) and enhancing security by controlling data access. **Functions** differ from procedures in that they must return a single value and can be used within SQL expressions like SELECT or WHERE clauses. You use stored procedures when multiple applications need the same complex logic, when you want to enforce consistent data access rules across different clients, or when you need to hide the underlying table structure from applications for security reasons.

**Note:** The sql.js environment used in this learning platform has limited stored procedure support. The examples below use standard SQL syntax compatible with MySQL and PostgreSQL, but are shown for educational purposes.

## Examples

### Example 1: Creating a Simple Stored Procedure

**Difficulty:** Beginner

**Scenario:** Create a procedure to get all orders for a specific user by their ID.

```sql
-- In MySQL/PostgreSQL syntax (conceptual)
-- Note: sql.js has limited procedure support, this shows standard SQL

-- Create a procedure to get user orders
CREATE PROCEDURE GetUserOrders(IN userId INT)
BEGIN
    SELECT 
        o.id AS order_id,
        o.order_date,
        o.total_amount,
        u.name AS customer_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.user_id = userId
    ORDER BY o.order_date DESC;
END;

-- Call the procedure
CALL GetUserOrders(1);
```

**Explanation:** This procedure encapsulates the logic for fetching a user's orders with their name. The `IN` parameter `userId` is passed when calling the procedure. Using procedures means applications don't need to send the full SQL query over the network each time—just the `CALL` statement with the parameter.

---

### Example 2: Procedure with Output Parameters

**Difficulty:** Intermediate

**Scenario:** Create a procedure to calculate summary statistics for a user's orders.

```sql
-- Create a procedure with OUT parameters (MySQL syntax)
CREATE PROCEDURE GetUserOrderStats(
    IN userId INT,
    OUT totalSpent DECIMAL(10,2),
    OUT orderCount INT,
    OUT avgOrderValue DECIMAL(10,2)
)
BEGIN
    -- Calculate total spent
    SELECT COALESCE(SUM(total_amount), 0)
    INTO totalSpent
    FROM orders
    WHERE user_id = userId;
    
    -- Count orders
    SELECT COUNT(*)
    INTO orderCount
    FROM orders
    WHERE user_id = userId;
    
    -- Calculate average
    SET avgOrderValue = CASE 
        WHEN orderCount > 0 THEN totalSpent / orderCount 
        ELSE 0 
    END;
END;

-- Call with output parameters
CALL GetUserOrderStats(1, @total, @count, @average);

-- View the results
SELECT @total AS total_spent, @count AS order_count, @average AS avg_order;
```

**Explanation:** This procedure uses `OUT` parameters to return multiple calculated values. The `INTO` clause stores query results into variables. This pattern is useful for dashboards or reports where you need multiple aggregate values without making separate queries.

**Note:** Variable syntax (`@variable`) and OUT parameters vary by database. The above is MySQL-style.

---

### Example 3: User-Defined Function for Reusable Logic

**Difficulty:** Intermediate

**Scenario:** Create a function to calculate a discount based on user age and order value.

```sql
-- Create a function to calculate discount (MySQL syntax)
CREATE FUNCTION CalculateDiscount(
    userAge INT,
    orderTotal DECIMAL(10,2)
) RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE discountRate DECIMAL(4,2);
    
    -- Determine discount rate based on age and order size
    SET discountRate = CASE
        WHEN userAge >= 65 AND orderTotal > 100 THEN 0.20
        WHEN userAge >= 65 THEN 0.15
        WHEN orderTotal > 200 THEN 0.10
        WHEN orderTotal > 100 THEN 0.05
        ELSE 0.00
    END;
    
    RETURN orderTotal * discountRate;
END;

-- Use the function in a query
SELECT 
    o.id AS order_id,
    u.name,
    u.age,
    o.total_amount,
    CalculateDiscount(u.age, o.total_amount) AS discount_amount,
    o.total_amount - CalculateDiscount(u.age, o.total_amount) AS final_amount
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.total_amount > 50;
```

**Explanation:** Functions differ from procedures in that they return a single value and can be used directly in SQL expressions (like in SELECT, WHERE, or HAVING clauses). This function calculates a tiered discount based on customer age and order size. The `DETERMINISTIC` keyword tells the database the function returns the same result for the same inputs, allowing query optimization.

## Common Mistakes

### Mistake 1: Calling a Procedure Like a Function

**Incorrect:**
```sql
-- Trying to use a procedure in a SELECT statement
SELECT GetUserOrders(1);

-- Or trying to use CALL in a query
SELECT * FROM CALL GetUserOrders(1);
```

**Error Message:** `Error: near "GetUserOrders": syntax error` or `Error: no such function: GetUserOrders`

**Why it happens:** Procedures and functions have different use cases. Procedures are standalone executable blocks called with `CALL`, while functions return values and can be embedded in expressions. Beginners often confuse the two and try to use procedures where functions are needed (or vice versa).

**Corrected:**
```sql
-- Call the procedure correctly (standalone statement)
CALL GetUserOrders(1);

-- OR use a function if you need it in a SELECT
-- (would need to define GetUserOrders as a FUNCTION instead)
```

💡 **Key Takeaway:** Use **procedures** for standalone operations with multiple statements or no return value. Use **functions** when you need to return a single value that will be used inside a SQL expression.

---

### Mistake 2: Mismatched Parameter Types or Missing Delimiter Changes

**Incorrect:**
```sql
-- Trying to create without changing delimiter (in MySQL)
CREATE PROCEDURE SimpleProc()
BEGIN
    SELECT * FROM users;
END;

-- Calling with wrong parameter type
CALL GetUserOrders('abc');
```

**Error Message:** `Error: You have an error in your SQL syntax near 'END'` or `Error: Incorrect integer value: 'abc' for column 'userId' at row 1`

**Why it happens:** In MySQL, semicolons inside the procedure body conflict with the statement terminator. You need to temporarily change the delimiter (e.g., to `//` or `$$`) while defining the procedure. Also, passing a string where an integer is expected causes type mismatch errors.

**Corrected:**
```sql
-- Change delimiter first (MySQL specific)
DELIMITER //

CREATE PROCEDURE SimpleProc()
BEGIN
    SELECT * FROM users;
END //

-- Change delimiter back
DELIMITER ;

-- Call with correct parameter type
CALL GetUserOrders(1);
```

💡 **Key Takeaway:** When creating stored procedures in MySQL, always change the delimiter first to avoid conflicts with semicolons inside the procedure body. Also ensure parameter types match between the definition and the call.

---

### Mistake 3: Not Handling NULL Values in Functions

**Incorrect:**
```sql
CREATE FUNCTION GetUserAge(userId INT) RETURNS INT
BEGIN
    DECLARE userAge INT;
    SELECT age INTO userAge FROM users WHERE id = userId;
    RETURN userAge * 2; -- Will return NULL if userAge is NULL
END;

-- This will return NULL unexpectedly if user doesn't exist
SELECT GetUserAge(9999);
```

**Error Message:** No error, but returns NULL which can cause unexpected behavior in calculations.

**Why it happens:** If the SELECT returns no rows (user doesn't exist), the variable remains NULL. Operations on NULL return NULL, which can cascade through your application logic unexpectedly. The function silently returns NULL instead of raising an error or returning a default value.

**Corrected:**
```sql
CREATE FUNCTION GetUserAge(userId INT) RETURNS INT
BEGIN
    DECLARE userAge INT DEFAULT 0;
    SELECT age INTO userAge FROM users WHERE id = userId;
    
    -- Handle case where user not found
    IF userAge IS NULL THEN
        RETURN -1; -- Or SIGNAL SQLSTATE for error
    END IF;
    
    RETURN userAge * 2;
END;

-- Now you can check for the error condition
SELECT 
    CASE 
        WHEN GetUserAge(9999) = -1 THEN 'User not found'
        ELSE CAST(GetUserAge(9999) AS TEXT)
    END AS result;
```

💡 **Key Takeaway:** Always provide DEFAULT values for variables in stored procedures and handle NULL cases explicitly. Use conditional logic (IF/THEN/ELSE or CASE) to handle edge cases like missing records.

---

*Content generated for SQL-Adapt Learning Platform*
