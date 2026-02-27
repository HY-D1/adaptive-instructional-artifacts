# Views

## Definition

A view is like a virtual table that presents data from one or more tables based on a query. It allows you to simplify complex queries and provide a consistent interface for accessing data.

## Explanation

Views are incredibly useful in database management because they help simplify complex queries and provide a consistent interface for accessing data. Imagine you have a large database with many tables, and you frequently need to retrieve specific information from these tables. Instead of writing the same complex query every time, you can create a view that encapsulates this query. This way, whenever you need the data, you simply query the view, which makes your work much easier and reduces the chance for errors.

## Examples

### Basic Usage

```sql
-- Create a view that shows all invoices with their total amounts
CREATE VIEW invoice_totals AS SELECT invoice_id, invoice_number, invoice_total FROM invoices;
```

This example creates a view named `invoice_totals` that combines the `invoice_id`, `invoice_number`, and `invoice_total` columns from the `invoices` table. Now, whenever you need to see all invoices with their total amounts, you can simply query the `invoice_totals` view instead of writing the full query each time.

### Practical Example

```sql
-- Query the view to get a list of all invoices with their total amounts
SELECT * FROM invoice_totals;
```

This practical example shows how you can use the `invoice_totals` view to retrieve data. By querying the view, you don't need to remember or write the complex query that combines the necessary columns from the `invoices` table.

## Common Mistakes

### Forgetting to include the AS keyword when creating a view

**Incorrect:**

```sql
-- Incorrect syntax
CREATE VIEW invoice_totals SELECT invoice_id, invoice_number, invoice_total FROM invoices;
```

**Correct:**

```sql
-- Correct syntax
CREATE VIEW invoice_totals AS SELECT invoice_id, invoice_number, invoice_total FROM invoices;
```

**Why this happens:** This mistake happens when someone tries to create a view without using the `AS` keyword. The correct syntax is to use `CREATE VIEW view_name AS SELECT columns FROM table;`. Remembering to include the `AS` keyword is crucial for defining the view correctly.

---

## Practice

**Question:** Create a view that shows all customers who have made at least one purchase. The view should include the customer's name and email.

**Solution:** -- Create a view named 'active_customers'
CREATE VIEW active_customers AS SELECT c.customer_name, c.email FROM customers c JOIN orders o ON c.customer_id = o.customer_id;

---

*Source: Murach's MySQL 3rd Edition*