# Subqueries

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 25 minutes

## Learning Objectives

- Write subqueries in SELECT, FROM, and WHERE clauses
- Understand correlated vs non-correlated subqueries
- Use EXISTS and IN operators with subqueries
- Know when to use subqueries vs joins

## Prerequisites

Before learning this concept, you should understand:

- [select-basic](./select-basic.md)
- [where-clause](./where-clause.md)

## What is This?

200 Section 2 More SQL skills cts you need them An introduction to subqueries As you learned in chapter 5, a subquery is a SELECT statement that's coded within another SQL statement.

## Examples

### Example 1: Example for subqueries

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

### Mistake 1: Subquery returns multiple rows for single-row operator

**Incorrect SQL:**
```sql
SELECT * FROM users WHERE id = (SELECT user_id FROM orders);
```

**Error Message:** `Error: subquery returns more than one row`

**Why it happens:** The = operator expects a single value, but the subquery returns multiple rows.

**Corrected SQL:**
```sql
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders);
```

💡 **Key Takeaway:** Use IN when the subquery may return multiple rows

## Practice Challenge

**Find users who have not placed any orders.**

💡 **Hint:** Use NOT EXISTS or NOT IN with a subquery.

<details>
<summary>Click to see solution</summary>

```sql
SELECT * FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);
```

**Explanation:** The subquery checks for orders for each user. NOT EXISTS returns users where no matching orders are found.
</details>

## Related Practice Problems

- [problem-16](/practice/problem-16)
- [problem-17](/practice/problem-17)
- [problem-18](/practice/problem-18)

---

*Content generated for SQL-Adapt Learning Platform*
