# Active transactions

## Definition

Active transactions refer to the number of transactions that are currently running in a database system. Managing these transactions efficiently is crucial for maintaining good performance and preventing issues like lock thrashing.

## Explanation

When too many transactions are active at once, it can lead to a phenomenon called lock thrashing. This happens when a significant portion of transactions are blocked waiting for locks on resources they need. To prevent this, database administrators (DBAs) should monitor the number of active transactions and reduce it if necessary. By managing transactions effectively, we can increase system throughput, which is the amount of work the system can complete in a given time period.

## Examples

### Basic Usage

```sql
-- Locking a small object
SELECT * FROM users WHERE user_id = 1 FOR UPDATE;
```

This example demonstrates how locking a small object (in this case, a single row) can reduce the likelihood of lock thrashing.

### Practical Example

```sql
-- Reducing lock hold time BEGIN TRANSACTION; UPDATE accounts SET balance = balance - 100 WHERE account_id = 1; COMMIT;
```

This practical example shows how reducing the time transactions hold locks (by committing quickly) can help prevent lock thrashing.

## Common Mistakes

### Not monitoring active transactions

**Incorrect:**

```sql
-- No transaction monitoring
SELECT * FROM users;
```

**Correct:**

```sql
-- Monitor active transactions
SELECT COUNT(*) FROM information_schema.processlist WHERE command != 'Sleep';
```

**Why this happens:** Failing to monitor active transactions can lead to lock thrashing without the DBA realizing it. Regularly checking the number of active transactions helps catch and address issues before they become critical.

---

## Practice

**Question:** How can a DBA reduce the number of active transactions in a database system?

**Solution:** A DBA can reduce the number of active transactions by identifying and optimizing long-running queries, increasing the size of locks to minimize contention, or using techniques like lock downgrade to avoid deadlocks.


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*