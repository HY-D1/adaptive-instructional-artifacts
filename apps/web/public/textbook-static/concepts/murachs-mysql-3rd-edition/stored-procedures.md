# Stored Procedures and Functions

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand the Stored Procedures and Functions concept in SQL

## What is This?

Stored Procedures and Functions is an important SQL concept for working with databases.

## Examples

### Example 1: SQL Example 1

**Difficulty:** Beginner

**Scenario:** Basic data retrieval

```sql
SELECT statement in transaction B is executed. This returns four rows with rep_id values of 1, 2, 3, and 4. Chapter 14 How to use transactions and locking 441 Four transactions that show how to work with locking reads Transaction A -- Execute each statement one at a time. - - Al tern.ate with Transactions B, C, and D as described. START TRANSACTION;
```

**Explanation:** Example SQL statement

**Expected Output:**

| id | name | email | age | city |
| --- | --- | --- | --- | --- |
| 1 | Alice | alice@email.com | 25 | Seattle |
| 2 | Bob | bob@email.com | 30 | Portland |
| 3 | Charlie | charlie@email.com | 22 | Seattle |

### Example 2: SQL Example 2

**Difficulty:** Beginner

**Scenario:** Basic data retrieval

```sql
insert row with rep_ id of 2 into child table INSERT INTO sales_ totals (rep_ id, sales_year, sales_ total) VALUES (2, 2019, 138193.69);
```

**Explanation:** Example SQL statement

### Example 3: SQL Example 3

**Difficulty:** Beginner

**Scenario:** Filtering data based on conditions

```sql
SELECT * FROM sales_reps WHERE rep_id < 5 FOR UPDATE';
```

**Explanation:** Example SQL statement

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

**Practice using stored-procedures with the practice schemas.**

💡 **Hint:** Review the examples above and try writing your own query.

<details>
<summary>Click to see solution</summary>

```sql
SELECT * FROM users LIMIT 5;
```

**Explanation:** This is a basic query to get you started. See the linked practice problems for more challenges.
</details>

---

*Content generated for SQL-Adapt Learning Platform*
