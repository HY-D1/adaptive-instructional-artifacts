---
id: alter-table-murach
title: Altering Tables
definition: ALTER TABLE to add, modify, and drop columns
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343]
chunkIds:
  - murachs-mysql-3rd-edition:p333:c1
  - murachs-mysql-3rd-edition:p333:c2
  - murachs-mysql-3rd-edition:p334:c1
  - murachs-mysql-3rd-edition:p334:c2
  - murachs-mysql-3rd-edition:p334:c3
  - murachs-mysql-3rd-edition:p334:c4
  - murachs-mysql-3rd-edition:p335:c1
  - murachs-mysql-3rd-edition:p335:c2
  - murachs-mysql-3rd-edition:p335:c3
  - murachs-mysql-3rd-edition:p336:c1
  - murachs-mysql-3rd-edition:p336:c2
  - murachs-mysql-3rd-edition:p337:c1
  - murachs-mysql-3rd-edition:p337:c2
  - murachs-mysql-3rd-edition:p338:c1
  - murachs-mysql-3rd-edition:p338:c2
  - murachs-mysql-3rd-edition:p338:c3
  - murachs-mysql-3rd-edition:p339:c1
  - murachs-mysql-3rd-edition:p339:c2
  - murachs-mysql-3rd-edition:p339:c3
  - murachs-mysql-3rd-edition:p340:c1
  - murachs-mysql-3rd-edition:p340:c2
  - murachs-mysql-3rd-edition:p341:c1
  - murachs-mysql-3rd-edition:p342:c1
  - murachs-mysql-3rd-edition:p342:c2
  - murachs-mysql-3rd-edition:p342:c3
  - murachs-mysql-3rd-edition:p342:c4
  - murachs-mysql-3rd-edition:p343:c1
  - murachs-mysql-3rd-edition:p343:c2
  - murachs-mysql-3rd-edition:p343:c3
relatedConcepts:
tags:
  - mysql
  - ddl
  - alter-table
sourceDocId: murachs-mysql-3rd-edition
---

# Altering Tables

## Definition
ALTER TABLE to add, modify, and drop columns

## Explanation
Chapter 10 Hovv to design a database Possible tables and columns for an accounts payable system Vendors Invoices Invoice line items Vendor name Vendor address Vendor city Vendor state Vendor zip code Vendor phone number Vendor fax nutuber Vendor web address Vendor contact first name Vendor contact last name 'Vendor contact phone Vendor AR first name Vendor AR last name Vendor AR phone Terms* Account number* Description Invoice number* Invoice number* Invoice date Item part number Terms* Item quantity Invoice total Item description Payment date Item unit price Paymerit total Item extension Invoice due date Accoun.t nu,nber* Credit total Sequence number Accoi,nt number* • After you identify and subdivide all of the data elements for a database, you should group them by the entities with which they're associated. These entities will later become the tables of the database, and the elements will become the columns. • If a data element relates to more than one entity, you can include it under all of the entities it relates to. Then, when you normalize the database, you may be able to remove

If a data element relates to more than one entity, you can include it under all of the entities it relates to. Then, when you normalize the database, you may be able to remove the duplicate elements. • As you assign the elements to entities, you should omit elements that aren't needed, and you should add any additional elements that are needed. The notation used in this figure • Data elements that were previously identified but aren't needed are crossed out. • Data elements that were added are displayed in italics. • Data elements that are related to two or more entities are followed by an asterisk. • You can use a similar notation or develop one of your own. You can also use a CASE ( computer-aided software engineering) tool if one is available to you. How to identify the tables and assign columns

How to identify the primary and foreign keys Once you identify the entities and data 

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
*Source: murachs-mysql-3rd-edition, Pages 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343*
