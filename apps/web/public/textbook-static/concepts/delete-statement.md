# The DELETE Statement

🔴 **Difficulty:** Advanced  
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Remove rows from tables safely using DELETE
- Understand the difference between DELETE and DROP
- Use WHERE clauses to control which rows are deleted

## What is This?

The **DELETE statement** removes rows from a database table.

Like UPDATE, it's dangerous without a WHERE clause—it will delete **ALL rows**! DELETE only removes data, not the table structure itself (use DROP TABLE for that). Use DELETE when you need to permanently remove data, such as deleting a closed user account, removing test data, or purging old records. The WHERE clause is your only protection against catastrophic data loss.

## Examples

### Example 1: Deleting a Single Row

**Difficulty:** Beginner

**Scenario:** Remove a user who closed their account.

```sql
DELETE FROM users
WHERE id = 99;
```

**Explanation:** The WHERE clause targets only the row with id=99. Always use a primary key for single-row deletes to prevent accidental mass deletion. After running, verify with: `SELECT * FROM users WHERE id = 99;` (should return no rows).

### Example 2: Deleting Based on a Condition

**Difficulty:** Intermediate

**Scenario:** Remove all orders with a specific test product.

```sql
DELETE FROM orders
WHERE product = 'Test Product';
```

**Explanation:** This deletes all orders where the product column matches 'Test Product'. Useful for cleaning up test data or obsolete products.

### Example 3: Deleting with a Subquery

**Difficulty:** Advanced

**Scenario:** Delete all orders for users from a specific city (Portland).

```sql
DELETE FROM orders
WHERE user_id IN (SELECT id FROM users WHERE city = 'Portland');
```

**Explanation:** This uses a subquery to find all user IDs from Portland, then deletes orders belonging to those users. Be careful with subqueries—always test the subquery first: `SELECT id FROM users WHERE city = 'Portland';`

## Common Mistakes

### Mistake 1: Forgetting the WHERE Clause

**Incorrect:**
```sql
DELETE FROM orders;
```

**Error Message:** `Query executes successfully: 1,247 rows deleted`

**Why it happens:** Without a WHERE clause, DELETE removes **ALL rows** from the table. This is usually catastrophic and may not be recoverable without a backup.

**Corrected:**
```sql
DELETE FROM orders
WHERE product = 'Test Product';
```

💡 **Key Takeaway:** **ALWAYS** write the WHERE clause first. Before deleting, run a SELECT with the same WHERE clause to verify what will be deleted: `SELECT COUNT(*) FROM orders WHERE product = 'Test Product';`

### Mistake 2: Foreign Key Constraint Violations

**Incorrect:**
```sql
DELETE FROM users
WHERE id = 1;
```

**Error Message:** `Error: FOREIGN KEY constraint failed`

**Why it happens:** User ID 1 has related records in the orders table (they've placed orders). The database prevents deletion to maintain referential integrity—you can't have orders without users.

**Corrected:**
```sql
-- Option 1: Delete related orders first
DELETE FROM orders WHERE user_id = 1;
DELETE FROM users WHERE id = 1;

-- Option 2: Update user to inactive instead of deleting
UPDATE users SET city = 'Inactive' WHERE id = 1;

-- Option 3: If you defined ON DELETE CASCADE in the schema,
-- deleting the user would automatically delete their orders
```

💡 **Key Takeaway:** Check for foreign key relationships before deleting. Consider soft deletes (marking as inactive) instead of hard deletes to preserve data history and avoid constraint issues.

---

## Practice Challenge

**Delete all orders with an amount less than 50.**

💡 **Hint:** Use the amount column in your WHERE clause. Test with SELECT first!

<details>
<summary>Click to see solution</summary>

```sql
DELETE FROM orders
WHERE amount < 50;
```

**Explanation:** This removes all orders where the amount is less than 50. Always verify with `SELECT * FROM orders WHERE amount < 50;` first to see what will be deleted.
</details>

---

*Content generated for SQL-Adapt Learning Platform*
