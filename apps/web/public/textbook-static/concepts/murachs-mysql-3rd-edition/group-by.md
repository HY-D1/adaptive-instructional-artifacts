# The GROUP BY Clause

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 20 minutes

## Learning Objectives

- Group rows by one or more columns
- Apply aggregate functions to groups
- Use HAVING to filter groups based on aggregate values
- Understand the execution order of GROUP BY and HAVING

## Prerequisites

Before learning this concept, you should understand:

- [select-basic](./select-basic.md)
- [aggregate-functions](./aggregate-functions.md)

## What is This?

GROUP BY organizes rows with the same values into summary rows for aggregate calculations.

## Examples

### Example 1: Example for group-by

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

### Mistake 1: Missing column in GROUP BY

**Incorrect SQL:**
```sql
SELECT city, age, COUNT(*) FROM users GROUP BY city;
```

**Error Message:** `Error: column 'age' must appear in GROUP BY clause`

**Why it happens:** When grouping, any non-aggregated column in SELECT must be in GROUP BY.

**Corrected SQL:**
```sql
SELECT city, age, COUNT(*) FROM users GROUP BY city, age;
```

💡 **Key Takeaway:** Include all non-aggregated columns in GROUP BY

## Practice Challenge

**Find cities that have more than 2 users, ordered by user count.**

💡 **Hint:** Use GROUP BY with HAVING and ORDER BY.

<details>
<summary>Click to see solution</summary>

```sql
SELECT city, COUNT(*) as user_count
FROM users
GROUP BY city
HAVING COUNT(*) > 2
ORDER BY user_count DESC;
```

**Explanation:** GROUP BY groups users by city, HAVING filters groups with more than 2 users, and ORDER BY sorts the results.
</details>

## Related Practice Problems

- [problem-4](/practice/problem-4)
- [problem-13](/practice/problem-13)
- [problem-14](/practice/problem-14)

---

*Content generated for SQL-Adapt Learning Platform*
