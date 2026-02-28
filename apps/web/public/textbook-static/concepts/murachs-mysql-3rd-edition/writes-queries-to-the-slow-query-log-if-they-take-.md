# writes queries to the slow query log if they take longer than 5 seconds

## Definition

The slow query log is a feature in databases that records queries which take longer than a specified amount of time to execute. This helps identify and optimize slow-performing queries.

## Explanation

Imagine you're building a big tower with blocks, but some blocks are heavier than others. The slow query log is like a special tool that helps you find the heavy blocks (slow queries) so you can make them lighter (optimize them). By setting a threshold of 5 seconds for what we consider a 'slow' query, we can easily spot these problematic queries and work on making them faster.

## Examples

### Basic Usage

```sql
-- Set the slow query time to 5 seconds
SET GLOBAL long_query_time = 5;
```

This code sets the threshold for what we consider a 'slow' query to 5 seconds. Any query that takes longer than this will be logged.

### Practical Example

```sql
-- Example of a slow query
SELECT * FROM large_table WHERE condition;
```

This example demonstrates what a potentially slow query might look like. If it takes longer than 5 seconds to execute, it will be logged in the slow query log.

## Common Mistakes

### Not setting the threshold

**Incorrect:**

```sql
-- No threshold set
SET GLOBAL long_query_time;
```

**Correct:**

```sql
-- Set threshold to 5 seconds
SET GLOBAL long_query_time = 5;
```

**Why this happens:** This mistake happens when you forget to specify a value for `long_query_time`. Always make sure to set it to a reasonable number, like 5 seconds.

---

## Practice

**Question:** How would you set the slow query time to 10 seconds?

**Solution:** The correct code is: SET GLOBAL long_query_time = 10; This sets the threshold for what we consider a 'slow' query to 10 seconds.

---

*Source: Murach's MySQL 3rd Edition*