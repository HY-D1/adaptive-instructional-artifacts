# MySQL Functions

## Definition

MySQL functions are pre-defined routines that perform specific operations on data. They help simplify complex queries and make your database more efficient.

## Explanation

MySQL functions are essential for performing calculations, manipulating text, and handling dates and times directly within SQL queries without needing to write additional programming code. These functions can be grouped into several categories: arithmetic, string, date and time, and aggregate functions. Understanding how to use these functions correctly is crucial for writing efficient and powerful SQL queries.

## Examples

### Basic Usage of an Aggregate Function

```sql
-- Calculate the total amount invoiced for each account
SELECT account_number, SUM(line_item_amount) AS total_amount FROM Invoice_Line_Items GROUP BY account_number;
```

This example demonstrates how to use the SUM function to calculate the total line item amount for each account number. The results are grouped by account number.

### Practical Example: Using a String Function

```sql
-- Concatenate vendor name and account description
SELECT CONCAT(vendor_name, ' - ', account_description) AS vendor_info FROM Vendors JOIN Invoice_Line_Items ON Vendors.account_number = Invoice_Line_Items.account_number;
```

This practical example shows how to use the CONCAT function to combine vendor name and account description into a single column. It joins two tables based on account number.

## Common Mistakes

### Incorrectly using aggregate functions without grouping

**Incorrect:**

```sql
-- This will cause an error
SELECT SUM(line_item_amount) FROM Invoice_Line_Items;
```

**Correct:**

```sql
-- Correct usage with GROUP BY
SELECT account_number, SUM(line_item_amount) AS total_amount FROM Invoice_Line_Items GROUP BY account_number;
```

**Why this happens:** Aggregates like SUM and AVG require a GROUP BY clause to operate on each group of rows. Failing to include it will result in an error.

### Forgetting to use parentheses with functions

**Incorrect:**

```sql
-- This will cause an error
SELECT SUBSTRING(vendor_name, 1, 3) vendor_name FROM Vendors;
```

**Correct:**

```sql
-- Correct usage with parentheses
SELECT SUBSTRING(vendor_name, 1, 3) AS vendor_name FROM Vendors;
```

**Why this happens:** Parentheses are necessary to define the arguments for functions. Forgetting them can lead to syntax errors.

---

## Practice

**Question:** Write a query that calculates the average invoice total for each quarter of 2018.

**Solution:** -- Calculate average invoice total per quarter
SELECT QUARTER(invoice_date) AS quarter, AVG(invoice_total) AS avg_total FROM Invoices WHERE YEAR(invoice_date) = 2018 GROUP BY quarter;

---

*Source: Murach's MySQL 3rd Edition*