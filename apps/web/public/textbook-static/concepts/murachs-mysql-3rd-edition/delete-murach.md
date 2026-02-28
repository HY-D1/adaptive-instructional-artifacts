# DELETE Statement

## Definition

The DELETE statement is used to remove rows from a table based on a specified condition.

## Explanation

The DELETE statement is essential for managing data integrity and cleaning up unnecessary records. It allows you to specify exactly which rows should be removed, ensuring that only the intended data is deleted. This is particularly useful in maintaining accurate and up-to-date databases.

## Examples

### Basic Usage

```sql
-- DELETE a single row FROM the 'employees' TABLE WHERE the employee ID is 101 DELETE FROM employees WHERE employee_id = 101;
```

This example demonstrates how to delete a specific row based on its unique identifier.

### Practical Example

```sql
-- DELETE all records FROM the 'temp_data' TABLE WHERE the date is older than one year DELETE FROM temp_data WHERE date_column < DATE_SUB(CURDATE(), INTERVAL 1 YEAR);
```

This practical example shows how DELETE can be used to clean up old data that's no longer needed.

## Common Mistakes

### Forgetting the WHERE clause

**Incorrect:**

```sql
-- Incorrectly deletes all rows FROM 'employees' DELETE FROM employees;
```

**Correct:**

```sql
-- Correctly deletes a specific row
DELETE FROM employees WHERE employee_id = 101;
```

**Why this happens:** This mistake can result in accidental deletion of all data in the table. Always include the WHERE clause to target specific rows.

### Using wildcards without caution

**Incorrect:**

```sql
-- Incorrectly deletes multiple rows due to wildcard usage
DELETE FROM employees WHERE department LIKE '%Sales%';
```

**Correct:**

```sql
-- Correctly deletes a single row using an exact match
DELETE FROM employees WHERE employee_id = 101;
```

**Why this happens:** Wildcards can lead to unintended deletions if not used carefully. Always ensure that your conditions are specific enough.

---

## Practice

**Question:** Write a DELETE statement to remove all records from the 'logs' table where the log level is 'DEBUG'.

**Solution:** -- Correct solution
DELETE FROM logs WHERE log_level = 'DEBUG';
Explanation: This statement will delete all rows in the 'logs' table where the log level column has the value 'DEBUG'.

---

*Source: Murach's MySQL 3rd Edition*