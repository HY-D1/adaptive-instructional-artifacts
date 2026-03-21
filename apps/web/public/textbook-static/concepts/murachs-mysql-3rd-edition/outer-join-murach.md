---
id: outer-join-murach
title: Outer Join
definition: Left, right, and full outer joins in MySQL
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144]
chunkIds:
  - murachs-mysql-3rd-edition:p129:c1
  - murachs-mysql-3rd-edition:p129:c2
  - murachs-mysql-3rd-edition:p130:c1
  - murachs-mysql-3rd-edition:p130:c2
  - murachs-mysql-3rd-edition:p131:c1
  - murachs-mysql-3rd-edition:p131:c2
  - murachs-mysql-3rd-edition:p131:c3
  - murachs-mysql-3rd-edition:p132:c1
  - murachs-mysql-3rd-edition:p132:c2
  - murachs-mysql-3rd-edition:p133:c1
  - murachs-mysql-3rd-edition:p133:c2
  - murachs-mysql-3rd-edition:p134:c1
  - murachs-mysql-3rd-edition:p134:c2
  - murachs-mysql-3rd-edition:p134:c3
  - murachs-mysql-3rd-edition:p135:c1
  - murachs-mysql-3rd-edition:p135:c2
  - murachs-mysql-3rd-edition:p136:c1
  - murachs-mysql-3rd-edition:p136:c2
  - murachs-mysql-3rd-edition:p137:c1
  - murachs-mysql-3rd-edition:p137:c2
  - murachs-mysql-3rd-edition:p138:c1
  - murachs-mysql-3rd-edition:p138:c2
  - murachs-mysql-3rd-edition:p139:c1
  - murachs-mysql-3rd-edition:p139:c2
  - murachs-mysql-3rd-edition:p140:c1
  - murachs-mysql-3rd-edition:p141:c1
  - murachs-mysql-3rd-edition:p142:c1
  - murachs-mysql-3rd-edition:p142:c2
  - murachs-mysql-3rd-edition:p143:c1
  - murachs-mysql-3rd-edition:p144:c1
relatedConcepts:
tags:
  - mysql
  - joins
  - outer
sourceDocId: murachs-mysql-3rd-edition
---

# Outer Join

## Definition
Left, right, and full outer joins in MySQL

## Explanation
Chapter 3 How to retrieve data from a sin.gle table The expanded syntax of the LIMIT clause LIMIT [offset,] row_count A SELECT statement with a LIMIT clause that starts with the first row SELECT vendor_ id, invoice_ total FROM invoices ORDER BY invoice_total DESC LIMIT 5 vendorjd invoice_ total - ► 37966.19 26881.40 23517.58 21842.00 20551. 18 A SELECT statement with a LIMIT clause that starts with the third row SELECT invoice_ id, vendor_ id, invoice_ total FROM invoices ORDER BY invoice_ id LIMIT 2, 3 invoice id - vendor_id invoice total - - ► 138.75 144.70 15.50 A SELECT statement with a LIMIT clause that starts with the 101 st row SELECT invoice_ id, vendor_ id, invoice_total FROM invoices ORDER BY invoice id LIMIT 100, 1000 invoice id - vendor_id invoice_total - ► 30.75 20551.18 2051.59 44.44 (14 rows) Description • You can use the LIMIT clause to limit the number of rows returned by the SELECT statement. This clause takes one or two intege1 arguments. • If you code a single argument, it specifies the maximum row count,

clause to limit the number of rows returned by the SELECT statement. This clause takes one or two intege1 arguments. • If you code a single argument, it specifies the maximum row count, beginning with the first row. If you code both arguments, the offset specifies the first row to return, where the offset of the first row is 0. • If you want to retrieve all of the rows from a certain offset to the end of the result set, code -1 for the row count. • Typically, you'll use an ORDER BY clause whenever you use the LIMIT clause. How to code the LIMIT clause '

Perspective The goal of this chapter has been to teach you the basic skills for coding SELECT statements. As a result, you'll use these skills in almost every SELECT statement you code. As you'll see in the next chapter and in chapters 6 and 7, though, there's a lot more to coding SELECT statements than what's presented here. In these chapters, then, you'll learn additional skills for coding SE

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
*Source: murachs-mysql-3rd-edition, Pages 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144*
