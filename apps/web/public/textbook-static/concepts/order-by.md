# The ORDER BY Clause

🟢 **Difficulty:** Beginner  
⏱️ **Estimated Time:** 10 minutes

## Learning Objectives

- Sort query results in ascending and descending order
- Sort by multiple columns for fine-grained ordering
- Understand NULL handling in sorting

## What is This?

The **ORDER BY clause** sorts query results by one or more columns.

By default, it sorts in ascending order (A-Z, 0-9), but you can specify DESC for descending order (Z-A, 9-0). Without ORDER BY, databases return rows in an unpredictable order. Use it whenever the sequence matters to your application—alphabetical lists, newest records first, or highest values at the top.

## Examples

### Example 1: Basic Sorting (Ascending)

**Difficulty:** Beginner

**Scenario:** Display all users sorted alphabetically by name.

```sql
SELECT name, email, city
FROM users
ORDER BY name ASC;
```

**Explanation:** **ASC** (ascending) is the default, so it's optional. This query returns users in alphabetical order by name, making it easy to scan through the list.

### Example 2: Sorting in Descending Order

**Difficulty:** Beginner

**Scenario:** Show orders from highest amount to lowest to see your biggest sales first.

```sql
SELECT order_id, user_id, product, amount
FROM orders
ORDER BY amount DESC;
```

**Explanation:** **DESC** sorts in descending order. This is commonly used for amounts (highest first) or IDs (newest first). For financial data, you typically want the largest values at the top.

### Example 3: Sorting by Multiple Columns

**Difficulty:** Intermediate

**Scenario:** Sort products by category first, then by price within each category (highest price first).

```sql
SELECT name, category, price
FROM products
ORDER BY category ASC, price DESC;
```

**Explanation:** When sorting by multiple columns, the results are sorted by the first column, then the second column is used to break ties. This query groups products by category and shows the most expensive items first within each category.

## Common Mistakes

### Mistake 1: Referencing Column Aliases in the Wrong Place

**Incorrect:**
```sql
SELECT name, price * 0.9 AS discounted_price
FROM products
WHERE discounted_price < 50
ORDER BY discounted_price;
```

**Error Message:** `Error: no such column: discounted_price`

**Why it happens:** Column aliases defined in SELECT cannot be used in WHERE clauses (they don't exist yet when WHERE is evaluated), but they CAN be used in ORDER BY. The user tried to use it in WHERE.

**Corrected:**
```sql
SELECT name, price * 0.9 AS discounted_price
FROM products
WHERE price * 0.9 < 50
ORDER BY discounted_price;
```

💡 **Key Takeaway:** Column aliases can be used in ORDER BY, but not in WHERE. In WHERE, repeat the original expression or use a subquery.

### Mistake 2: Forgetting NULLs Sort Differently

**Incorrect:**
```sql
SELECT name, email, city
FROM users
ORDER BY city DESC;
```

**Error Message:** `No error, but NULL cities appear first unexpectedly`

**Why it happens:** In SQLite, NULL values sort first in ascending order and last in descending order. If you want NULLs at the end regardless of sort direction, you need to handle them explicitly.

**Corrected:**
```sql
SELECT name, email, city
FROM users
ORDER BY city IS NULL, city DESC;
```

**Explanation:** `city IS NULL` returns 1 for NULL values and 0 for non-NULL, so NULLs are sorted after non-NULLs. Then the second sort key (city DESC) orders the non-NULL values.

💡 **Key Takeaway:** NULL sorting behavior varies by database. In SQLite, use `column IS NULL` as a sort key to control NULL placement explicitly.

---

## Practice Challenge

**Select all products, sorted by category (A-Z), then by price from lowest to highest within each category.**

💡 **Hint:** Use two columns in your ORDER BY clause. ASC is the default, so you don't need to specify it.

<details>
<summary>Click to see solution</summary>

```sql
SELECT name, category, price
FROM products
ORDER BY category, price;
```

**Explanation:** This sorts first by category alphabetically, then within each category, products are sorted by price from lowest to highest.
</details>

---

*Content generated for SQL-Adapt Learning Platform*
