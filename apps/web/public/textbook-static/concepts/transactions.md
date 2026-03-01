# Transactions and Locking

🔴 **Difficulty:** Advanced
⏱️ **Estimated Time:** 30 minutes

## Learning Objectives

- Understand ACID properties of transactions
- Use BEGIN, COMMIT, and ROLLBACK statements
- Handle transaction isolation levels
- Recognize common transaction-related errors

## Prerequisites

Before learning this concept, you should understand:

- [insert-statement](./insert-statement.md)
- [update-statement](./update-statement.md)
- [delete-statement](./delete-statement.md)

## What is This?

A **transaction** is a sequence of SQL operations executed as a single unit of work that ensures either all operations succeed together or all fail together.

Transactions maintain data integrity during multi-step operations by following ACID properties: Atomicity (all-or-nothing execution), Consistency (database stays valid), Isolation (concurrent transactions don't interfere), and Durability (committed changes persist). You use transactions whenever partial completion would cause data problems—such as transferring money between accounts, processing orders that update inventory while creating records, or any operation where related changes must stay synchronized. Without transactions, a system crash between two related updates could leave your database in an invalid state, like money being deducted from one account but never reaching the other.

## Examples

### Example 1: Basic Bank Transfer Transaction

**Difficulty:** Beginner

**Scenario:** Transfer $100 from Alice's account to Bob's account

```sql
BEGIN TRANSACTION;

-- Deduct from Alice
UPDATE users 
SET age = age - 1  -- Simulating balance reduction
WHERE name = 'Alice' AND age >= 1;

-- Add to Bob
UPDATE users 
SET age = age + 1  -- Simulating balance increase
WHERE name = 'Bob';

-- Commit the transaction
COMMIT;

-- If anything failed, you would use: ROLLBACK;
```

**Explanation:** Both updates happen together. If either fails, we can ROLLBACK to undo both, ensuring data isn't lost or corrupted. In a real banking app, you'd have a separate `accounts` table with a `balance` column.

---

### Example 2: Order Processing with Inventory Check

**Difficulty:** Intermediate

**Scenario:** Create an order and update product stock atomically

```sql
BEGIN TRANSACTION;

-- Check if product is available
SELECT stock 
FROM products 
WHERE id = 1;

-- If sufficient stock, proceed with order creation
INSERT INTO orders (user_id, product_id, quantity, status)
VALUES (1, 1, 2, 'pending');

-- Update inventory (in a real app, check stock first)
UPDATE products 
SET stock = stock - 2 
WHERE id = 1 AND stock >= 2;

-- Verify the update succeeded by checking rows affected
-- If stock was insufficient, no rows would be updated

-- Commit if everything succeeded
COMMIT;
```

**Explanation:** The inventory update and order creation must happen together. Without a transaction, you could take inventory but not create the order (lost sale) or create the order but not deduct inventory (overselling).

---

### Example 3: Multi-Step Order with Savepoint

**Difficulty:** Intermediate

**Scenario:** Place an order with multiple items, using savepoints for partial rollback capability

```sql
BEGIN TRANSACTION;

-- Insert main order
INSERT INTO orders (user_id, total_amount, status)
VALUES (1, 250.00, 'pending');

-- Insert first order item
INSERT INTO order_items (order_id, product_id, quantity, price)
VALUES (1, 1, 2, 100.00);

-- Create a savepoint before second item (for partial rollback if needed)
SAVEPOINT after_first_item;

-- Insert second order item
INSERT INTO order_items (order_id, product_id, quantity, price)
VALUES (1, 2, 1, 50.00);

-- Update inventory for both products
UPDATE products SET stock = stock - 2 WHERE id = 1;
UPDATE products SET stock = stock - 1 WHERE id = 2;

-- Check if any product went negative (would need application logic)
-- If inventory went negative, rollback to savepoint:
-- ROLLBACK TO SAVEPOINT after_first_item;

-- Otherwise commit everything
COMMIT;
```

**Explanation:** SAVEPOINT allows partial rollback. If the second item causes issues (like negative inventory), we can roll back to just after the first item was added, without losing the entire transaction. Note: Savepoint support varies by database; this example uses SQLite-compatible syntax.

## Common Mistakes

### Mistake 1: Not using transactions for multi-step operations

**Incorrect Approach:**
```sql
-- Step 1: Create order
INSERT INTO orders (user_id, total) VALUES (1, 100);

-- Step 2: Deduct inventory (might fail!)
UPDATE products SET stock = stock - 1 WHERE id = 1;

-- If step 2 fails, we have an order but no inventory deduction!
```

**Error Message:** No immediate error, but data becomes inconsistent.

**Why it happens:** Developers often forget to wrap related operations in transactions, leading to orphaned records and inconsistent data when errors occur.

**Corrected SQL:**
```sql
BEGIN TRANSACTION;

INSERT INTO orders (user_id, total) VALUES (1, 100);
UPDATE products SET stock = stock - 1 WHERE id = 1;

COMMIT;  -- Both succeed together
```

💡 **Key Takeaway:** Wrap related operations in a transaction to maintain data consistency. If any step fails, ROLLBACK to undo all changes.

---

### Mistake 2: Holding transactions open too long

**Incorrect Pattern:**
```sql
BEGIN TRANSACTION;

SELECT * FROM users WHERE id = 1;
-- User takes 30 seconds to review data...

UPDATE users SET name = 'Alice Updated' WHERE id = 1;

COMMIT;
```

**Error Message:** May cause "database is locked" errors for other users, or timeouts.

**Why it happens:** Long-running transactions lock resources, blocking other users and potentially causing deadlocks or performance issues.

**Corrected Pattern:**
```sql
-- Do any reads first (without transaction)
SELECT * FROM users WHERE id = 1;
-- User reviews...

-- Then start transaction for the actual update
BEGIN TRANSACTION;
UPDATE users SET name = 'Alice Updated' WHERE id = 1;
COMMIT;
```

💡 **Key Takeaway:** Keep transactions as short as possible; start them only when you're ready to modify data. Don't include user interaction time inside transactions.

---

### Mistake 3: Forgetting to handle rollback on errors

**Incorrect Pattern:**
```sql
BEGIN TRANSACTION;

UPDATE products SET stock = stock - 5 WHERE id = 1;
-- Oops! Product id 1 doesn't exist, 0 rows updated
-- But we continue anyway...

INSERT INTO orders (user_id, product_id, quantity) VALUES (1, 1, 5);
-- This succeeds, but inventory wasn't actually deducted!

COMMIT;  -- Commits inconsistent state
```

**Why it happens:** Not all SQL errors throw exceptions. An UPDATE that affects 0 rows is still "successful" from SQL's perspective. You must explicitly check row counts and decide whether to COMMIT or ROLLBACK.

**Corrected Pattern:**
```sql
BEGIN TRANSACTION;

UPDATE products SET stock = stock - 5 WHERE id = 1;

-- Check: Did we actually update any rows?
-- (In application code, check rows affected)
-- If rows_affected == 0:
--     ROLLBACK;
--     RETURN 'Product not found or insufficient stock';

INSERT INTO orders (user_id, product_id, quantity) VALUES (1, 1, 5);

COMMIT;
```

💡 **Key Takeaway:** Always verify that operations succeeded before committing. Check rows affected by UPDATE/DELETE statements. Use application logic to decide whether to COMMIT or ROLLBACK.

## Practice Challenge

**Write a transaction to transfer a product between two users (as a gift), ensuring the sender actually owns the product.**

💡 **Hint:** Check if the sender has the product in their orders before transferring. Use BEGIN TRANSACTION, perform the checks, and COMMIT only if valid.

<details>
<summary>Click to see solution</summary>

```sql
BEGIN TRANSACTION;

-- Step 1: Verify sender has an order for this product
-- (Simplified - in real app you'd have an ownership/transfer table)
SELECT o.id 
FROM orders o
WHERE o.user_id = 1 AND o.product_id = 101;

-- Step 2: If verified, create transfer record
INSERT INTO orders (user_id, product_id, quantity, status, notes)
VALUES (2, 101, 1, 'transferred', 'Gift from user 1');

-- Step 3: Update original order to note the transfer
UPDATE orders 
SET notes = 'Transferred to user 2',
    status = 'completed'
WHERE user_id = 1 
  AND product_id = 101 
  AND status = 'pending'
LIMIT 1;

-- Step 4: Check if update succeeded
-- (Application would check rows affected)

COMMIT;
```

**Explanation:** We verify the sender's ownership, create a record for the recipient, and mark the sender's item as transferred—all within a transaction. If any step fails, the entire transfer is cancelled, preventing fraud or data inconsistency.
</details>

---

*Content generated for SQL-Adapt Learning Platform*
