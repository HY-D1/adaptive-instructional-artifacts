# UPDATE Statement

## Definition

The UPDATE statement is used to modify existing records in a database table. It allows you to change data without having to delete and recreate rows.

## Explanation

The UPDATE statement solves the problem of needing to change data in an existing table without losing any other information. Here's how it works:
1. You specify which table you want to update.
2. You define a condition that identifies which rows should be updated.
3. You set new values for one or more columns in those rows.

For example, if you have a 'students' table and you need to change the grade of a student with ID 101, you would use an UPDATE statement like this:
UPDATE students SET grade = 'A' WHERE student_id = 101;
This changes only the grade for that specific student without affecting any other data in the table.

You should use the UPDATE statement when you need to make changes to existing records. Be careful not to update too many rows at once, as this can be time-consuming and may cause unintended side effects.

## Examples

### Basic Usage

```sql
UPDATE employees SET salary = salary * 1.10 WHERE department_id = 5;
```

This example updates the salary of all employees in department 5 by increasing it by 10%. The WHERE clause ensures that only relevant rows are affected.

### Practical Example

```sql
UPDATE inventory SET stock_level = stock_level - 1 WHERE product_id = 'P1234';
```

In a real-world scenario, this might be used to decrease the stock level of a specific product after it has been sold. The WHERE clause ensures that only the correct product is updated.

## Common Mistakes

### Forgetting the WHERE clause

**Incorrect:**

```sql
UPDATE employees SET salary = salary * 1.10;
```

**Correct:**

```sql
UPDATE employees SET salary = salary * 1.10 WHERE department_id = 5;
```

**Why this happens:** This mistake updates all rows in the table, which is usually not intended. Always include a WHERE clause to specify which rows should be updated.

---

## Practice

**Question:** Write an UPDATE statement that increases the price of all products in category 'Electronics' by 5%. Use a transaction to ensure data integrity.

**Solution:** BEGIN TRANSACTION;
UPDATE products SET price = price * 1.05 WHERE category = 'Electronics';
COMMIT;

---

*Source: Murach's MySQL 3rd Edition*