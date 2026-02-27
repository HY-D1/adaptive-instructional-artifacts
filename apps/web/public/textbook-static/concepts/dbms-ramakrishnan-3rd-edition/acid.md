# ACID Properties

## Definition

ACID properties are essential for ensuring data integrity and reliability in database management systems. They stand for Atomicity, Consistency, Isolation, and Durability.

## Explanation

The ACID properties ensure that transactions (sets of operations) within a database system are processed reliably and consistently. Here's how they work together:

1. **Atomicity**: This property ensures that a transaction is treated as a single unit of work. If any part of the transaction fails, the entire transaction is rolled back, maintaining data consistency.

2. **Consistency**: A transaction must change the database from one valid state to another. It cannot leave the system in an inconsistent state.

3. **Isolation**: This property ensures that concurrent transactions do not interfere with each other. Each transaction sees a consistent snapshot of the database, and changes made by one transaction are not visible until it is committed.

4. **Durability**: Once a transaction is committed, its effects are permanent. The data remains intact even if there is a system failure.

## Examples

### Basic Usage

```sql
-- Example of a transaction BEGIN TRANSACTION; UPDATE accounts SET balance = balance - 100 WHERE account_id = 123; UPDATE accounts SET balance = balance + 100 WHERE account_id = 456; COMMIT;
```

This example demonstrates a simple transaction that transfers money from one account to another. It uses BEGIN TRANSACTION, UPDATE statements, and COMMIT to ensure that the transfer is completed atomically.

### Practical Example

```sql
-- Practical scenario for maintaining consistency BEGIN TRANSACTION; UPDATE orders SET status = 'Shipped' WHERE order_id = 789; INSERT INTO shipment (order_id, tracking_number) VALUES (789, '1234567890'); COMMIT;
```

This practical example shows how a transaction can be used to update the status of an order and record its shipment in a single, consistent operation.

## Common Mistakes

### Not using transactions for operations that should be atomic

**Incorrect:**

```sql
-- Incorrect example without transaction UPDATE accounts SET balance = balance - 100 WHERE account_id = 123; INSERT INTO logs (user_id, action) VALUES (1, 'Transfer');
```

**Correct:**

```sql
-- Correct example with transaction BEGIN TRANSACTION; UPDATE accounts SET balance = balance - 100 WHERE account_id = 123; INSERT INTO logs (user_id, action) VALUES (1, 'Transfer'); COMMIT;
```

**Why this happens:** Failing to use transactions can lead to inconsistent data states. Always wrap operations that should be atomic within a transaction.

---

## Practice

**Question:** Explain how the ACID properties ensure data integrity in a database system.

**Solution:** The ACID properties ensure data integrity by guaranteeing that transactions are treated as single units of work (Atomicity), maintaining valid states (Consistency), preventing interference between concurrent transactions (Isolation), and ensuring that committed changes remain permanent (Durability). Together, these properties help prevent data corruption and maintain the reliability of the database system.


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*