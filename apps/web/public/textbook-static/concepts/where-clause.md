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

The **WHERE clause** filters query results by specifying conditions that rows must meet.

It acts like a sieve, keeping only rows that satisfy all specified conditions. You use WHERE when you need to narrow down results based on column values, such as finding users over 18, orders from last month, or products in stock. Without WHERE, queries return every row in the table, which is rarely what you need for large datasets.

## Examples

### Example 1: Basic Comparison Operators

**Difficulty:** Beginner

**Scenario:** Find all users over age 25

```sql
SELECT name, age, city 
FROM users 
WHERE age > 25;
```

**Explanation:** The `>` operator filters for users whose age is greater than 25.

### Example 2: Combining Conditions with AND/OR

**Difficulty:** Intermediate

**Scenario:** Find users from Seattle who are over 25, or any user from Portland

```sql
SELECT name, age, city 
FROM users 
WHERE (city = 'Seattle' AND age > 25) 
   OR city = 'Portland';
```

**Explanation:** AND requires both conditions to be true. OR requires either condition. Parentheses ensure the logic is evaluated correctly.

### Example 3: Pattern Matching with LIKE

**Difficulty:** Intermediate

**Scenario:** Find all users whose email ends with '@gmail.com'

```sql
SELECT name, email 
FROM users 
WHERE email LIKE '%@gmail.com';
```

**Explanation:** The `%` wildcard matches any sequence of characters. `LIKE '%@gmail.com'` matches any string ending with '@gmail.com'.

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

### Mistake 2: Using = NULL instead of IS NULL

**Incorrect SQL:**
```sql
SELECT * FROM users WHERE city = NULL;
```

**Why it happens:** NULL represents "unknown" in SQL, and `= NULL` will never match because unknown = unknown is unknown (not true).

**Corrected SQL:**
```sql
SELECT * FROM users WHERE city IS NULL;
```

💡 **Key Takeaway:** Always use IS NULL or IS NOT NULL to check for NULL values

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
