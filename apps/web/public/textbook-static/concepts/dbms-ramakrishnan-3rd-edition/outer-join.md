---
id: outer-join
title: OUTER JOIN
definition: Retrieving all rows from one table and matching rows from another (LEFT, RIGHT, FULL)
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p148:c1
  - dbms-ramakrishnan-3rd-edition:p148:c2
  - dbms-ramakrishnan-3rd-edition:p148:c3
  - dbms-ramakrishnan-3rd-edition:p149:c1
  - dbms-ramakrishnan-3rd-edition:p149:c2
  - dbms-ramakrishnan-3rd-edition:p149:c3
  - dbms-ramakrishnan-3rd-edition:p150:c1
  - dbms-ramakrishnan-3rd-edition:p150:c2
  - dbms-ramakrishnan-3rd-edition:p150:c3
  - dbms-ramakrishnan-3rd-edition:p151:c1
  - dbms-ramakrishnan-3rd-edition:p151:c2
  - dbms-ramakrishnan-3rd-edition:p151:c3
  - dbms-ramakrishnan-3rd-edition:p152:c1
  - dbms-ramakrishnan-3rd-edition:p152:c2
  - dbms-ramakrishnan-3rd-edition:p152:c3
  - dbms-ramakrishnan-3rd-edition:p153:c1
  - dbms-ramakrishnan-3rd-edition:p153:c2
  - dbms-ramakrishnan-3rd-edition:p153:c3
  - dbms-ramakrishnan-3rd-edition:p154:c1
  - dbms-ramakrishnan-3rd-edition:p154:c2
  - dbms-ramakrishnan-3rd-edition:p154:c3
  - dbms-ramakrishnan-3rd-edition:p155:c1
  - dbms-ramakrishnan-3rd-edition:p155:c2
  - dbms-ramakrishnan-3rd-edition:p156:c1
  - dbms-ramakrishnan-3rd-edition:p156:c2
  - dbms-ramakrishnan-3rd-edition:p156:c3
  - dbms-ramakrishnan-3rd-edition:p157:c1
  - dbms-ramakrishnan-3rd-edition:p157:c2
  - dbms-ramakrishnan-3rd-edition:p157:c3
  - dbms-ramakrishnan-3rd-edition:p158:c1
  - dbms-ramakrishnan-3rd-edition:p158:c2
  - dbms-ramakrishnan-3rd-edition:p158:c3
  - dbms-ramakrishnan-3rd-edition:p159:c1
  - dbms-ramakrishnan-3rd-edition:p159:c2
  - dbms-ramakrishnan-3rd-edition:p159:c3
  - dbms-ramakrishnan-3rd-edition:p160:c1
  - dbms-ramakrishnan-3rd-edition:p160:c2
  - dbms-ramakrishnan-3rd-edition:p160:c3
relatedConcepts:
tags:
  - sql
  - joins
  - outer
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# OUTER JOIN

## Definition
Retrieving all rows from one table and matching rows from another (LEFT, RIGHT, FULL)

## Explanation
Relational Algebra and Calculus An equivalent expression is: B.3 The reader is invited to rewrite both of these queries by using p to make the intermediate relations explicit and compare the schema.<=; of the intermediate relations. The second expression generates intermediate relations with fewer fields (and is therefore likely to result in intermediate relation instances with fewer tuples as well). A relational query optimizer would try to arrive at the second expression if it is given the first. (Q3) Find the colors of boats reserved by Lubber. Jrcolor((asname='Lubber,Sa'ilors) [XJ Reserves [XJ Boats) This query is very similar to the query we used to compute sailors who reserved red boats. On instances Bl, R2, and S3, the query returns the colors green and red. (Q4) Find the names of sailors who have reserved at least one boat. Jrsname(Sailors [XJ Reserves) The join of Sailors and Reserves creates an intermediate relation in which tuples consist of a Sailors tuple 'attached to' a Reserves tuple. A Sailors tuple appears in (some tuple of) this intermediate relation only if at least one Reserves tuple

intermediate relation in which tuples consist of a Sailors tuple 'attached to' a Reserves tuple. A Sailors tuple appears in (some tuple of) this intermediate relation only if at least one Reserves tuple has the same sid value, that is, the sailor has made some reservation. The answer, when evaluated on the instances Bl, R2 and S3, contains the three tuples (Dustin), (HoTatio), and (LubbeT). Even though two sailors called Horatio have reserved a boat, the answer contains only one copy of the tuple (HoTatio), because the answer is a relation, that is, a set of tuples, with no duplicates. At this point it is worth remarking on how frequently the natural join operation is used in our examples. This frequency is more than just a coincidence based on the set of queries we have chosen to discuss; the natural join is a very natural, widely used operation. In particular, nat

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
*Source: dbms-ramakrishnan-3rd-edition, Pages 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160*
