# Transactions

## Definition

Transactions are sequences of database operations that must either complete successfully together or fail as a whole. They ensure data integrity and consistency by preventing concurrent modifications from interfering with each other.

## Explanation

Transactions help solve concurrency problems in databases, ensuring that multiple users can access and modify the same data without causing conflicts. Here’s how they work:
1. **Isolation**: Transactions are isolated from one another, meaning changes made during a transaction do not affect others until it is completed.
2. **Atomicity**: Each transaction is treated as a single unit of work that either completes successfully or fails entirely.
3. **Consistency**: A transaction must leave the database in a consistent state before and after its execution.
4. **Durability**: Once a transaction is committed, its changes are permanent, even if the system crashes afterward.

Transactions are crucial for maintaining data integrity in large systems with multiple users.

## Examples

### Basic Usage

```sql
-- Start a transaction BEGIN; UPDATE accounts SET balance = balance - 100 WHERE account_id = 1; UPDATE accounts SET balance = balance + 100 WHERE account_id = 2; COMMIT;
```

This example demonstrates how to start a transaction, perform two updates, and commit the changes. If any part of the transaction fails, it can be rolled back using ROLLBACK.

### Practical Example

```sql
-- Transfer money between accounts BEGIN; UPDATE accounts SET balance = balance - 100 WHERE account_id = 1; UPDATE accounts SET balance = balance + 100 WHERE account_id = 2; COMMIT;
```

This practical example shows a real-world scenario where money is transferred between two accounts. The transaction ensures that both updates are successful or neither happens, maintaining the integrity of the financial data.

## Common Mistakes

### Forgetting to commit or rollback

**Incorrect:**

```sql
-- Incorrect: No commit OR rollback BEGIN; UPDATE accounts SET balance = balance - 100 WHERE account_id = 1;
```

**Correct:**

```sql
-- Correct: Commit the transaction BEGIN; UPDATE accounts SET balance = balance - 100 WHERE account_id = 1; COMMIT;
```

**Why this happens:** Mistakes happen when a transaction is not properly committed or rolled back, leading to partial changes that can cause inconsistencies.

---

## Practice

**Question:** Write a SQL transaction to update the inventory of two products. If either product's stock goes below zero, roll back the transaction.

**Solution:** -- Solution: Use a transaction with conditional logic
BEGIN;
UPDATE inventory SET stock = stock - 10 WHERE product_id = 1;
UPDATE inventory SET stock = stock - 5 WHERE product_id = 2;
IF (SELECT stock FROM inventory WHERE product_id = 1) < 0 OR (SELECT stock FROM inventory WHERE product_id = 2) < 0 THEN
    ROLLBACK;
ELSE
    COMMIT;
END IF;

---

*Source: Murach's MySQL 3rd Edition*