# Views

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand the Views concept in SQL

## What is This?

Views is an important SQL concept for working with databases.

## Examples

### Example 1: SQL Example 1

**Difficulty:** Beginner

**Scenario:** Basic data retrieval

```sql
create databases, tables, and indexes The SQL script that creates the AP database CREATE TABLE (• • orders invoice_ id vendor_ id invoice_number invoice_date invoice_ total payment_ total credit_ total INT PRIMARY KEY);
```

**Explanation:** Example SQL statement

### Example 2: SQL Example 2

**Difficulty:** Beginner

**Scenario:** Basic data retrieval

```sql
create an index CREATE INDEX invoices_ orders date ix ON orders (invoice_date DESC);
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

**Practice using views with the practice schemas.**

💡 **Hint:** Review the examples above and try writing your own query.

<details>
<summary>Click to see solution</summary>

```sql
SELECT * FROM users LIMIT 5;
```

**Explanation:** This is a basic query to get you started. See the linked practice problems for more challenges.
</details>

## Related Practice Problems

- [problem-37](/practice/problem-37)

---

*Content generated for SQL-Adapt Learning Platform*
