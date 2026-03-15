---
id: insert-murach
title: INSERT Statement
definition: Adding rows to tables with INSERT INTO and INSERT SELECT
difficulty: beginner
estimatedReadTime: 5
pageReferences: [149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166]
chunkIds:
  - murachs-mysql-3rd-edition:p149:c1
  - murachs-mysql-3rd-edition:p149:c2
  - murachs-mysql-3rd-edition:p150:c1
  - murachs-mysql-3rd-edition:p150:c2
  - murachs-mysql-3rd-edition:p150:c3
  - murachs-mysql-3rd-edition:p150:c4
  - murachs-mysql-3rd-edition:p151:c1
  - murachs-mysql-3rd-edition:p152:c1
  - murachs-mysql-3rd-edition:p153:c1
  - murachs-mysql-3rd-edition:p153:c2
  - murachs-mysql-3rd-edition:p154:c1
  - murachs-mysql-3rd-edition:p154:c2
  - murachs-mysql-3rd-edition:p154:c3
  - murachs-mysql-3rd-edition:p155:c1
  - murachs-mysql-3rd-edition:p155:c2
  - murachs-mysql-3rd-edition:p156:c1
  - murachs-mysql-3rd-edition:p156:c2
  - murachs-mysql-3rd-edition:p157:c1
  - murachs-mysql-3rd-edition:p157:c2
  - murachs-mysql-3rd-edition:p158:c1
  - murachs-mysql-3rd-edition:p158:c2
  - murachs-mysql-3rd-edition:p159:c1
  - murachs-mysql-3rd-edition:p160:c1
  - murachs-mysql-3rd-edition:p160:c2
  - murachs-mysql-3rd-edition:p160:c3
  - murachs-mysql-3rd-edition:p161:c1
  - murachs-mysql-3rd-edition:p161:c2
  - murachs-mysql-3rd-edition:p162:c1
  - murachs-mysql-3rd-edition:p162:c2
  - murachs-mysql-3rd-edition:p163:c1
  - murachs-mysql-3rd-edition:p163:c2
  - murachs-mysql-3rd-edition:p164:c1
  - murachs-mysql-3rd-edition:p164:c2
  - murachs-mysql-3rd-edition:p165:c1
  - murachs-mysql-3rd-edition:p166:c1
  - murachs-mysql-3rd-edition:p166:c2
relatedConcepts:
tags:
  - mysql
  - dml
  - insert
sourceDocId: murachs-mysql-3rd-edition
---

# INSERT Statement

## Definition
Adding rows to tables with INSERT INTO and INSERT SELECT

## Explanation
Chapter 4 How to retrieve data f rom two or m.ore tables The explicit syntax for an outer join SELECT select_ list FROM table_ l {LEFTIRIGHT} [OUTER] JOIN table_ 2 ON join_condition_ l [{LEFTIRIGHT} [OUTER] JOIN table_ 3 ON join_condition_ 2]... What outer joins do Joins of this type Retrieve unmatched rows from Left outer join Right outer join A left outer join The first (left) table The second (right) table SELECT vendor_ name, invoice_number, invoice_total FROM vendors LEFT JOIN invoices ON vendors.vendor_ id = invoices.vendor_id ORDER BY vendor_name _J vendor _name ► Abbey Office Furnishings American Booksellers Assoc American Express - ASCSigns I Ase.om Hasler Mailing Systems (202 rows) Description invoice_number nvoice_total 203339-13 17.50 l)QJ!t '®'' HWSI UPJII OPill Ul9!1 l:tt!I • An outer join 1 etrieves all rows that satisfy the join condition, plus unmatched rows in the left or right table. • In most cases, you use the equal operator to retrieve rows with matching columns. However, you can also use any of the other comparison operators. • When a row with unmatched columns is retrieved, any

cases, you use the equal operator to retrieve rows with matching columns. However, you can also use any of the other comparison operators. • When a row with unmatched columns is retrieved, any columns from the other table that are included in the result set are given null values. Note • The OUTER keyword is optional and typically omitted. How to code an outer join

Outer join examples to give yot1 a better understanding of how outer joins work, shows four more examples. to start, part 1 of this figure shows the Departments table, the Employees table, and the Projects table from the EX database. These tables are used by the examples shown in parts 2 and 3 of this figure. In addition, they're used in other examples later in this chapter. The first example performs a left outer join on the Departments and Employees tables. Here, the join condition joins the tables based 

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
*Source: murachs-mysql-3rd-edition, Pages 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166*
