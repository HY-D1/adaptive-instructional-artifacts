---
id: 2nf
title: Second Normal Form (2NF)
definition: Eliminating partial dependencies on composite keys
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346]
chunkIds:
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
  - dbms-ramakrishnan-3rd-edition:p346:c1
  - dbms-ramakrishnan-3rd-edition:p346:c2
  - dbms-ramakrishnan-3rd-edition:p346:c3
relatedConcepts:
tags:
  - design
  - normalization
  - 2nf
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Second Normal Form (2NF)

## Definition
Eliminating partial dependencies on composite keys

## Explanation
CHAPTER S • vVhat is a clustered index? vVhat is a prinwry index? How many clustered indexes can you build on a file? How many unclustered indexes can you build? (Section 8.2.1) • Hmv is data organized in a hash-ba'lcd index? \Vhen would you use a hash-based index? (Section 8.3.1) • How is data organized in a tree-based index? vVhen would you use a treebased index? (Section 8.3.2) • Consider the following operations: scans, equality and 'range selections, inserts, and deletes, and the following file organizations: heap files, sorted files, clustered files, heap files with an unclustered tree index on the search key, and heap files with an unclusteTed hash index. Which file organization is best suited for each operation? (Section 8.4) • What are the main contributors to the cost of database operations? Discuss a simple cost model that reflects this. (Section 8.4.1) • How does the expected workload influence physical database design decisiems such as what indexes to build? vVhy is the choice of indexes a central aspect of physical database design? (Section 8.5) • What issues are

does the expected workload influence physical database design decisiems such as what indexes to build? vVhy is the choice of indexes a central aspect of physical database design? (Section 8.5) • What issues are considered in using clustered indexes? What is an indcl;- only evaluation method? \\That is its primary advantage? (Section 8.5.2) • What is a composite 8earch key? What are the pros and cons of composite search keys? (Section 8.5.3) • What SQL commands support index creation? (Section 8.5.4) EXERCISES Exercise 8.1 Answer the following questions about data on external storage in a DBMS: 1. \Vhy does a DBMS store data on external storage? 2. Why are I/O costs important in a DBMS? 3. \Vhat is a record id? Given a record's id, how many I/Os are needed to fetch it into main memory? 4. \Vhat is the role of the buffer manager in a DBMS? What is the role of the disk space manager? How do thes

## Examples
### Example 1: UPDATE Example
```sql
update that is definitely speeded 1lJi because of the available indexes. (English description is sufficient.)

Storage and Inde.7:ing ~ 3. Give an example of an update that is definitely slowed down because of the indexes. (English description is sufficient.) 4. Can you give an example of an update that is neither speeded up nor slowed down by the indexes? Exercise 8.11 Consider the following relations: Emp( eid: integer, ename: varchar, sal: integer, age: integer, did: integer) Dept(did: integer, budget: integer, floor: integer, mgr_eid: integer) Salaries range from $10,000 to $100,000, ages vary from 20 to 80, each department has about five employees on average, there are 10 floors, and budgets vary from $10,000 to $1 million. You can assume uniform distributions of values. For each of the following queries, which of the listed index choices would you choose to speed up the query? If your database system does not consider index-only plans (i.e., data records are always retrieved even if enough information is available in the index entry), how would your answer change? Explain briefly. 1. Query: Print ename, age, and sal for all employees. (a) Clustered hash index on (ename, age, sal) fields of

information is available in the index entry), how would your answer change? Explain briefly. 1. Query: Print ename, age, and sal for all employees. (a) Clustered hash index on (ename, age, sal) fields of Emp. (b) Unclustered hash index on (ename, age, sal) fields of Emp. (c) Clustered B+ tree index on (ename, age, sal) fields of Emp. (d) Unclustered hash index on (eid, did) fields of Emp. (e) No index. 2. Query: Find the dids of departments that are on the 10th floor and have a budget of less than $15,000. (a) Clustered hash index on the floor field of Dept. (b) Unclustered hash index on the floor' field of Dept. (c) Clustered B+ tree index on (floor, budget) fields of Dept. (d) Clustered B+ tree index on the budget: field of Dept. (e) No index. PROJECT-BASED EXERCISES Exercise 8.12 Answer the following questions: 1. What indexing techniques are supported in Minibase? 2. \;
```
Example UPDATE statement from textbook.

### Example 2: DELETE Example
```sql
delete specified using an equality condition. For each of the five file organizations, what is the cost if no record qualifies? What is the cost if the condition is not on a key? Exercise 8.9 What

an equality condition. For each of the five file organizations, what is the cost if no record qualifies? What is the cost if the condition is not on a key? Exercise 8.9 What main conclusions can you draw from the discussion of the five basic file organizations discussed in Section 8.4? Which of the five organizations would you choose for a file where the most frequent operations are a<;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346*
