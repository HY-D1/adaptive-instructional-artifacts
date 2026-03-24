---
id: inner-join-murach
title: Inner Join
definition: Matching rows from two or more tables
difficulty: beginner
estimatedReadTime: 5
pageReferences: [117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128]
chunkIds:
  - murachs-mysql-3rd-edition:p117:c1
  - murachs-mysql-3rd-edition:p117:c2
  - murachs-mysql-3rd-edition:p118:c1
  - murachs-mysql-3rd-edition:p118:c2
  - murachs-mysql-3rd-edition:p119:c1
  - murachs-mysql-3rd-edition:p119:c2
  - murachs-mysql-3rd-edition:p120:c1
  - murachs-mysql-3rd-edition:p120:c2
  - murachs-mysql-3rd-edition:p120:c3
  - murachs-mysql-3rd-edition:p120:c4
  - murachs-mysql-3rd-edition:p121:c1
  - murachs-mysql-3rd-edition:p121:c2
  - murachs-mysql-3rd-edition:p121:c3
  - murachs-mysql-3rd-edition:p122:c1
  - murachs-mysql-3rd-edition:p122:c2
  - murachs-mysql-3rd-edition:p122:c3
  - murachs-mysql-3rd-edition:p123:c1
  - murachs-mysql-3rd-edition:p123:c2
  - murachs-mysql-3rd-edition:p124:c1
  - murachs-mysql-3rd-edition:p124:c2
  - murachs-mysql-3rd-edition:p125:c1
  - murachs-mysql-3rd-edition:p125:c2
  - murachs-mysql-3rd-edition:p125:c3
  - murachs-mysql-3rd-edition:p126:c1
  - murachs-mysql-3rd-edition:p126:c2
  - murachs-mysql-3rd-edition:p127:c1
  - murachs-mysql-3rd-edition:p127:c2
  - murachs-mysql-3rd-edition:p128:c1
  - murachs-mysql-3rd-edition:p128:c2
relatedConcepts:
tags:
  - mysql
  - joins
  - inner
sourceDocId: murachs-mysql-3rd-edition
---

# Inner Join

## Definition
Matching rows from two or more tables

## Explanation
Chapter 3 How to retrieve data from a sin.gle table The syntax of the WHERE clause with an IN phrase WHERE test_expression [NOT] IN ({subquerylexpression_ l [, expression_2]... }) Examples of the IN phrase An IN phrase with a list of numeric literals WHERE terms_ id IN (1, 3, 4) An IN phrase preceded by NOT WHERE vendor_ state NOT IN ('CA', 'NV', 'OR') An IN phrase with a subquery WHERE vendor id IN (SELECT vendor id FROM invoices WHERE invoice_date = 1 2018-07-18 1) Description • You can use the IN phrase to test whether an expression is equal to a value in a list of expressions. Each of the expressions in the list is automatically converted to the same type of data as the test expression. • The list of expressions can be coded in any order without affecting the order of the rows in the result set. • You can use the NOT operator to test for an expression that's not in the list of • expressions. • You can also compare the test expression to the

the result set. • You can use the NOT operator to test for an expression that's not in the list of • expressions. • You can also compare the test expression to the items in a list returned by a subquery. You'll learn more about coding subqueries in chapter 7. How to use the IN operator

How to use the BETWEEN operator When you use this operator, the value of a test expression is compared to the range of values specified in the BETWEEN phrase. If the value falls within this range, the row is included in the query results. The first example in this figure shows a simple WHERE clause that uses the BETWEEN operator. It retrieves invoices with invoice dates between June 1, 2018 and June 30, 2018. Note that the range is inclusive, so invoices with invoice dates of June 1 and June 30 are included in the results. The second example shows how to use the NOT operator to select rows that aren't within a given range. In this case, vendors with zip codes that aren't between 93600 and 93799 are included in the results. The third example s

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
*Source: murachs-mysql-3rd-edition, Pages 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128*
