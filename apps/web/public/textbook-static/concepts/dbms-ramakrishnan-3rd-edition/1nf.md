---
id: 1nf
title: First Normal Form (1NF)
definition: Eliminating repeating groups and ensuring atomic values
difficulty: beginner
estimatedReadTime: 5
pageReferences: [328, 329, 330, 331, 332, 333, 334, 335, 336, 337]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p328:c1
  - dbms-ramakrishnan-3rd-edition:p328:c2
  - dbms-ramakrishnan-3rd-edition:p328:c3
  - dbms-ramakrishnan-3rd-edition:p329:c1
  - dbms-ramakrishnan-3rd-edition:p329:c2
  - dbms-ramakrishnan-3rd-edition:p329:c3
  - dbms-ramakrishnan-3rd-edition:p330:c1
  - dbms-ramakrishnan-3rd-edition:p330:c2
  - dbms-ramakrishnan-3rd-edition:p330:c3
  - dbms-ramakrishnan-3rd-edition:p331:c1
  - dbms-ramakrishnan-3rd-edition:p331:c2
  - dbms-ramakrishnan-3rd-edition:p332:c1
  - dbms-ramakrishnan-3rd-edition:p332:c2
  - dbms-ramakrishnan-3rd-edition:p332:c3
  - dbms-ramakrishnan-3rd-edition:p333:c1
  - dbms-ramakrishnan-3rd-edition:p333:c2
  - dbms-ramakrishnan-3rd-edition:p333:c3
  - dbms-ramakrishnan-3rd-edition:p334:c1
  - dbms-ramakrishnan-3rd-edition:p334:c2
  - dbms-ramakrishnan-3rd-edition:p334:c3
  - dbms-ramakrishnan-3rd-edition:p335:c1
  - dbms-ramakrishnan-3rd-edition:p335:c2
  - dbms-ramakrishnan-3rd-edition:p335:c3
  - dbms-ramakrishnan-3rd-edition:p336:c1
  - dbms-ramakrishnan-3rd-edition:p336:c2
  - dbms-ramakrishnan-3rd-edition:p336:c3
  - dbms-ramakrishnan-3rd-edition:p337:c1
  - dbms-ramakrishnan-3rd-edition:p337:c2
relatedConcepts:
tags:
  - design
  - normalization
  - 1nf
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# First Normal Form (1NF)

## Definition
Eliminating repeating groups and ensuring atomic values

## Explanation
Stomge and Inde:rin,g 29,3 Clustered indexes, while less expensive to maintain than a fully sorted file, are nonetJleless expensive to maintain. When a new record h&'3 to be inserted into a full leaf page, a new leaf page must be allocated and sorne existing records have to be moved to the new page. If records are identified by a combination of page id and slot, &'5 is typically the case in current database systems, all places in the datab&"ie that point to a moved record (typically, entries in other indexes for the same collection of records) must also be updated to point to the new location. Locating all such places and making these additional updates can involve several disk I/Os. Clustering must be used sparingly and only when justified by frequent queries that benefit from clustering. In particular, there is no good reason to build a clustered file using hashing, since range queries cannot be answered using h&c;h-indexcs. In dealing with the limitation that at most one index can be clustered, it is often useful to consider whether the information

using hashing, since range queries cannot be answered using h&c;h-indexcs. In dealing with the limitation that at most one index can be clustered, it is often useful to consider whether the information in an index's search key is sufficient to answer the query. If so, modern database systems are intelligent enough to avoid fetching the actual data records. For example, if we have an index on age, and we want to compute the average age of employees, the DBMS can do this by simply examining the data entries in the index. This is an example of an index-only evaluation. In an index-only evaluation of a query we need not access the data records in the files that contain the relations in the query; we can evaluate the query completely through indexes on the files. An important benefit of index-only evaluation is that it works equally efficiently with only unclustered indexes, as only the data entries of the index are used i

## Examples
### Example 1: SELECT Example
```sql
SELECT FROM WHERE E.dno Employees E E.age > 40 If we have a H+ tree index on age, we can use it to retrieve only tuples that satisfy the selection E. age> 40. \iVhether such an index is worthwhile depends first of all on the selectivity of the condition. vVhat fraction of the employees are older than 40'1 If virtually everyone is older than 40 1 we gain little by using an index 011 age;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT FROM WHERE GROUP BY Kdno, COUNT(*) Employees E E.age> 10 E.dno If a B+ tree index is available on age, we could retrieve tuples using it, sort the retrieved tuples on dna, and so answer the query. However, this may not be a good plan if virtually all employees are more than 10 years old. This plan is especially bad if the index is not clustered. Let us consider whether an index on dna might suit our purposes better. We could use the index to retrieve all tuples,

This plan is especially bad if the index is not clustered. Let us consider whether an index on dna might suit our purposes better. We could use the index to retrieve all tuples, grouped by dna, and for each dna count the number of tuples with age> 10. (This strategy can be used with both hash and B+ tree indexes;
```
Example SELECT statement from textbook.

### Example 3: DELETE Example
```sql
delete specified using an equality condition. For each of the five file organizations, what is the cost if no record qualifies? What is the cost if the condition is not on a key? Exercise 8.9 What

an equality condition. For each of the five file organizations, what is the cost if no record qualifies? What is the cost if the condition is not on a key? Exercise 8.9 What main conclusions can you draw from the discussion of the five basic file organizations discussed in Section 8.4? Which of the five organizations would you choose for a file where the most frequent operations are a<;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 328, 329, 330, 331, 332, 333, 334, 335, 336, 337*
