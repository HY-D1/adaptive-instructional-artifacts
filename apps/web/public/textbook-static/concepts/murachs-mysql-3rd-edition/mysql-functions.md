---
id: mysql-functions
title: MySQL Functions
definition: String, numeric, date/time, and conversion functions
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236]
chunkIds:
  - murachs-mysql-3rd-edition:p217:c1
  - murachs-mysql-3rd-edition:p217:c2
  - murachs-mysql-3rd-edition:p217:c3
  - murachs-mysql-3rd-edition:p218:c1
  - murachs-mysql-3rd-edition:p218:c2
  - murachs-mysql-3rd-edition:p219:c1
  - murachs-mysql-3rd-edition:p219:c2
  - murachs-mysql-3rd-edition:p220:c1
  - murachs-mysql-3rd-edition:p220:c2
  - murachs-mysql-3rd-edition:p221:c1
  - murachs-mysql-3rd-edition:p221:c2
  - murachs-mysql-3rd-edition:p222:c1
  - murachs-mysql-3rd-edition:p222:c2
  - murachs-mysql-3rd-edition:p222:c3
  - murachs-mysql-3rd-edition:p223:c1
  - murachs-mysql-3rd-edition:p223:c2
  - murachs-mysql-3rd-edition:p224:c1
  - murachs-mysql-3rd-edition:p224:c2
  - murachs-mysql-3rd-edition:p225:c1
  - murachs-mysql-3rd-edition:p225:c2
  - murachs-mysql-3rd-edition:p226:c1
  - murachs-mysql-3rd-edition:p227:c1
  - murachs-mysql-3rd-edition:p227:c2
  - murachs-mysql-3rd-edition:p228:c1
  - murachs-mysql-3rd-edition:p228:c2
  - murachs-mysql-3rd-edition:p228:c3
  - murachs-mysql-3rd-edition:p229:c1
  - murachs-mysql-3rd-edition:p229:c2
  - murachs-mysql-3rd-edition:p230:c1
  - murachs-mysql-3rd-edition:p231:c1
  - murachs-mysql-3rd-edition:p231:c2
  - murachs-mysql-3rd-edition:p232:c1
  - murachs-mysql-3rd-edition:p232:c2
  - murachs-mysql-3rd-edition:p232:c3
  - murachs-mysql-3rd-edition:p233:c1
  - murachs-mysql-3rd-edition:p233:c2
  - murachs-mysql-3rd-edition:p234:c1
  - murachs-mysql-3rd-edition:p234:c2
  - murachs-mysql-3rd-edition:p235:c1
  - murachs-mysql-3rd-edition:p236:c1
  - murachs-mysql-3rd-edition:p236:c2
relatedConcepts:
tags:
  - mysql
  - functions
  - utilities
sourceDocId: murachs-mysql-3rd-edition
---

# MySQL Functions

## Definition
String, numeric, date/time, and conversion functions

## Explanation
Chapter 6 How to code sum1ncary queries The sum of the line item amount columns in the Invoice Line Items table - - that have the same account_nu1nber Return only those rows where the count of line items is greater than 1. This sl1ould return 10 rows. Group the result set by the account_description column. Sort the resL1lt set in descending sequence by the sum of the line item a1nounts. 5. Modify the solution to exercise 4 so it returns only invoices dated in the second quarter of 2018 (April 1, 2018 to June 30, 2018). This should still return 10 rows but with some different line item counts for each vendor. Hint: Join to tlie Invoices table to code a secirch condition based on invoice_date. 6. Write a SELECT statement that answers this question: What is the total amount invoiced for each general ledger account nt1mber? Return these columns: The account number column fro1n the Invoice Line Items table - - - The sum of the line_item_amount columns from the Invoice_Line_Items table Use the WITH ROLLUP operator to include

Return these columns: The account number column fro1n the Invoice Line Items table - - - The sum of the line_item_amount columns from the Invoice_Line_Items table Use the WITH ROLLUP operator to include a row that gives the grand total. This should return 22 rows. 7. Write a SELECT statement that answers this question: Which vendors are being paid from more than one account? Return these columns: The vendor name colL1mn from the Vendors table The count of distinct general ledger accounts that apply to that vendor's • • 1nvo1ces This should return 2 rows. 8. Write a SELECT statement that answers this question: What are the last payment date and total amount due for each vendor with each terms id? Return these columns: The terms id column from the Invoices table The vendor id column from the Invoices table The last payment date for each combination of terms id and vendor id in the Invoices table The sum of the balance due (invoice_total - payment_total

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
*Source: murachs-mysql-3rd-edition, Pages 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236*
