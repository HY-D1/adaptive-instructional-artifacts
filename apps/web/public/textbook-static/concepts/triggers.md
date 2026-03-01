# Triggers and Events

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 25 minutes

## Learning Objectives

- Understand what database triggers are and when to use them
- Learn the different trigger timing options (BEFORE, AFTER, INSTEAD OF)
- Know how to create triggers for data validation and auditing
- Understand the difference between row-level and statement-level triggers

## What is This?

**Triggers** are database objects that automatically execute in response to specific data modification events (INSERT, UPDATE, DELETE) on a table.

They enable automated enforcement of business rules, data validation, and audit logging without requiring application-level code. When a specified event occurs on a table, the trigger fires and executes its defined SQL statements—such as logging changes to an audit table, validating data before it's committed, or cascading updates to related tables. **Events** are similar but run at scheduled times or intervals rather than in response to data changes. You use triggers when you need to enforce rules consistently regardless of which application accesses the database, when you want to maintain automatic audit trails of who changed what and when, or when you need to keep related data synchronized across multiple tables.

**Note:** The sql.js environment used in this platform supports SQLite-style triggers. Some advanced trigger features (like INSTEAD OF on tables) may not be available.

## Examples

### Example 1: Audit Trail Trigger

**Difficulty:** Beginner

**Scenario:** Automatically log all changes to the orders table for auditing purposes.

```sql
-- First, create an audit table to store changes
CREATE TABLE orders_audit (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    action_type TEXT, -- 'INSERT', 'UPDATE', 'DELETE'
    old_total_amount DECIMAL(10,2),
    new_total_amount DECIMAL(10,2),
    old_status TEXT,
    new_status TEXT,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to log AFTER INSERT on orders
CREATE TRIGGER trg_orders_audit_insert
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
    INSERT INTO orders_audit (
        order_id, 
        action_type, 
        new_total_amount, 
        old_status,
        new_status,
        changed_by
    )
    VALUES (
        NEW.id, 
        'INSERT', 
        NEW.total_amount, 
        NULL,
        NEW.status,
        COALESCE(NEW.created_by, 'system')
    );
END;

-- Create trigger to log AFTER UPDATE on orders
CREATE TRIGGER trg_orders_audit_update
AFTER UPDATE ON orders
FOR EACH ROW
WHEN OLD.total_amount != NEW.total_amount OR OLD.status != NEW.status
BEGIN
    INSERT INTO orders_audit (
        order_id, 
        action_type, 
        old_total_amount,
        new_total_amount, 
        old_status,
        new_status,
        changed_by
    )
    VALUES (
        NEW.id, 
        'UPDATE', 
        OLD.total_amount,
        NEW.total_amount, 
        OLD.status,
        NEW.status,
        COALESCE(NEW.updated_by, 'system')
    );
END;
```

**Explanation:** This example creates an audit system using triggers. The `AFTER INSERT` trigger captures new orders, while the `AFTER UPDATE` trigger (with a `WHEN` clause to avoid logging trivial updates) captures changes to order totals or status. The `NEW` keyword references the row being inserted or updated, while `OLD` references the previous values during updates or deletes.

---

### Example 2: Data Validation Trigger

**Difficulty:** Intermediate

**Scenario:** Ensure that orders cannot have a total_amount less than 0, and high-value orders (> $500) require special validation.

