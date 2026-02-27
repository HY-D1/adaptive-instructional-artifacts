# The WHERE Clause

## Definition
How to filter rows using comparison operators, AND/OR, IN, BETWEEN, LIKE, and IS NULL

## Explanation

example shows how to use the DATE_FORMAT function to change the format used to display date values. This function requires two parameters. The first parameter is the date value to be formatted and the second is a format string that uses specific values as placeholders for the various parts of the date. The first column in this example renrrns the invoice_date column in the default MySQL date format, ''yyyy-mm-dd''. Since this format isn't used as often in the USA, the second column is formatted in the more typical ''mm/dd/yy'' format. In the third column, the invoice date is in another format that's commonly used. In chapter 9, you'll leait1 1nore about specifying the format string for the DATE_FORMAT function. The third example uses the ROUND function to round the value of the invoice total column to the nearest dollai and nearest dime. This function can - accept either one or

## Examples
### Example 1: SELECT Example
```sql
SELECT statement that uses the LEFT function SELECT vendor_ contact_ first_name, vendor_contact_ last_ name, CONCAT(LEFT(vendor_ contact_first_ namA, 1 ) , LEFT (vendor_ contact_ last_ namA, 1)) AS initials FROM vendors vendor _contact_first_name vendor contact last name initials - - - ► Francesco Alberto FA I Ania Irvin AI Lukas Liana LL (122 rows ) A SELECT statement that uses the DATE FORMAT function SELECT invoice_date, DATE_ FORMAT(invoice_date, •~oro/%d /%y') AS 'MM/ DD/YY', DATE_ FORMAT{invoice_date, ' %e-%b-%Y') AS 'DD-Mon-YYYY' FROM invoices ORDER BY invoice_date invoice_date ~ 2018-04-08 2018-04-10 I 20 18-04-13 (114 rows) MM/00/'(Y 04/08/18 04/10/18 04/ 13/18 DD-Mon-YYYY 8-Apr-2018 10--Apr-2018 13-Apr-2018 A SELECT statement that uses the ROUND function SELECT invoice_date, invoice_total, ROUND(invoice_ total) AS nearest_dollar, ROUND (invoice_ total, 1) AS nearest_dime FROM invoices ORDER BY invoice date I invoice_date invoice _total nearest_dollar nearest_dime ► 2018--04-08 3813.33 3813 3813.3 2018-04-10 40.20 40 40.2 2018-04-13 138.75 139 138.8 ( 114 rows ) Description

FROM invoices ORDER BY invoice date I invoice_date invoice _total nearest_dollar nearest_dime ► 2018--04-08 3813.33 3813 3813.3 2018-04-10 40.20 40 40.2 2018-04-13 138.75 139 138.8 ( 114 rows ) Description • When using the DATE_FORMAT function to specify the format of a date, you use the percent sign (%) to identify a format code. For example, a format code of m returns the month number with a leading zero if necessary. For more information about these codes, see chapter 9. • For more information about using functions, see chapter 9. Figure 3-7 How to use functions with strings, dates, and numbers I\ '-- V

figure 3-7. If you compare these statements, you'll see that the second and fourth examples simply replace the column specifications in figure 3-7 with literal values. The third example uses another function, CURRENT_DATE, to supply a date value in place of the invoice_date column that's coded in figure 3-7.

Chapter 3 How to retrieve datafrom a single table 89 Four SELECT statements without FROM clauses Example 1 : Testing a calculation SELECT 1000 * (1 + .1) AS 1110% More Than 1000" 10°/4 More Than 1000 ---I -- ► 1100.0 "'-~------;
```
Example SELECT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118*