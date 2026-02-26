# The HAVING Clause

## Definition
Filtering grouped results based on aggregate conditions

## Explanation
Chapter 6 How to code sum1ncary queries 177 A summary query that counts the number of invoices by vendor SELECT vendor_ id, COUNT(*) AS invoice_qty FROM invoices GROUP BY vendor_ id I vendor Jd lnvoice_Qty ► 34 2 37 3 48 1 72 2 (34 rows ) A summary query that calculates the number of invoices ""' Ice . - and the average invoice amount for the vendors in each state and city SELECT vendor_state, vendor_city, COUNT(*) AS invoice_qty, ROUND(AVG(invoice_total), 2) AS invoice_avg FROM invoices JOIN vendors ON invoices.vendor id= vendors.vendor id GROUP BY vendor_state, vendor_city ORDER BY vendor_state, vendor_city vendor _state vendor _city nvolce_qty inv01ce_avg - ► AZ. Phoenix 1 662.00 CA Fresno 19 1208.75 CA Los Angeles 1 503.20 CA Oxnard 3 188.00 (20 rows) A summary query that limits the groups to those with two or more invoices SELECT vendor_ state, vendor_city, COUNT(*) AS invoice_qty, ROUND(AVG(invoice_total), 2) AS invoice_avg FROM invoices JOIN vendors ON invoices.vendor_ id = vendors.vendor_id GROUP BY vendor_state, vendor_city HAVING COUNT(*) >= 2 ORDER BY vendor_state, vendor_city vendor state - - ► CA CA

AS invoice_avg FROM invoices JOIN vendors ON invoices.vendor_ id = vendors.vendor_id GROUP BY vendor_state, vendor_city HAVING COUNT(*) >= 2 ORDER BY vendor_state, vendor_city vendor state - - ► CA CA CA (12 rows) Description vendor_dty Fresno Oxnard Pasadena Sacramento invoice_Qty 111voice_avg 19 1208.75 3 188,00 5 196. 12 7 253.00 I\ 1-- \I • With MySQL 8.0.12 and earlier, the GROUP BY clause sorted the columns in ascending sequence by default. Then, to change the sort sequence, you could code the DESC keyword after the column name in the GROUP BY clause. In addition, to get your results faster, you cot1ld code an ORDER BY NULL clause to prevent MySQL from sorting the rows in the GROUP BY clause. • With MySQL 8.0.13 and later, the columns in a GROUP BY clause are no longer sorted by default, and you can't code the ASC or DESC keyword on this clause. Inste

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
*Source: murachs-mysql-3rd-edition, Pages 197, 198, 199, 200, 201*
