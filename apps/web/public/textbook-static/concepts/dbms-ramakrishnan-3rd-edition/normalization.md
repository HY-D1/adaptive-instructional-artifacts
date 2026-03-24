---
id: normalization
title: Database Normalization
definition: Organizing data to reduce redundancy and improve integrity (1NF, 2NF, 3NF, BCNF)
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p325:c1
  - dbms-ramakrishnan-3rd-edition:p325:c2
  - dbms-ramakrishnan-3rd-edition:p325:c3
  - dbms-ramakrishnan-3rd-edition:p326:c1
  - dbms-ramakrishnan-3rd-edition:p326:c2
  - dbms-ramakrishnan-3rd-edition:p327:c1
  - dbms-ramakrishnan-3rd-edition:p327:c2
  - dbms-ramakrishnan-3rd-edition:p327:c3
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
  - dbms-ramakrishnan-3rd-edition:p338:c1
  - dbms-ramakrishnan-3rd-edition:p338:c2
  - dbms-ramakrishnan-3rd-edition:p338:c3
  - dbms-ramakrishnan-3rd-edition:p339:c1
  - dbms-ramakrishnan-3rd-edition:p339:c2
  - dbms-ramakrishnan-3rd-edition:p340:c1
  - dbms-ramakrishnan-3rd-edition:p340:c2
  - dbms-ramakrishnan-3rd-edition:p341:c1
  - dbms-ramakrishnan-3rd-edition:p341:c2
  - dbms-ramakrishnan-3rd-edition:p341:c3
  - dbms-ramakrishnan-3rd-edition:p342:c1
  - dbms-ramakrishnan-3rd-edition:p342:c2
  - dbms-ramakrishnan-3rd-edition:p343:c1
  - dbms-ramakrishnan-3rd-edition:p343:c2
  - dbms-ramakrishnan-3rd-edition:p343:c3
  - dbms-ramakrishnan-3rd-edition:p344:c1
  - dbms-ramakrishnan-3rd-edition:p344:c2
  - dbms-ramakrishnan-3rd-edition:p344:c3
  - dbms-ramakrishnan-3rd-edition:p345:c1
  - dbms-ramakrishnan-3rd-edition:p345:c2
  - dbms-ramakrishnan-3rd-edition:p345:c3
  - dbms-ramakrishnan-3rd-edition:p345:c4
relatedConcepts:
tags:
  - design
  - normalization
  - theory
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Database Normalization

## Definition
Organizing data to reduce redundancy and improve integrity (1NF, 2NF, 3NF, BCNF)

## Explanation
CHAPTER 8 Scan: As for an unclustered tree index, all data entries can be retrieved inexpensively, at a cost of O.125B(D + 8RC) I/Os. However, for each entry, we incur the additional cost of one I/O to fetch the corresponding data record; the cost of this step is BR(D + C). This is prohibitively expensive, and further, results are unordered. So no one ever scans a hash index. Search with Equality Selection: This operation is supported very efficiently for matching selections, that is, equality conditions are specified for each field in the composite search key (age, sal). The cost of identifying the page that contains qualifying data entries is H. Assuming that this bucket consists of just one page (i.e., no overflow pages), retrieving it costs D. If we assume that we find the data entry after scanning half the records on the page, the cost of scanning the page is O.5(8R)C = 4RC. Finally, we have to fetch the data record from the employee file, which is another D. The total cost is therefore H + 2D + 4RC,

cost of scanning the page is O.5(8R)C = 4RC. Finally, we have to fetch the data record from the employee file, which is another D. The total cost is therefore H + 2D + 4RC, which is even lower than the cost for a tree index. If several records qualify, they are not guaranteed to be adjacent to each other. The cost of retrieving all such records is the cost of locating the first qualifying data entry (H+D+4RC) plus one I/O per qualifying record. The cost of using an unclustered index therefore depends heavily on the number of qualifying records. Search with Range Selection: The hash structure offers no help, and the entire heap file of employee records must be scanned at a cost of B(D + RC). Insert: We must first insert the record in the employee heap file, at a cost of 2D + C. In addition, the appropriate page in the index must be located, modified to insert a new data entry, and then written back. The additional cost is H + 2D + C. Delete: We

appropriate page in

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

### Example 3: INSERT Example
```sql
insert the record in the employee heap file, at a cost of 2D + C. In addition, the appropriate page in the index must be located, modified to insert a new data entry, and then written back. The additional cost is H + 2D + C. Delete: We

appropriate page in the index must be located, modified to insert a new data entry, and then written back. The additional cost is H + 2D + C. Delete: We need to locate the data record in the employee file and the data entry in the index;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345*
