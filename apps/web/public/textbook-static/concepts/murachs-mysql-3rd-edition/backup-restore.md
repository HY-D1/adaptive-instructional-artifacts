# Backup and Restore

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand the Backup and Restore concept in SQL

## What is This?

Backup and Restore is an important SQL concept for working with databases.

## Examples

### Example 1: SQL Example 1

**Difficulty:** Advanced

**Scenario:** Filtering data based on conditions

```sql
ALTER USER IF EXISTS john PASSWORD EXPIRE INTERVAL 90 hire_date How to use the SET PASSWORD statement The syntax SET PASSWORD [FOR username] = 'password' A statement that changes a user's password SET PASSWORD FOR john= 'paSSword' A statement that changes the current user's password SET PASSWORD= 'secret' A SELECT statement that selects all users that don't have passwords SELECT Host, User FROM mysql.user WHERE authentication_ string = •• Host User -;
```

**Explanation:** Example SQL statement

### Example 2: SQL Example 2

**Difficulty:** Beginner

**Scenario:** Filtering data based on conditions

```sql
ALTER USER statement or the SET PASSWORD statement to change a password. FROM mysql.user WHERE authentication_ string = •• Host User -;
```

**Explanation:** Example SQL statement

### Example 3: SQL Example 3

**Difficulty:** Intermediate

**Scenario:** Basic data retrieval

```sql
select data from the General_Ledger_Accounts and Terms tables. Like jim, these users can connect from a computer on any host. Again, this is a security ris.k, but a hacker who can connect as john or jane has even fewer privileges and can do less damage. Chapter 18 How to secure a database A script that sets up the users and privileges for a database -- drop the users (remove IF EXISTS for MySQL 5.6 and earlier) DROP USER IF EXISTS john;
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

**Practice using backup-restore with the practice schemas.**

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