```sql
-- Create trigger for BEFORE INSERT validation
CREATE TRIGGER trg_orders_validate_insert
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    -- Validate: total_amount must be positive
    SELECT CASE 
        WHEN NEW.total_amount < 0 THEN 
            RAISE(ABORT, 'Order total cannot be negative')
    END;
    
    -- Validate: high-value orders need special handling
    SELECT CASE 
        WHEN NEW.total_amount > 500 AND NEW.status != 'pending_review' THEN 
            RAISE(ABORT, 'Orders over $500 must be set to pending_review status')
    END;
    
    -- Auto-set status for normal orders if not provided
    SELECT CASE 
        WHEN NEW.status IS NULL THEN 
            RAISE(IGNORE)  -- SQLite way to skip, or use UPDATE in BEFORE trigger
    END;
END;

-- Alternative: Set default values in BEFORE trigger
CREATE TRIGGER trg_orders_set_defaults
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    -- Ensure status has a value
    UPDATE orders SET status = 'pending' 
    WHERE id = NEW.id AND status IS NULL;
END;

-- Test the validation
INSERT INTO orders (user_id, total_amount, status) 
VALUES (1, -50, 'pending');
-- ERROR: Order total cannot be negative

INSERT INTO orders (user_id, total_amount, status) 
VALUES (1, 750, 'confirmed');
-- ERROR: Orders over $500 must be set to pending_review status

-- This will work:
INSERT INTO orders (user_id, total_amount, status) 
VALUES (1, 750, 'pending_review');
```

**Explanation:** `BEFORE` triggers are perfect for data validation because they intercept the operation before it happens. Using `RAISE(ABORT, ...)` aborts the transaction and prevents the invalid data from being committed. In SQLite, you use `SELECT CASE WHEN ... RAISE(ABORT, ...)` for validation. Other databases like MySQL use `SIGNAL SQLSTATE` or `THROW`.

---

### Example 3: Cascading Update Trigger

**Difficulty:** Intermediate

**Scenario:** When a product price changes, update the total_amount of all pending orders containing that product.

```sql
-- First, let's assume we have an order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    unit_price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create trigger to recalculate order totals when product price changes
CREATE TRIGGER trg_product_price_update
AFTER UPDATE OF price ON products
FOR EACH ROW
WHEN OLD.price != NEW.price
BEGIN
    -- Update unit_price in order_items for affected products
    -- Only for pending orders (don't change completed orders)
    UPDATE order_items
    SET unit_price = NEW.price
    WHERE product_id = NEW.id
      AND order_id IN (
          SELECT id FROM orders 
          WHERE status IN ('pending', 'pending_review')
      );
    
    -- Recalculate order totals for affected orders
    UPDATE orders
    SET total_amount = (
        SELECT COALESCE(SUM(quantity * unit_price), 0)
        FROM order_items
        WHERE order_items.order_id = orders.id
    )
    WHERE id IN (
        SELECT DISTINCT order_id 
        FROM order_items 
        WHERE product_id = NEW.id
    )
    AND status IN ('pending', 'pending_review');
END;

-- Also create a trigger to maintain order totals when items are added
CREATE TRIGGER trg_order_items_insert
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    -- Update the order total when a new item is added
    UPDATE orders
    SET total_amount = total_amount + (NEW.quantity * NEW.unit_price)
    WHERE id = NEW.order_id;
END;
```

**Explanation:** This trigger demonstrates cascading updates—when a product's price changes, it automatically recalculates affected pending orders. The `AFTER UPDATE OF price` syntax makes the trigger fire only when the price column changes (not other columns). This maintains data consistency without requiring application code to handle all the cascading logic.

## Common Mistakes

### Mistake 1: Creating Recursive Triggers

**Incorrect:**
```sql
-- This trigger updates the orders table, which triggers itself!
CREATE TRIGGER trg_orders_recursive
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    -- This UPDATE will trigger the same trigger again!
    UPDATE orders 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;
```

**Error Message:** `Error: too many levels of trigger recursion` or the database hangs/crashes due to infinite loop.

**Why it happens:** The trigger updates the same table it's monitoring, causing it to fire repeatedly. Most databases have recursion limits, but hitting them wastes resources and causes errors. This is a common mistake when trying to maintain audit timestamps.

**Corrected:**
```sql
-- Use BEFORE trigger to modify values before insertion
CREATE TRIGGER trg_orders_timestamp
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
    -- Modify NEW row directly - no recursive trigger
    UPDATE orders SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Or if you must use AFTER, use a condition to prevent recursion
CREATE TRIGGER trg_orders_safe_update
AFTER UPDATE ON orders
FOR EACH ROW
WHEN IFNULL(OLD.updated_at, '') = IFNULL(NEW.updated_at, '')  -- Only run if timestamp wasn't changed
BEGIN
    -- Additional logic here
    INSERT INTO audit_log (table_name, action, changed_at)
    VALUES ('orders', 'UPDATE', CURRENT_TIMESTAMP);
END;
```

