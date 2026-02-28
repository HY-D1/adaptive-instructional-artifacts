# Database Design

## Definition
How to design databases using ERDs and normalization

## Explanation
Storage and Inde:r'ing 285 f Insert: \Ve assume that records are always inserted at the end of the file. \¥e must fetch the last page in the file, add the record, and write the page back. The cost is 2D + C. Delete: We must find the record, remove the record from the page, and write the modified page back. vVe assume that no attempt is made to compact the file to reclaim the free space created by deletions, for simplicity. 1 The cost is the cost of searching plus C + D. We assume that the record to be deleted is specified using the record id. Since the page id can easily be obtained from the record id, we can directly read in the page. The cost of searching is therefore D. If the record to be deleted is specified using an equality or range condition on some fields, the cost of searching is given in our discussion of equality and range selections. The cost of deletion is also affected by the number of qualifying records, since all pages

the cost of searching is given in our discussion of equality and range selections. The cost of deletion is also affected by the number of qualifying records, since all pages containing such records must be modified. 8.4.3 Sorted Files Scan: The cost is B(D +RC) because all pages must be examined. Note that this case is no better or worse than the case of unordered files. However, the order in which records are retrieved corresponds to the sort order, that is, all records in age order, and for a given age, by sal order. Search with Equality Selection: We assume that the equality selection matches the sort order (age, sal). In other words, we assume that a selection condition is specified on at leclst the first field in the composite key (e.g., age = 30). If not (e.g., selection sal = t50 or department = "Toy"), the sort order does not help us and the cost is identical to that for a heap file. We can locate the first page containing the desired record or records, should any qualifying records

not help us and the cost is identical to t

## Examples
### Example 1: SELECT Example
```sql
SELECT FROM WHERE E.dno Employees E E.age > 40 If we have a H+ tree index on age, we can use it to retrieve only tuples that satisfy the selection E. age> 40. \iVhether such an index is worthwhile depends first of all on the selectivity of the condition. vVhat fraction of the employees are older than 40'1 If virtually everyone is older than 40 1 we gain little by using an index 011 age;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT FROM WHERE GROUP BY Kdno, COUNT(*) Employees E E.age> 10 E.dno If a B+ tree index is available on age, we could retrieve tuples using it, sort the retrieved tuples on dna, and so answer the query. However, this may not be a good plan if virtually all employees are more than 10 years old. This plan is especially bad if the index is not clustered. Let us consider whether an index on dna might suit our purposes better. We could use the index to retrieve all

is especially bad if the index is not clustered. Let us consider whether an index on dna might suit our purposes better. We could use the index to retrieve all tuples, grouped by dna, and for each dna count the number of tuples with age> 10. (This strategy can be used with both hash and B+ tree indexes;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
insert a record while preserving the sort order, we must first find the correct position in the file, add the record, and then fetch and rewrite all subsequent pages (because all the old records are shifted by one slot, assuming that the file has no empty slots). On average, we can &'3sume that the inserted record belongs in the middle of the file. Therefore, we must read the latter half of the file and then write it back after adding the new record. The cost is that of searching to find the position of the new record plus 2 . (O.5B(D + RC)), that is, search cost plus

after adding the new record. The cost is that of searching to find the position of the new record plus 2 . (O.5B(D + RC)), that is, search cost plus B(D + RC). Delete: We must search for the record, remove the record from the page, and write the modified page back. We must also read and write all subsequent pages because all records that follow the deleted record must be moved up to cornpact the free space. 2 The cost is the same as for an insert, that is, search cost plus B(D + RC). Given the rid of the record to delete, we can fetch the page containing the record directly. If records to be deleted are specified by an equality or range condition, the cost of deletion depends on the number of qualifying records. If the condition is specified on the sort field, qualifying records are guaranteed to be contiguous, and the first qualifying record can be located using binary search. 2Unlike a heap file. there is no inexpensive way to manage free space, so we account

to be contiguous, and the first qualifying record can be located using binary search. 2Unlike a heap file. there is no inexpensive way to manage free space, so we account for the cost of compacting it file when il record is deleted.

il Storage and Indexing 8.4.4 Clustered Files In a clustered file, extensive empirical study has shown that pages are usually at about 67 percent occupancy. Thus, the Humber of physical data pages is about 1.5B, and we use this observation in the following analysis. Scan: The cost of a scan is 1.5B(D + RC) because all data pages must be examined;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331*
