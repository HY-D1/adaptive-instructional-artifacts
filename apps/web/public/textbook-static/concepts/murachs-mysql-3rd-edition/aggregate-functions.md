# Aggregate Functions

## Definition
Using COUNT, SUM, AVG, MAX, MIN to calculate summary values

## Explanation

80 vendors, many of these vendors don't have invoices. As a result, the UPDATE statement only affects 40 invoices. To execute the second UPDATE statement from MySQL Workbench, you have to turn safe update mode off. That's because the WHERE clause in this statement uses the IN operator.

Update all invoices for a vendor UPDATE invoices SET terms id= 1 WHERE vendor_ id = (SELECT vendor_ id FROM vendors Chapter 5 How to insert, update, and delete data 161 WHERE vendor_name = 'Pacific Bell' ) (6 rows affected) Update the terms for all invoices for vendors in three states UPDATE invoice s SET terms_ id = 1 WHERE vendor_ id IN (SELECT vendor_ id FROM vendors WHERE vendor_ state IN ( 'CA', 'AZ', 'NV' )) (40 rows affected) Description • You can code a subquery in the WHERE clause of an UPDATE statement to provide one 01 more values used in the search condition. Figure 5-6 How to use a subquery in an UPDATE statement

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