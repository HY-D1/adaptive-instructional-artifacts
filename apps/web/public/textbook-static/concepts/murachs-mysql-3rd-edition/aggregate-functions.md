# Aggregate Functions

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Use COUNT, SUM, AVG, MAX, MIN for calculations
- Understand the difference between COUNT(*) and COUNT(column)
- Combine aggregates with other SQL features

## Prerequisites

Before learning this concept, you should understand:

- [select-basic](./select-basic.md)

## What is This?

Aggregate functions perform calculations on sets of values and return a single result.

## Examples

### Example 1: Example for aggregate-functions

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

### Mistake 1: Mixing aggregate and non-aggregate columns

**Incorrect SQL:**
```sql
SELECT city, COUNT(*) FROM users;
```

**Error Message:** `Error: misuse of aggregate function COUNT()`

**Why it happens:** When using aggregates, non-aggregate columns must be in a GROUP BY clause.

**Corrected SQL:**
```sql
SELECT city, COUNT(*) FROM users GROUP BY city;
```

💡 **Key Takeaway:** All non-aggregated columns must be in GROUP BY

### Mistake 2: Using WHERE with aggregate conditions

**Incorrect SQL:**
```sql
SELECT city, COUNT(*) FROM users WHERE COUNT(*) > 2 GROUP BY city;
```

**Error Message:** `Error: misuse of aggregate: COUNT()`

**Why it happens:** WHERE filters rows before aggregation. Use HAVING to filter after aggregation.

**Corrected SQL:**
```sql
SELECT city, COUNT(*) FROM users GROUP BY city HAVING COUNT(*) > 2;
```

💡 **Key Takeaway:** Use HAVING, not WHERE, for aggregate conditions

## Practice Challenge

**Find the average age of users in each city.**

💡 **Hint:** Use AVG with GROUP BY.

<details>
<summary>Click to see solution</summary>

```sql
SELECT city, AVG(age) as avg_age FROM users GROUP BY city;
```

**Explanation:** AVG calculates the average age, and GROUP BY city computes it separately for each city.
</details>

## Related Practice Problems

- [problem-4](/practice/problem-4)
- [problem-11](/practice/problem-11)
- [problem-12](/practice/problem-12)

---

*Content generated for SQL-Adapt Learning Platform*
