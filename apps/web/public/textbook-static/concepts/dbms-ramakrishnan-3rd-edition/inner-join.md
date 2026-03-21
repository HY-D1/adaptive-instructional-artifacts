---
id: inner-join
title: INNER JOIN
definition: Retrieving matching rows from two or more tables
difficulty: beginner
estimatedReadTime: 5
pageReferences: [140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p140:c1
  - dbms-ramakrishnan-3rd-edition:p140:c2
  - dbms-ramakrishnan-3rd-edition:p140:c3
  - dbms-ramakrishnan-3rd-edition:p141:c1
  - dbms-ramakrishnan-3rd-edition:p141:c2
  - dbms-ramakrishnan-3rd-edition:p141:c3
  - dbms-ramakrishnan-3rd-edition:p142:c1
  - dbms-ramakrishnan-3rd-edition:p142:c2
  - dbms-ramakrishnan-3rd-edition:p142:c3
  - dbms-ramakrishnan-3rd-edition:p143:c1
  - dbms-ramakrishnan-3rd-edition:p143:c2
  - dbms-ramakrishnan-3rd-edition:p144:c1
  - dbms-ramakrishnan-3rd-edition:p144:c2
  - dbms-ramakrishnan-3rd-edition:p144:c3
  - dbms-ramakrishnan-3rd-edition:p145:c1
  - dbms-ramakrishnan-3rd-edition:p145:c2
  - dbms-ramakrishnan-3rd-edition:p146:c1
  - dbms-ramakrishnan-3rd-edition:p146:c2
  - dbms-ramakrishnan-3rd-edition:p147:c1
  - dbms-ramakrishnan-3rd-edition:p147:c2
  - dbms-ramakrishnan-3rd-edition:p148:c1
  - dbms-ramakrishnan-3rd-edition:p148:c2
  - dbms-ramakrishnan-3rd-edition:p148:c3
  - dbms-ramakrishnan-3rd-edition:p149:c1
  - dbms-ramakrishnan-3rd-edition:p149:c2
  - dbms-ramakrishnan-3rd-edition:p149:c3
  - dbms-ramakrishnan-3rd-edition:p150:c1
  - dbms-ramakrishnan-3rd-edition:p150:c2
  - dbms-ramakrishnan-3rd-edition:p150:c3
relatedConcepts:
tags:
  - sql
  - joins
  - inner
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# INNER JOIN

## Definition
Retrieving matching rows from two or more tables

## Explanation
Relational Algebra and CalC'ul1L8 H15 • Set-difference: R- 8 returns a relation instance containing all tuples that occur in R but not in 8. The relations Rand 8 must be union-compatible, and the schema of the result is defined to be identical to the schema of R. • Cross-product: R x 8 returns a relation instance whose schema contains all the fields of R (in the same order as they appear in R) followed by all the fields of 8 (in the same order as they appear in 8). The result of R x 8 contains OIle tuple (1', s) (the concatenation of tuples rand s) for each pair of tuples l' E R, S E 8. The cross-product opertion is sometimes called Cartesian product. \\Te use the convention that the fields of R x 8 inherit names from the corresponding fields of Rand 8. It is possible for both Rand 8 to contain one or more fields having the same name; this situation creates a naming confi'ict. The corresponding fields in R x 8 are unnamed and are referred

possible for both Rand 8 to contain one or more fields having the same name; this situation creates a naming confi'ict. The corresponding fields in R x 8 are unnamed and are referred to solely by position. In the preceding definitions, note that each operator can be applied to relation instances that are computed using a relational algebra (sub)expression. We now illustrate these definitions through several examples. The union of 81 and 82 is shown in inherited from 81. 82 has the same field names, of course, since it is also an instance of Sailors. In general, fields of 82 may have different names; recall that we require only domains to match. Note that the result is a set of tuples. TUples that appear in both 81 and 82 appear only once in 81 U 82. Also, 81 uRI is not a valid operation because the two relations are not union-compatible. The intersection of 81 and 82 is shown in is shown in Dustin 45.0 Lubber 55.5 Rusty 35.0 yuppy 35.0 guppy 35.0 31 u 52 The result of the

the two relations are not union-compatible. The intersecti

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
*Source: dbms-ramakrishnan-3rd-edition, Pages 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150*
