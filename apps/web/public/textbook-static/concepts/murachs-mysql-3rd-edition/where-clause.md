# The WHERE Clause

🟢 **Difficulty:** Beginner
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Filter rows using comparison operators (=, <, >, <=, >=, <>)
- Combine conditions with AND, OR, and NOT
- Use LIKE for pattern matching with wildcards
- Handle NULL values correctly with IS NULL / IS NOT NULL

## Prerequisites

Before learning this concept, you should understand:

- [select-basic](./select-basic.md)

## What is This?

The WHERE clause filters query results by specifying conditions that rows must meet.

## Examples

### Example 1: SQL Example 1

**Difficulty:** Intermediate

**Scenario:** Basic data retrieval

```sql
SELECT statements without FROM clauses Example 1 : Testing a calculation SELECT 1000 * (1 + .1) AS 1110% More Than 1000" 10°/4 More Than 1000 ---I -- ► 1100.0 "'-~------;
```

**Explanation:** Example SQL statement

**Expected Output:**

| id | name | email | age | city |
| --- | --- | --- | --- | --- |
| 1 | Alice | alice@email.com | 25 | Seattle |
| 2 | Bob | bob@email.com | 30 | Portland |
| 3 | Charlie | charlie@email.com | 22 | Seattle |

## Common Mistakes

### Mistake 1: Using = instead of IN for multiple values

**Incorrect SQL:**
```sql
SELECT * FROM users WHERE city = 'Seattle', 'Portland';
```

**Error Message:** `Error: near ',': syntax error`

**Why it happens:** The = operator only compares to a single value. For multiple values, use IN.

**Corrected SQL:**
```sql
SELECT * FROM users WHERE city IN ('Seattle', 'Portland');
```

💡 **Key Takeaway:** Use IN for multiple possible values

### Mistake 2: String comparison without quotes

**Incorrect SQL:**
```sql
SELECT * FROM users WHERE city = Seattle;
```

**Error Message:** `Error: no such column: Seattle`

**Why it happens:** Without quotes, SQL treats Seattle as a column name instead of a string value.

**Corrected SQL:**
```sql
SELECT * FROM users WHERE city = 'Seattle';
```

💡 **Key Takeaway:** Always use quotes around string literals

## Practice Challenge

**Find all users whose email ends with '@email.com' and are under 30.**

💡 **Hint:** Use LIKE for pattern matching with the % wildcard.

<details>
<summary>Click to see solution</summary>

```sql
SELECT * FROM users WHERE email LIKE '%@email.com' AND age < 30;
```

**Explanation:** LIKE '%@email.com' matches any string ending with '@email.com'. The AND operator ensures both conditions are met.
</details>

## Related Practice Problems

- [problem-2](/practice/problem-2)
- [problem-6](/practice/problem-6)
- [problem-7](/practice/problem-7)

---

*Content generated for SQL-Adapt Learning Platform*
