# Logical Operators

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand how to combine multiple conditions using AND, OR, and NOT
- Learn operator precedence and how to use parentheses for clarity
- Master writing complex filter conditions for precise data retrieval

## What is This?

**Logical operators** (AND, OR, NOT) combine multiple conditions in a WHERE clause.

They let you create precise filters when a single condition isn't enough. AND requires all conditions to be true, OR requires at least one to be true, and NOT reverses a condition. Real-world queries often need complex logic like "find active users over 25" or "orders that are pending OR high-value"—logical operators make this possible.

## Examples

### Example 1: Combining Conditions with AND

**Difficulty:** Beginner

**Scenario:** Find users from Seattle who are over 25 years old (for a targeted marketing campaign).

```sql
SELECT name, email, age, city
FROM users
WHERE city = 'Seattle' AND age > 25;
```

**Explanation:** The **AND** operator requires **both** conditions to be true. Only users who are both from Seattle AND older than 25 will be returned. If either condition is false, the row is excluded.

### Example 2: Combining Conditions with OR

**Difficulty:** Intermediate

**Scenario:** Find orders that are either for expensive items (over $100) or have 'Laptop' in the product name.

```sql
SELECT order_id, user_id, product, amount
FROM orders
WHERE amount > 100 OR product = 'Laptop';
```

**Explanation:** The **OR** operator returns rows where **either** condition is true (or both). This query finds high-value orders OR laptop orders—both types need attention from the fulfillment team.

### Example 3: Complex Conditions with AND, OR, and Parentheses

**Difficulty:** Intermediate

**Scenario:** Find products that are in the Electronics category with a price over $50, OR any product that costs more than $200 regardless of category.

```sql
SELECT name, category, price
FROM products
WHERE (category = 'Electronics' AND price > 50)
   OR price > 200;
```

**Explanation:** **Parentheses are crucial** here to control operator precedence. Without them, AND would be evaluated before OR, changing the logic completely. This query helps identify products to feature in promotions—either mid-range electronics OR premium items from any category.

## Common Mistakes

### Mistake 1: Misunderstanding AND vs OR Precedence

**Incorrect:**
```sql
SELECT * FROM users
WHERE city = 'Seattle' OR city = 'Portland' AND age < 18;
```

**Error Message:** `Query runs but returns unexpected results`

**Why it happens:** **AND has higher precedence than OR**, so this query returns: (users from Portland who are under 18) OR (users from Seattle of any age). The user likely wanted users from either city who are all 18+.

**Corrected:**
```sql
SELECT * FROM users
WHERE (city = 'Seattle' OR city = 'Portland') AND age >= 18;
```

💡 **Key Takeaway:** Always use parentheses when mixing AND and OR to make your intent explicit and prevent subtle logic errors.

### Mistake 2: Using AND When OR is Needed

**Incorrect:**
```sql
SELECT * FROM products
WHERE category = 'Electronics' AND category = 'Furniture';
```

**Error Message:** `Query runs but returns no results`

**Why it happens:** A product cannot be in two categories at once. The user wanted products in **EITHER** category, not products that are in **BOTH** categories simultaneously (which is impossible).

**Corrected:**
```sql
SELECT * FROM products
WHERE category = 'Electronics' OR category = 'Furniture';
```

💡 **Key Takeaway:** Use AND when ALL conditions must be true; use OR when ANY condition can be true. For "in one of these values," consider using IN: `WHERE category IN ('Electronics', 'Furniture')`.

---

## Practice Challenge

**Find all users who are either from Portland OR over age 30, but only if they have an email containing '@email.com'.**

💡 **Hint:** You'll need to combine OR with AND. Use parentheses to group the OR conditions together.

<details>
<summary>Click to see solution</summary>

```sql
SELECT * FROM users
WHERE (city = 'Portland' OR age > 30)
  AND email LIKE '%@email.com';
```

**Explanation:** The parentheses ensure we first find users from Portland OR over 30, then the AND filters to only those with matching email domains.
</details>

---

*Content generated for SQL-Adapt Learning Platform*
