# DELETE Statement

## Definition

The DELETE statement is used to remove rows from a table in a database.

## Explanation

The DELETE statement is essential for managing data in a database by allowing you to remove unwanted records. It's crucial when you need to clean up old or incorrect data, or prepare the database for new entries. Here’s how it works:

1. **Identify the Rows**: You specify which rows should be deleted using a WHERE clause that filters based on conditions.
2. **Execute the Command**: The DELETE statement is executed, and the matching rows are removed from the table.

**When to Use It**: Whenever you need to remove data from your database that is no longer needed or is incorrect. For example, deleting old sales records or removing duplicate entries.

**Key Things to Remember**:
- Always use a WHERE clause to avoid accidentally deleting all rows in the table.
- Be cautious when using wildcards in the WHERE clause as they can match more than intended.
- Test your DELETE statement on a small subset of data before running it on the entire table.

## Examples

### Basic Usage

```sql
DELETE FROM employees WHERE employee_id = 101;
```

This example deletes a single row from the 'employees' table where the 'employee_id' is 101.

### Practical Example

```sql
DELETE FROM orders WHERE order_date < '2020-01-01';
```

This practical example deletes all orders from the 'orders' table that are older than January 1, 2020.

## Common Mistakes

### Forgetting the WHERE clause

**Incorrect:**

```sql
DELETE FROM employees;
```

**Correct:**

```sql
DELETE FROM employees WHERE employee_id = 101;
```

**Why this happens:** This mistake deletes all rows in the 'employees' table. Always include a WHERE clause to specify which rows should be deleted.

### Using wildcards without intention

**Incorrect:**

```sql
DELETE FROM employees WHERE department LIKE '%Sales%';
```

**Correct:**

```sql
DELETE FROM employees WHERE department = 'Sales';
```

**Why this happens:** This mistake deletes all employees in departments that contain the word 'Sales'. Use specific conditions to avoid unintended deletions.

---

## Practice

**Question:** Write a DELETE statement to remove all customers from the 'customers' table who have not made any purchases in the last year.

**Solution:** DELETE FROM customers WHERE last_purchase_date < DATE_SUB(CURDATE(), INTERVAL 1 YEAR);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*