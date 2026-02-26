# The DELETE Statement

## Definition
Removing rows from a table using DELETE with WHERE clause

## Explanation
Clzapter 5 How to insert, update, and delete data 151 The syntax of the CREATE TABLE AS statement CREATE TABLE table_name AS select_ statement Create a complete copy of the Invoices table CREATE TABLE invoices_copy AS SELECT* FROM invoices Create a partial copy of the Invoices table CREATE TABLE old_ invoices AS SELECT* FROM invoices WHERE invoice_ total - payment_total - credit_total = 0 Create a table with summary rows from the Invoices table CREATE TABLE vendor_balances AS SELECT vendor_ id, SUM(invoice_total) AS sum_of_ invoices FROM invoices WHERE (invoice_total - payment_total - credit_total) <> 0 GROUP BY vendor_ id Delete a table DROP TABLE old invoices Description • You can use the CREATE TABLE AS statement to create a new table based on the result set defined by a SELECT state1nent. • Each column name in the SELECT clause must be unique. If you use calculated values in the select list, you 1nust name the column. • You can code the other clauses of the SELECT statement just as yo11 would for any other SELECT statement, inclucling grouping, aggregates, joins,

list, you 1nust name the column. • You can code the other clauses of the SELECT statement just as yo11 would for any other SELECT statement, inclucling grouping, aggregates, joins, and subqueries. • If you code the CREATE TABLE AS statement as shown above, the table you name must not exist. If it does, you must delete the table by using the DROP TABLE statement before you execute the CREATE TABLE AS statement. • When you use the CREATE TABLE AS state1nent to create a table, only the column definitions and data are copied. Definitions of primary keys, foreign keys, indexes, and so on are not included in the new table. Figure 5-1 How to create a table from a SELECT statement

152 Section 1 An introduction to MySQL How to insert new rows To add rows to a table, you use the INSERT statement. In most cases, you use this statement to add a single row to a table. However, you can also use it to add multiple r

## Examples
### Example 1
```sql
-- No specific example available in textbook
```
No example available for this concept.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 171, 172, 173, 174, 175, 176*
