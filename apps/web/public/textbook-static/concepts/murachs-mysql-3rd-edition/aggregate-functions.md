# Aggregate Functions

## Definition
Using COUNT, SUM, AVG, MAX, MIN to calculate summary values

## Explanation
160 Section 1 An introduction to MySQL How to use a subquery in an UPDATE statement When you code the search condition on the WHERE clause of an UPDATE statement, you can include a subquery to identify the rows to be updated. FigUI·e 5-6 presents two statements that ill11strate how you do that. In the frrst statement, a subquery is used in the WHERE clause to identify the invoices to be updated. This subquery returns the vendor_id value for the vendor in the Vendors table with the name ''Pacific Bell." Then, all the invoices with that vendor_id value are updated. The second UPDATE statement also uses a subquery in the WHERE clause. This subquery returns a list of the vendor_id values for all vendors in Califorrtia, Arizona, and Nevada. Then, the IN operator is used to update all the invoices with vendor_id values in that list. Although this subquery returns 80 vendors, many of these vendors don't have invoices. As a result, the UPDATE statement only affects 40 invoices. To execute the second UPDATE statement from MySQL Workbench, you have

80 vendors, many of these vendors don't have invoices. As a result, the UPDATE statement only affects 40 invoices. To execute the second UPDATE statement from MySQL Workbench, you have to turn safe update mode off. That's because the WHERE clause in this statement uses the IN operator.

Update all invoices for a vendor UPDATE invoices SET terms id= 1 WHERE vendor_ id = (SELECT vendor_ id FROM vendors Clzapter 5 How to insert, update, and delete data 161 WHERE vendor_name = 'Pacific Bell' ) (6 rows affected) Update the terms for all invoices for vendors in three states UPDATE invoice s SET terms_ id = 1 WHERE vendor_ id IN (SELECT vendor_ id FROM vendors WHERE vendor_ state IN ( 'CA', 'AZ', 'NV' )) (40 rows affected) Description • You can code a subquery in the WHERE clause of an UPDATE statement to provide one 01· more values used in the search condition. Figure 5-6 How to use a subquery in an UPDATE statement

162 Section 1 An in

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
*Source: murachs-mysql-3rd-edition, Pages 180, 181, 182, 183, 184, 185, 186, 187, 188*
