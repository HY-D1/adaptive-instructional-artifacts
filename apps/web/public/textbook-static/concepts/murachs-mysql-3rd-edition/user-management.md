# User Management

## Definition

A stored procedure or function is a precompiled block of SQL code that can be executed by its name. They help organize complex operations and make database interactions more efficient and secure.

## Explanation

Stored procedures and functions are essential tools for managing and manipulating data in a database. They solve the problem of repetitive tasks by allowing you to write a set of instructions once and execute them multiple times. Here’s how they work:
1. **Definition**: You define a stored procedure or function with a name, parameters (if any), and SQL code that performs specific operations.
2. **Execution**: Once defined, you can call this procedure or function by its name, passing the required parameters if any. This execution is handled by the database server, which optimizes performance.
3. **Usage**: They are particularly useful for tasks like data validation, complex calculations, and batch processing. For example, calculating a balance due based on invoice details.
4. **Key Points**:
   - **Determinism**: Functions must be deterministic or non-deterministic (default). Deterministic functions always return the same result for the same input, which is crucial for binary logging.
   - **Security**: Stored procedures can enhance security by limiting what users can do directly on the database. They also help prevent SQL injection attacks.
   - **Performance**: By precompiling and caching SQL code, stored procedures can improve performance compared to executing dynamic SQL statements repeatedly.
   - **Maintenance**: Changes made in a single location (the procedure or function) affect all places where it is called, reducing the risk of errors.

## Examples

### Basic Usage

```sql
DELIMITER //
CREATE FUNCTION rand_int ()
RETURNS INT
NOT DETERMINISTIC
NO SQL
BEGIN
RETURN ROUND (RAND () * 1000);
END//
SELECT rand_int () AS random_number;
```

This example creates a function that returns a random integer between 0 and 1000. It then calls this function to get a random number.

### Practical Example

```sql
DELIMITER //
CREATE FUNCTION get_balance_due (invoice_id_param INT)
RETURNS DECIMAL(9,2)
DETERMINISTIC READS SQL DATA
BEGIN
DECLARE balance_due_var DECIMAL(9,2);
SELECT invoice_total - payment_total - credit_total INTO balance_due_var FROM invoices WHERE invoice_id = invoice_id_param;
RETURN balance_due_var;
END//
SELECT vendor_id, invoice_number, get_balance_due(invoice_id) AS balance_due FROM invoices WHERE vendor_id = 37;
```

This practical example creates a function to calculate the balance due for a given invoice ID. It then selects vendor ID, invoice number, and the calculated balance due from the invoices table where the vendor ID is 37.

## Common Mistakes

### Forgetting to declare variables

**Incorrect:**

```sql
DELIMITER //
CREATE FUNCTION get_balance_due (invoice_id_param INT)
RETURNS DECIMAL(9,2)
DETERMINISTIC READS SQL DATA
BEGIN
SELECT invoice_total - payment_total - credit_total INTO balance_due_var FROM invoices WHERE invoice_id = invoice_id_param;
RETURN balance_due_var;
END//
```

**Correct:**

```sql
DELIMITER //
CREATE FUNCTION get_balance_due (invoice_id_param INT)
RETURNS DECIMAL(9,2)
DETERMINISTIC READS SQL DATA
BEGIN
DECLARE balance_due_var DECIMAL(9,2);
SELECT invoice_total - payment_total - credit_total INTO balance_due_var FROM invoices WHERE invoice_id = invoice_id_param;
RETURN balance_due_var;
END//
```

**Why this happens:** This mistake occurs when you forget to declare the variable before using it. Always declare all variables used in your function.

---

## Practice

**Question:** Create a stored procedure that calculates the total sales for each product category.

**Solution:** DELIMITER //
CREATE PROCEDURE get_total_sales_by_category()
BEGIN
SELECT category, SUM(sales) AS total_sales FROM products GROUP BY category;
END//
call get_total_sales_by_category();

---

*Source: Murach's MySQL 3rd Edition*