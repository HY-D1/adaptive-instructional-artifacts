# ORDER BY Clause

## Definition

The ORDER BY clause is used to sort the results of a query in ascending or descending order based on one or more columns.

## Explanation

The ORDER BY clause is essential for organizing data in a meaningful way after retrieving it from a database. It allows you to control the sequence in which rows are displayed, making it easier to analyze and understand the data. By default, ORDER BY sorts data in ascending order (A-Z, 0-9). However, you can specify descending order by using the DESC keyword.

## Examples

### Basic Usage

```sql
SELECT invoice_number, invoice_date FROM invoices ORDER BY invoice_date;
```

This example sorts all invoices by their date in ascending order. The result will show the oldest invoices first.

### Practical Example

```sql
SELECT product_name, price FROM products ORDER BY price DESC LIMIT 5;
```

This practical example retrieves the top 5 most expensive products by sorting them in descending order based on their prices. This helps quickly identify the highest-priced items.

## Common Mistakes

### Forgetting to specify column names

**Incorrect:**

```sql
SELECT invoice_number, invoice_date FROM invoices ORDER BY;
```

**Correct:**

```sql
SELECT invoice_number, invoice_date FROM invoices ORDER BY invoice_date;
```

**Why this happens:** This mistake occurs when the ORDER BY clause is used without specifying any columns. It results in an error because MySQL doesn't know what to sort by.

### Using DESC for ascending order

**Incorrect:**

```sql
SELECT product_name, price FROM products ORDER BY price DESC;
```

**Correct:**

```sql
SELECT product_name, price FROM products ORDER BY price ASC;
```

**Why this happens:** This mistake happens when the DESC keyword is used instead of ASC to sort in ascending order. It results in the data being sorted in descending order.

---

## Practice

**Question:** Write a SQL query that retrieves all employees from the 'employees' table, sorted by their hire date in descending order.

**Solution:** SELECT employee_name, hire_date FROM employees ORDER BY hire_date DESC;

---

*Source: Murach's MySQL 3rd Edition*