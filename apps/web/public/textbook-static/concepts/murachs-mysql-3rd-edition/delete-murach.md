---
id: delete-murach
title: DELETE Statement
definition: Removing rows with DELETE and DELETE JOIN
difficulty: beginner
estimatedReadTime: 5
pageReferences: [177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187]
chunkIds:
  - murachs-mysql-3rd-edition:p177:c1
  - murachs-mysql-3rd-edition:p177:c2
  - murachs-mysql-3rd-edition:p178:c1
  - murachs-mysql-3rd-edition:p178:c2
  - murachs-mysql-3rd-edition:p178:c3
  - murachs-mysql-3rd-edition:p179:c1
  - murachs-mysql-3rd-edition:p179:c2
  - murachs-mysql-3rd-edition:p180:c1
  - murachs-mysql-3rd-edition:p180:c2
  - murachs-mysql-3rd-edition:p181:c1
  - murachs-mysql-3rd-edition:p182:c1
  - murachs-mysql-3rd-edition:p182:c2
  - murachs-mysql-3rd-edition:p182:c3
  - murachs-mysql-3rd-edition:p183:c1
  - murachs-mysql-3rd-edition:p183:c2
  - murachs-mysql-3rd-edition:p184:c1
  - murachs-mysql-3rd-edition:p184:c2
  - murachs-mysql-3rd-edition:p185:c1
  - murachs-mysql-3rd-edition:p185:c2
  - murachs-mysql-3rd-edition:p187:c1
relatedConcepts:
tags:
  - mysql
  - dml
  - delete
sourceDocId: murachs-mysql-3rd-edition
---

# DELETE Statement

## Definition
Removing rows with DELETE and DELETE JOIN

## Explanation
Clzapter 5 How to insert, update, and delete data The syntax for using a subquery to insert one or more rows INSERT [INTO] table_ name [(column_ list)] select_statement Insert paid invoices into the lnvoice_Archive table INSERT INTO invoice_archive SELECT* FROM invoices WHERE invoice_ total - payment_total - credit_total = 0 (103 rows affected) The same statement with a column list INSERT INTO invoice archive (invoice_id, vendor_ id, invoice_number, invoice_total, credit_ total, payment_total, terms_id, invoice_date, invoice_due_date) SELECT invoice_ id, vendor_ id, invoice_number, invoice_ total, credit_ total, payment_total, terms_ id, invoice_date, invoice_due_date FROM invoices WHERE invoice total - payment_total - credit_total = 0 (103 rows affected) Description • A subquery is a SELECT statement that's coded within another SQL statement. • to insert rows selected from one or more tables into another table, you can code a subquery in place of the VALUES clause. Then, MySQL inserts the rows returned by the subquery into the target table. For this to work, the target table must already. exist. • The rules for working with a column list are the same as they are

the rows returned by the subquery into the target table. For this to work, the target table must already. exist. • The rules for working with a column list are the same as they are for any INSERT statement. How to use a subquery in an INSERT statement

How to update existing rows to modify the data in one or 1nore rows of a table, you use the UPDATE statement. Although most of the UPDATE statements you code will perform simple updates, you can also code more complex UPDATE statements that include subqueries if necessary. How to update rows statements include all three of the clauses shown here. The UPDATE clause names the table to be updated. The SET clause names the columns to be updated and the values to be assigned to those columns. And the WHERE clause specifies the condition a row must meet to be upda

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
*Source: murachs-mysql-3rd-edition, Pages 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187*
