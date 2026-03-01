# The UPDATE Statement

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Modify existing data using UPDATE statements
- Use WHERE clauses to target specific rows
- Update multiple columns in a single statement

## What is This?

The **UPDATE statement** modifies existing rows in a database table.

Without a WHERE clause, it affects **ALL rows**—so always double-check your WHERE clause! Use UPDATE when you need to change existing data, such as correcting a typo, updating a user's email address, applying a price change, or changing an order status. It's one of the most powerful but potentially dangerous SQL commands because mistakes can affect thousands of rows instantly.

## Examples

### Example 1: Updating a Single Row

**Difficulty:** Beginner

**Scenario:** Change a user's email address after they updated their account.

```sql
UPDATE users
SET email = 'newemail@example.com'
WHERE id = 5;
```

**Explanation:** The WHERE clause ensures only the user with id=5 is updated. Always use a primary key in the WHERE clause when updating a single row to avoid accidentally affecting other records.

### Example 2: Updating Multiple Columns

**Difficulty:** Intermediate

**Scenario:** Update a user's city and age after they moved and had a birthday.

```sql
UPDATE users
SET city = 'San Francisco',
    age = 31
WHERE id = 2;
```

**Explanation:** Multiple columns are separated by commas. This is more efficient than separate UPDATE statements and ensures both changes happen atomically (together).

### Example 3: Updating Based on a Calculation

**Difficulty:** Intermediate

**Scenario:** Apply a 10% discount to all Electronics products.

```sql
UPDATE products
SET price = price * 0.9
WHERE category = 'Electronics';
```

**Explanation:** You can use expressions in SET clauses. This reduces all Electronics prices by 10%. The calculation uses the current value of the column to compute the new value.

## Common Mistakes

### Mistake 1: Forgetting the WHERE Clause

**Incorrect:**
```sql
UPDATE users
SET status = 'inactive';
```

**Error Message:** `Query executes successfully: 150 rows affected`

**Why it happens:** Without a WHERE clause, UPDATE affects **EVERY row** in the table. This accidentally deactivated ALL users instead of just one.

**Corrected:**
```sql
UPDATE users
SET status = 'inactive'
WHERE id = 42;
```

💡 **Key Takeaway:** Always write the WHERE clause first when constructing an UPDATE. Test your WHERE clause with a SELECT statement before running the UPDATE: `SELECT * FROM users WHERE id = 42;`

### Mistake 2: Updating with Incorrect Subquery Logic

**Incorrect:**
```sql
UPDATE orders
SET product = 'Premium Laptop'
WHERE user_id = (SELECT id FROM users WHERE city = 'Seattle');
```

**Error Message:** `Error: subquery returns more than one row`

**Why it happens:** The subquery returns multiple user IDs (all users from Seattle), but the single-value comparison (=) can only handle one result. You need IN for multiple values.

**Corrected:**
```sql
UPDATE orders
SET product = 'Premium Laptop'
WHERE user_id IN (SELECT id FROM users WHERE city = 'Seattle');
```

💡 **Key Takeaway:** Use = when the subquery returns exactly one row. Use IN when the subquery might return multiple rows. Always test your subquery independently first.

---

## Practice Challenge

**Increase the price of all products in the 'Furniture' category by 15%.**

💡 **Hint:** Multiply the current price by 1.15 to add 15%. Remember to use a WHERE clause!

<details>
<summary>Click to see solution</summary>

```sql
UPDATE products
SET price = price * 1.15
WHERE category = 'Furniture';
```

**Explanation:** This multiplies each Furniture product's price by 1.15 (adding 15%). The WHERE clause ensures only Furniture items are affected.
</details>

---

*Content generated for SQL-Adapt Learning Platform*
