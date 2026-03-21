---
id: string-functions
title: String Functions
definition: CONCAT, SUBSTRING, LENGTH, TRIM, UPPER, LOWER, and more
difficulty: beginner
estimatedReadTime: 5
pageReferences: [218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228]
chunkIds:
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
relatedConcepts:
tags:
  - mysql
  - functions
  - string
sourceDocId: murachs-mysql-3rd-edition
---

# String Functions

## Definition
CONCAT, SUBSTRING, LENGTH, TRIM, UPPER, LOWER, and more

## Explanation
9. Write a SELECT statement that uses aggregate window functions to calculate the total due for all vendors and the total due for each vendor. Return these columns: The vendor id from the Invoices table The balance due (invoice_total - payment_total - credit_total) for each invoice in the Invoices table with a balance due greater than 0 The total balance due for all vendors in the Invoices table The total balance due for each vendor in the Invoices table Modify the column that contains the balance due £01 each vendor so it contains a cumulative total by balance due. This should return 11 rows. 10. Modify the solution to exercise 9 so it includes a column that calculates the average balance due for each vendor in the Invoices table. This column should contain a cumulative average by balance due. Modify the SELECT statement so it uses a named window for the last two aggregate window functions. 11. Write a SELECT statement that uses an aggregate window function to calculate a moving average of the sum of invoice totals. Return these

named window for the last two aggregate window functions. 11. Write a SELECT statement that uses an aggregate window function to calculate a moving average of the sum of invoice totals. Return these columns: The month of the invoice date from the Invoices table The sum of the invoice totals from the Invoices table The moving average of the invoice totals sorted by invoice month The result set should be grouped by invoice month and the frame for the moving average should include the current row plus tlu ee rows before the current row.

How to code subqueries Subqueries allow you to build queries that would be difficult or impossible to build otherwise. In chapter 5, you learned how to use them in INSERT, UPDATE, and DELETE statements. In this chapter, you'll learn how to use subqueries in SELECT statements. An introduction to subqueries.......................................... 200 Where to code subqueries...................................

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
*Source: murachs-mysql-3rd-edition, Pages 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228*
