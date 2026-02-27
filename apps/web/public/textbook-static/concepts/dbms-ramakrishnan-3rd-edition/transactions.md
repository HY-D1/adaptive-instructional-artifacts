# Database Transactions

## Definition

A database transaction is a sequence of operations that are treated as a single unit of work. It ensures data consistency and integrity by either fully completing all operations or rolling back any changes if an error occurs.

## Explanation

Database transactions solve the problem of ensuring data consistency when multiple operations need to be performed together. Here’s how they work:
1. **Start**: A transaction begins with a BEGIN statement.
2. **Execute**: Multiple SQL statements are executed within this block.
3. **Commit**: If all operations succeed, the COMMIT statement is issued to save changes permanently.
4. **Rollback**: If any operation fails, the ROLLBACK statement is used to undo all changes made during the transaction.

Transactions are crucial in preventing data corruption and ensuring that the database remains consistent even in the face of errors or system failures.

## Examples

### Basic Usage

```sql
-- Start a transaction BEGIN; -- INSERT data into the TABLE INSERT INTO employees (name, position) VALUES ('John Doe', 'Manager'); -- Commit the transaction to save changes COMMIT;
```

This example demonstrates starting a transaction, inserting data, and committing the changes. If any error occurs during these operations, the ROLLBACK statement can be used instead of COMMIT.

### Practical Example

```sql
-- Transfer money from one account to another
BEGIN;
-- Debit the sender's account
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- Credit the receiver's account
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
-- Commit the transaction if both operations succeed
COMMIT;
```

This practical example shows how transactions are used in real-world scenarios, such as transferring money between bank accounts. It ensures that both debit and credit operations are completed successfully before any changes are saved.

## Common Mistakes

### Forgetting to commit or rollback

**Incorrect:**

```sql
-- UPDATE data without committing UPDATE employees SET position = 'Senior Manager' WHERE id = 1;
```

**Correct:**

```sql
-- Correct way with transaction management BEGIN; UPDATE employees SET position = 'Senior Manager' WHERE id = 1; COMMIT;
```

**Why this happens:** Forgetting to commit or rollback can lead to partial changes being saved, which is undesirable. Always ensure that all operations are either committed or rolled back.

---

## Practice

**Question:** Write a SQL transaction to update the salary of an employee and then insert a record into a log table. Ensure that if any error occurs during these operations, both changes should be rolled back.

**Solution:** -- Start a transaction
BEGIN;
-- Update employee's salary
UPDATE employees SET salary = salary + 5000 WHERE id = 101;
-- Insert record into log table
INSERT INTO salary_log (employee_id, new_salary) VALUES (101, (SELECT salary FROM employees WHERE id = 101));
-- Commit the transaction if both operations succeed
COMMIT;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*