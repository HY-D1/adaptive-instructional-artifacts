# UPDATE Statement

## Definition

The UPDATE statement is used to modify existing records in a database table. It allows you to change data without having to delete and reinsert rows.

## Explanation

The UPDATE statement solves the problem of changing data in an existing table efficiently. Here’s how it works step-by-step:
1. Identify the table that needs updating.
2. Specify the new values for the columns.
3. Define which records should be updated using a WHERE clause to target specific rows.

You use UPDATE when you need to change data in your database, such as correcting an error or adding new information.

## Examples

### Basic Usage

```sql
-- UPDATE a single column UPDATE employees SET salary = 50000 WHERE employee_id = 1;
```

This example updates the salary of an employee with ID 1 to $50,000.

### Practical Example

```sql
-- UPDATE multiple columns UPDATE orders SET status = 'Shipped', shipped_date = CURRENT_DATE WHERE order_id = 123;
```

This practical example updates the status and shipped date for an order with ID 123.

## Common Mistakes

### Forgetting the WHERE clause

**Incorrect:**

```sql
-- Incorrect: Updates all rows UPDATE employees SET salary = 50000;
```

**Correct:**

```sql
-- Correct: Updates specific row UPDATE employees SET salary = 50000 WHERE employee_id = 1;
```

**Why this happens:** Always include a WHERE clause to target the correct rows. Without it, all rows in the table will be updated.

---

## Practice

**Question:** Update the email address of a customer with ID 456 in the 'customers' table.

**Solution:** -- Solution: UPDATE customers SET email = 'newemail@example.com' WHERE customer_id = 456;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*