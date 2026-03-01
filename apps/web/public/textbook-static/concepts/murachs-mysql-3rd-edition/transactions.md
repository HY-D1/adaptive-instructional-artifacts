# Transactions and Locking

🔴 **Difficulty:** Advanced
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand the Transactions and Locking concept in SQL

## What is This?

Transactions and Locking is an important SQL concept for working with databases.

## Examples

### Example 1: SQL Example 1

**Difficulty:** Intermediate

**Scenario:** Basic data retrieval

```sql
DROP PROCEDURE IF EXISTS command drops the procedure named test if it already exists. This suppresses any error messages that would be displayed if you attempted to drop a procedure that didn't exist. The DELIMITER statement changes the delimiter from the default delimiter of the semicolon (;
```

**Explanation:** Example SQL statement

### Example 2: SQL Example 2

**Difficulty:** Beginner

**Scenario:** Basic data retrieval

```sql
CREATE PROCEDURE statement, and it allows you to use delimiter from the default delimiter of the semicolon (;
```

**Explanation:** Example SQL statement

### Example 3: SQL Example 3

**Difficulty:** Beginner

**Scenario:** Basic data retrieval

```sql
CREATE PROCEDURE statement, and it allows you to use two front slashes (//) to identify the end of the CREATE PROCEDURE state- ment. Although we use two front slashes as the delimiter in this book, it's also common to see two dollar signs ($$) or two semicolons (;
```

**Explanation:** Example SQL statement

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

**Practice using transactions with the practice schemas.**

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
