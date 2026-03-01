# The ORDER BY Clause

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand the The ORDER BY Clause concept in SQL

## What is This?

The ORDER BY Clause is an important SQL concept for working with databases.

## Examples

### Example 1: Example for order-by

**Difficulty:** Beginner

**Scenario:** Basic usage example

```sql
SELECT * FROM users LIMIT 5;
```

**Explanation:** See the practice problems for more examples.

**Expected Output:**

| id | name | email | age | city |
| --- | --- | --- | --- | --- |
| 1 | Alice | alice@email.com | 25 | Seattle |
| 2 | Bob | bob@email.com | 30 | Portland |
| 3 | Charlie | charlie@email.com | 22 | Seattle |

## Common Mistakes

### Mistake 1: Syntax error

**Incorrect SQL:**
```sql
SELECT * FORM users;
```

**Error Message:** `Error: near 'FORM': syntax error`

**Why it happens:** Typo in SQL keyword. The correct keyword is FROM, not FORM.

**Corrected SQL:**
```sql
SELECT * FROM users;
```

💡 **Key Takeaway:** Double-check SQL keyword spelling

### Mistake 2: Missing semicolon

**Incorrect SQL:**
```sql
SELECT * FROM users
```

**Error Message:** `Some databases require semicolons to end statements`

**Why it happens:** While some SQL implementations are lenient, it's best practice to end statements with semicolons.

**Corrected SQL:**
```sql
SELECT * FROM users;
```

💡 **Key Takeaway:** Always end SQL statements with a semicolon

## Practice Challenge

**Practice using order-by with the practice schemas.**

💡 **Hint:** Review the examples above and try writing your own query.

<details>
<summary>Click to see solution</summary>

```sql
SELECT * FROM users LIMIT 5;
```

**Explanation:** This is a basic query to get you started. See the linked practice problems for more challenges.
</details>

## Related Practice Problems

- [problem-5](/practice/problem-5)
- [problem-6](/practice/problem-6)

---

*Content generated for SQL-Adapt Learning Platform*
