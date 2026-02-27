# SQL Authorization

## Definition

Hash-based indexing is a technique used to speed up data retrieval operations on database tables by using a hash function to map keys to specific buckets where the actual data entries are stored.

## Explanation

Hash-based indexing works by creating a mapping between search keys and bucket numbers. When you want to find an entry, you apply a hash function to the key to determine which bucket it should be in. This allows for very fast lookups because you don't have to scan through all entries in the table. However, this method is not suitable for range queries, where you need to find all entries within a certain range of values.

## Examples

### Basic Usage

```sql
-- Example of a simple SELECT statement using a hash INDEX SELECT * FROM employees WHERE employee_id = 123;
```

This example demonstrates how to use a hash-based index for an equality search. The hash function maps the employee_id value to a specific bucket, allowing for quick retrieval.

### Practical Example

```sql
-- Practical scenario where hash indexing is beneficial
SELECT * FROM orders WHERE customer_id BETWEEN 100 AND 200;
```

This example shows how hash-based indexing might not be the best choice for a range search. It would require scanning multiple buckets, which could be inefficient.

## Common Mistakes

### Using hash-based indexing for range searches

**Incorrect:**

```sql
-- Incorrect way to query using hash index
SELECT * FROM table WHERE column BETWEEN value1 AND value2;
```

**Correct:**

```sql
-- Correct way to handle range queries
SELECT * FROM table WHERE column >= value1 AND column <= value2;
```

**Why this happens:** Mistake happens because hash-based indexing is not designed for range searches. The correct approach depends on the specific database system and its capabilities.

---

## Practice

**Question:** Create a SQL query that demonstrates using a hash index for an equality search.

**Solution:** SELECT * FROM products WHERE product_id = 456;
Explanation: This query uses a hash-based index to quickly find the product with product_id 456.


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*