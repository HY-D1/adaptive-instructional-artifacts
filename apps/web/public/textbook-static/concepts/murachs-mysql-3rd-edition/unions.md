# UNION and UNION ALL

## Definition

UNION and UNION ALL are SQL operators used to combine the results of two or more SELECT statements into a single result set.

## Explanation

UNION combines the results of multiple SELECT queries, removing duplicate rows from the final output. UNION ALL includes all rows from each query, including duplicates. This is useful when you need to aggregate data from different tables or conditions without manually merging them in your application code.

## Examples

### Basic Usage

```sql
-- Combining results FROM two tables SELECT name FROM employees UNION SELECT name FROM contractors;
```

This example combines the names of all employees and contractors into one list, removing any duplicate names.

### Practical Example

```sql
-- Finding customers who have made both online AND in-store purchases SELECT customer_id FROM online_orders UNION SELECT customer_id FROM store_sales;
```

This practical example identifies customers who have purchased items both online and in-store, using UNION to combine the results from two different tables.

## Common Mistakes

### Forgetting to use ORDER BY at the end of all UNION statements

**Incorrect:**

```sql
-- Incorrect usage SELECT name FROM employees UNION SELECT name FROM contractors;
```

**Correct:**

```sql
-- Correct usage SELECT name FROM employees UNION SELECT name FROM contractors ORDER BY name;
```

**Why this happens:** Students often forget to include ORDER BY at the end, which can lead to errors or unexpected results. Always ensure it's placed correctly if sorting is needed.

### Using UNION when UNION ALL would suffice

**Incorrect:**

```sql
-- Incorrect usage SELECT name FROM employees UNION SELECT name FROM contractors;
```

**Correct:**

```sql
-- Correct usage SELECT name FROM employees UNION ALL SELECT name FROM contractors;
```

**Why this happens:** Using UNION when duplicates are not a concern can lead to unnecessary performance overhead. Always choose the most efficient option based on your needs.

---

## Practice

**Question:** Write a SQL query using UNION to combine results from two tables, one containing customer names and email addresses, and another containing customer names and phone numbers.

**Solution:** -- Solution
SELECT name, email FROM customers_email
UNION
SELECT name, phone_number FROM customers_phone;
-- This query combines the names and contact information (email or phone) of all customers into a single result set.

---

*Source: Murach's MySQL 3rd Edition*