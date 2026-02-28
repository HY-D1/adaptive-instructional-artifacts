# writes queries to the slow query log if they take longer than 5 seconds

## Definition

The slow query log is a feature that records all queries that take longer than a specified time to execute. This helps database administrators identify and optimize slow-performing queries.

## Explanation

Imagine you have a big box of toys, and some toys take longer to play with than others. The slow query log is like a special toy box where you keep the toys (queries) that take the longest time to play with. This helps you figure out which toys need more attention so they can be played with faster.

## Examples

### Basic Usage

```sql
-- Enable the slow query log SET GLOBAL long_query_time = 5; -- Set the log file path SET GLOBAL slow_query_log_file = '/var/log/mysql/slow-query.log'; -- Start logging queries that take longer than 5 seconds;
```

This example shows how to enable the slow query log and set its parameters. It ensures that only queries taking longer than 5 seconds are logged.

### Practical Example

```sql
-- Check the current value of long_query_time SHOW VARIABLES LIKE 'long_query_time'; -- Verify if logging is enabled SHOW VARIABLES LIKE 'slow_query_log';
```

This practical example demonstrates how to check the current settings for the slow query log and verify if it's enabled. It helps ensure that the configuration is correct.

## Common Mistakes

### Setting `long_query_time` too low

**Incorrect:**

```sql
-- Incorrectly set long_query_time to a very short value SET GLOBAL long_query_time = 1;
```

**Correct:**

```sql
-- Correctly set long_query_time to an appropriate value SET GLOBAL long_query_time = 5;
```

**Why this happens:** Setting `long_query_time` too low can result in logging many queries that are not actually slow, making it difficult to identify the real culprits. It's important to set this value based on your specific needs.

### Forgetting to enable logging

**Incorrect:**

```sql
-- Attempting to log without enabling SET GLOBAL long_query_time = 5;
```

**Correct:**

```sql
-- Enable the slow query log AND then set the time LIMIT SET GLOBAL slow_query_log = 'ON'; SET GLOBAL long_query_time = 5;
```

**Why this happens:** Forgetting to enable logging will result in no queries being logged, regardless of how long they take. Always ensure that logging is enabled before setting the `long_query_time`.

---

## Practice

**Question:** How do you set up the slow query log for a MySQL database and what value should you choose for `long_query_time`?

**Solution:** To set up the slow query log, use the following SQL commands:
-- Enable the slow query log
SET GLOBAL slow_query_log = 'ON';
-- Set the long_query_time to 5 seconds
SET GLOBAL long_query_time = 5;
This setup will log all queries that take longer than 5 seconds to execute.

---

*Source: Murach's MySQL 3rd Edition*