💡 **Key Takeaway:** Use `BEFORE` triggers when you need to modify the data being inserted/updated. Use `AFTER` triggers for logging or cascading to other tables. Always be careful not to modify the same table in an AFTER trigger without recursion guards.

---

### Mistake 2: Not Handling Multi-Row Operations

**Incorrect:**
```sql
-- Assuming only one row is affected
CREATE TRIGGER trg_orders_single_row
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
    -- This assumes we can store in a variable, but what about 10 inserts?
    -- In SQLite, variables aren't supported like this anyway
    -- But the conceptual issue remains
    
    -- Send notification (conceptual)
    INSERT INTO notifications (message)
    VALUES ('New order: ' || NEW.id);
END;

-- Problem: What happens with:
INSERT INTO orders (user_id, total_amount)
SELECT user_id, 100 FROM users WHERE city = 'Seattle';
-- This might insert 50 rows at once!
```

**Why it happens:** Triggers execute once per row (`FOR EACH ROW`), but developers sometimes write logic that assumes single-row operations. When bulk inserts/updates happen, the logic might not scale or could cause unexpected behavior.

**Corrected:**
```sql
-- Handle each row individually (correct approach)
CREATE TRIGGER trg_orders_multi_row_safe
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
    -- Each row gets its own notification
    INSERT INTO notifications (order_id, message, created_at)
    VALUES (
        NEW.id, 
        'New order received for $' || NEW.total_amount,
        CURRENT_TIMESTAMP
    );
END;

-- For bulk operations, consider using a statement-level trigger (if supported)
-- or batch processing in application code instead of triggers
```

💡 **Key Takeaway:** Remember that `FOR EACH ROW` triggers execute once for every affected row. Write trigger logic that works correctly whether 1 row or 1000 rows are modified. For bulk operations, statement-level triggers (if your database supports them) or application-level batch processing may be more appropriate.

---

### Mistake 3: Mutating Table Error in Row-Level Triggers

**Incorrect:**
```sql
-- Trying to query the same table being modified
CREATE TRIGGER trg_orders_count_check
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    -- ERROR: Cannot query orders table while inserting into it!
    -- This pattern causes issues in many databases
    SELECT COUNT(*) 
    FROM orders 
    WHERE user_id = NEW.user_id;
    
    -- Trying to use this count would fail
END;
```

**Error Message:** `Error: cannot commit transaction - SQL statements in progress` or `ORA-04091: table ORDERS is mutating, trigger/function may not see it` (Oracle)

**Why it happens:** Row-level triggers cannot query the table they're defined on because the table is in a state of flux during the operation. This is called the "mutating table" error. The database prevents this to maintain consistency and avoid complex concurrency issues.

**Corrected:**
```sql
-- Solution: Use a separate tracking table
CREATE TABLE IF NOT EXISTS user_order_counts (
    user_id INTEGER PRIMARY KEY,
    order_count INTEGER DEFAULT 0
);

CREATE TRIGGER trg_orders_count_increment
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
    INSERT INTO user_order_counts (user_id, order_count)
    VALUES (NEW.user_id, 1)
    ON CONFLICT(user_id) 
    DO UPDATE SET order_count = order_count + 1;
END;

CREATE TRIGGER trg_orders_validate_count
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN (
            SELECT COALESCE(order_count, 0) 
            FROM user_order_counts 
            WHERE user_id = NEW.user_id
        ) >= 10 THEN
            RAISE(ABORT, 'User has reached maximum order limit (10)')
    END;
END;
```

💡 **Key Takeaway:** Row-level triggers cannot query their own base table in many databases. For count/aggregation validations, maintain separate summary tables updated by triggers, use database constraints, or perform complex validations at the application level.

---

*Content generated for SQL-Adapt Learning Platform*
