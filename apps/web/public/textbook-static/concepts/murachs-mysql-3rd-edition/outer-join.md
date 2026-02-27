# Outer Joins

## Definition
Retrieving all rows from one table and matching rows from another (LEFT, RIGHT, FULL)

## Explanation

or left, table. Similarly, when you use a right outer join, the result set includes all the rows from the second, or right, table. The example in this figure illustrates a left outer join. Here, the Vendors table is joined with the Invoices table. In addition, the result set includes vendor rows even if no matching invoices are found. In that case, null values are returned for the columns in the Invoices table.

Chapter 4 How to retrieve data f rom two or m.ore tables 129 The explicit syntax for an outer join SELECT select_ list FROM table_ l {LEFTIRIGHT} [OUTER] JOIN table_ 2 ON join_condition_ l [{LEFTIRIGHT} [OUTER] JOIN table_ 3 ON join_condition_ 2] ... What outer joins do Joins of this type Retrieve unmatched rows from Left outer join Right outer join A left outer join The first (left) table The second (right) table SELECT vendor_ name, invoice_number, invoice_total FROM vendors LEFT JOIN invoices ON vendors.vendor_ id = invoices.vendor_id ORDER BY vendor_name _J vendor _name ► Abbey

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
*Source: murachs-mysql-3rd-edition, Pages 148, 149, 150, 151, 152, 153, 154, 155*