---
id: date-functions
title: Date and Time Functions
definition: NOW, CURDATE, DATE_FORMAT, DATE_ADD, DATEDIFF, and more
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238]
chunkIds:
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
  - murachs-mysql-3rd-edition:p237:c1
  - murachs-mysql-3rd-edition:p237:c2
  - murachs-mysql-3rd-edition:p238:c1
  - murachs-mysql-3rd-edition:p238:c2
relatedConcepts:
tags:
  - mysql
  - functions
  - date-time
sourceDocId: murachs-mysql-3rd-edition
---

# Date and Time Functions

## Definition
NOW, CURDATE, DATE_FORMAT, DATE_ADD, DATEDIFF, and more

## Explanation
How to use the ALL keyword operator so the condition must be true for all the values returned by a subquery. The table at the top of this figure shows how this works. Here, the values in parentheses 1 epresent the values returned by the query. If you use the greater than operator(>), the expression must be greater than the maximum value returned by the subquery. Conversely, if you use the less than operator ( <), the expression must be less than the minimum value returned by the subquery. If you use the equal operator ( =), all of the values returned by the subquery must be the same and the expression must be equal to that value. And if you use the not equal operator ( <>), the expression must not equal any of the values returned by the subquery. However, a not equal condition can be restated using the NOT IN operator, which is easier to read. As a result, it's a better practice to use the NOT IN operator for this type of condition. The query in

be restated using the NOT IN operator, which is easier to read. As a result, it's a better practice to use the NOT IN operator for this type of condition. The query in this figure shows how to use the greater than operator with the ALL keyword. Here, the subquery selects the invoice_total column for all the invoices with a vendor_id value of 34. This results in a list of two values. Then, the main query retrieves the rows from the Invoices table that have invoice totals greater than both of the values returned by the subquery. In other words, this query returns all the invoices that have totals greater than 1083.58, which is the largest invoice for vendor number 34. When you use the ALL operator, the comparison evaluates to true if the subquery doesn't return any rows. In contrast, the comparison evaluates to false if the subquery returns only null values. In many cases, you can rewrite a condition with the ALL keyword so it's easier to read. For example, you could rewrite the query in this figure

if the subquery returns o

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
*Source: murachs-mysql-3rd-edition, Pages 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238*
