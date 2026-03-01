# part 3

## Definition

Application servers are specialized programs that manage a pool of threads or processes to execute requests, thus avoiding the overhead of creating new processes for each request.

## Explanation

Application servers are essential in modern web applications because they handle multiple requests efficiently. They maintain a pool of threads or processes and use them to process incoming requests, which reduces the time spent on starting new processes. This is particularly useful in scenarios where many users need access simultaneously. Application servers also provide additional functionalities such as session management, allowing for continuity across multiple steps in a user's interaction with the system.

## Examples

### Basic Usage

```sql
-- Example of a simple SQL query to retrieve data FROM a TABLE SELECT * FROM users WHERE active = true;
```

This example demonstrates how to select all active users from a 'users' table. The application server would handle the execution of this query efficiently.

### Practical Example

```sql
-- Practical scenario: Retrieving user details for a session
SELECT username, email FROM users WHERE user_id = 123;
```

In a real-world application, when a user logs in, the system might need to retrieve their username and email. The application server would handle this request efficiently.

## Common Mistakes

### Using 'exit' instead of proper SQL queries

**Incorrect:**

```sql
-- Incorrect: Exiting the script instead of executing a query print("</HTML>"); exit;
```

**Correct:**

```sql
-- Correct: Executing a SQL query
SELECT * FROM users WHERE active = true;
```

**Why this happens:** The mistake here is using 'exit' to terminate the script, which is not related to SQL. Instead, you should execute a proper SQL query to retrieve data.

---

## Practice

**Question:** Write a SQL query that retrieves all products from a 'products' table where the price is greater than $100.

**Solution:** -- Solution: Selecting products with prices greater than $100
SELECT * FROM products WHERE price > 100;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*