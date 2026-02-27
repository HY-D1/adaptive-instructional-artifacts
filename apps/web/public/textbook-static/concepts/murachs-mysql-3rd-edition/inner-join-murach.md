# Inner Join

## Definition

An Inner Join is a type of join operation that returns rows from two tables where there is a match between their common columns. It's essential for combining data from multiple tables based on related information.

## Explanation

Imagine you have two tables: one with vendor details (VendorID, VendorName) and another with invoice details (InvoiceID, VendorID, InvoiceDate). An Inner Join allows you to combine these tables so that you can see the vendor name along with their invoices. This is particularly useful when you need to analyze data from multiple sources that are related through a common attribute.

## Examples

### Basic Usage

```sql
-- Joining two tables on a common column
SELECT V.VendorName, I.InvoiceDate
FROM Vendors AS V
INNER JOIN Invoices AS I ON V.VendorID = I.VendorID;
```

This example joins the Vendors and Invoices tables based on the VendorID column. It returns the vendor name and invoice date for each matching record.

### Practical Example

```sql
-- Finding all invoices FROM a specific vendor SELECT I.InvoiceID, I.InvoiceDate FROM Invoices AS I INNER JOIN Vendors AS V ON I.VendorID = V.VendorID WHERE V.VendorName = 'ABC Corp';
```

This practical example demonstrates how to find all invoices for a specific vendor by joining the Invoices and Vendors tables and filtering by the vendor name.

## Common Mistakes

### Using the wrong column names in the join condition

**Incorrect:**

```sql
-- Incorrect join condition
SELECT V.VendorName, I.InvoiceDate
FROM Vendors AS V
INNER JOIN Invoices AS I ON V.VendorID = I.CustomerID;
```

**Correct:**

```sql
-- Correct join condition
SELECT V.VendorName, I.InvoiceDate
FROM Vendors AS V
INNER JOIN Invoices AS I ON V.VendorID = I.VendorID;
```

**Why this happens:** This mistake occurs when the column names used in the join condition do not match between tables. Always double-check that you're using the correct column names.

---

## Practice

**Question:** Write an SQL query to find all customers who have made at least one order from a specific vendor, given the VendorID of the vendor.

**Solution:** -- Solution
SELECT C.CustomerName
FROM Customers AS C
INNER JOIN Orders AS O ON C.CustomerID = O.CustomerID
WHERE O.VendorID = 123;

---

*Source: Murach's MySQL 3rd Edition*