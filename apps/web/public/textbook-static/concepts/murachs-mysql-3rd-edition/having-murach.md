---
id: having-murach
title: HAVING Clause
definition: Filtering groups based on aggregate values
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276]
chunkIds:
  - murachs-mysql-3rd-edition:p265:c1
  - murachs-mysql-3rd-edition:p265:c2
  - murachs-mysql-3rd-edition:p265:c3
  - murachs-mysql-3rd-edition:p266:c1
  - murachs-mysql-3rd-edition:p266:c2
  - murachs-mysql-3rd-edition:p267:c1
  - murachs-mysql-3rd-edition:p268:c1
  - murachs-mysql-3rd-edition:p268:c2
  - murachs-mysql-3rd-edition:p268:c3
  - murachs-mysql-3rd-edition:p269:c1
  - murachs-mysql-3rd-edition:p269:c2
  - murachs-mysql-3rd-edition:p270:c1
  - murachs-mysql-3rd-edition:p270:c2
  - murachs-mysql-3rd-edition:p271:c1
  - murachs-mysql-3rd-edition:p271:c2
  - murachs-mysql-3rd-edition:p272:c1
  - murachs-mysql-3rd-edition:p272:c2
  - murachs-mysql-3rd-edition:p273:c1
  - murachs-mysql-3rd-edition:p274:c1
  - murachs-mysql-3rd-edition:p275:c1
relatedConcepts:
tags:
  - mysql
  - having
  - filtering
sourceDocId: murachs-mysql-3rd-edition
---

# HAVING Clause

## Definition
Filtering groups based on aggregate values

## Explanation
Clzapter 8 How to work with data types The ENUM and SET types Type Bytes Description ENUM SET 1-2 1-8 Stores one value selected from a list of acceptable values. Stores zero or more values selected from a list of acceptable values. How values are stored in ENUM columns Stored in column Value ENUM ('Yes', 'No', 'Maybe') 'Yes' 'No' 'Maybe' 'Possibly' 'Yes' 'No' 'Maybe' I I How values are stored in SET columns Value 'Pepperoni• 'Mushrooms' 'Pepperoni, Bacon• 'Olives, Pepperoni' Description Stored in column SET ('Pepperoni', 'Mushrooms', 'Olives') 'Pepperoni' 'Mushrooms' 'Pepperoni' 'Pepperoni, Olives' • The ENUM and SET types can be used to restrict the values that you store to a li1nited set of values. Tl1e ENUM column can take on exactly one value, but a SET colt1mn can take on zero, one, or up to 64 different values. • You can defme the set of acceptable values for an ENUM or SET column when you create a table. An ENUM column can have up to 65,535 acceptable values, but a SET column is limited to 64 acceptable values. •

values for an ENUM or SET column when you create a table. An ENUM column can have up to 65,535 acceptable values, but a SET column is limited to 64 acceptable values. • to specify a value for an ENUM column, you code a single text string. If the string contains an acceptable value, that value is stored in the column. Otherwise, the column is assigned an empty string. • If you don't specify a value for an ENUM column when you insert a row, MySQL assigns a default value that depends on whether the column allows null values. If the column allows null values, MySQL assigns a null value to the column. If it doesn't allow null values, MySQL assigns the first value in the set of acceptable values to the column. • to specify values for a SET column, you code a single string with the values separated by commas. Each acceptable value is stored in the column, and any other values are ignored. • When you store values in a SET column, MySQL stores the values usi

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
*Source: murachs-mysql-3rd-edition, Pages 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276*
