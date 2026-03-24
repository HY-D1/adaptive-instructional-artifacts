---
id: authorization
title: SQL Authorization
definition: GRANT and REVOKE statements for controlling access to database objects
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p405:c1
  - dbms-ramakrishnan-3rd-edition:p405:c2
  - dbms-ramakrishnan-3rd-edition:p406:c1
  - dbms-ramakrishnan-3rd-edition:p406:c2
  - dbms-ramakrishnan-3rd-edition:p406:c3
  - dbms-ramakrishnan-3rd-edition:p407:c1
  - dbms-ramakrishnan-3rd-edition:p407:c2
  - dbms-ramakrishnan-3rd-edition:p407:c3
  - dbms-ramakrishnan-3rd-edition:p408:c1
  - dbms-ramakrishnan-3rd-edition:p408:c2
  - dbms-ramakrishnan-3rd-edition:p408:c3
  - dbms-ramakrishnan-3rd-edition:p409:c1
  - dbms-ramakrishnan-3rd-edition:p410:c1
  - dbms-ramakrishnan-3rd-edition:p410:c2
  - dbms-ramakrishnan-3rd-edition:p411:c1
  - dbms-ramakrishnan-3rd-edition:p411:c2
  - dbms-ramakrishnan-3rd-edition:p412:c1
  - dbms-ramakrishnan-3rd-edition:p412:c2
  - dbms-ramakrishnan-3rd-edition:p413:c1
  - dbms-ramakrishnan-3rd-edition:p413:c2
  - dbms-ramakrishnan-3rd-edition:p413:c3
  - dbms-ramakrishnan-3rd-edition:p413:c4
  - dbms-ramakrishnan-3rd-edition:p414:c1
  - dbms-ramakrishnan-3rd-edition:p414:c2
  - dbms-ramakrishnan-3rd-edition:p414:c3
  - dbms-ramakrishnan-3rd-edition:p414:c4
  - dbms-ramakrishnan-3rd-edition:p415:c1
  - dbms-ramakrishnan-3rd-edition:p415:c2
  - dbms-ramakrishnan-3rd-edition:p415:c3
  - dbms-ramakrishnan-3rd-edition:p416:c1
  - dbms-ramakrishnan-3rd-edition:p416:c2
  - dbms-ramakrishnan-3rd-edition:p417:c1
  - dbms-ramakrishnan-3rd-edition:p417:c2
  - dbms-ramakrishnan-3rd-edition:p418:c1
  - dbms-ramakrishnan-3rd-edition:p419:c1
  - dbms-ramakrishnan-3rd-edition:p419:c2
relatedConcepts:
tags:
  - security
  - authorization
  - access-control
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# SQL Authorization

## Definition
GRANT and REVOKE statements for controlling access to database objects

## Explanation
HASH-BASED INDEXING... What is the intuition behind hash-structured indexes? Why are they especially good for equality searches but useless for range selections?... What is Extendible Hashing? How does it handle search, insert, and delete?... What is Linear Hashing? How does it handle search, insert, and delete?... What are the similarities and differences between Extendible and Linear Hashing? Itt Key concepts: hash function, bucket, primary and overflow pages, static versus dynamic hash indexes; Extendible Hashing, directory of buckets, splitting a bucket, global and local depth, directory doubling, collisions and overflow pages; Linear Hashing, rounds ofsplitting, family of hash functions, overflow pages, choice of bucket to split and time to split; relationship between Extendible Hashing's directory and Linear Hashing's family of hash functiolis, need for overflow pages in both schemes in practice, use of a directory for Linear Hashing. L.~~_~__ Not chaos-like, together crushed and bruised, But, as the wo~ld harmoniously confused: Where order in variety we see. ___ J Alexander Pope, Windsor Forest In this chapter we consider file organizations that are excellent for equality selections. The basic idea is to

as the wo~ld harmoniously confused: Where order in variety we see. ___ J Alexander Pope, Windsor Forest In this chapter we consider file organizations that are excellent for equality selections. The basic idea is to use a hashing function, which maps values

Hash-Based Indexing in a search field into a range of b'ucket numbers to find the page on which a desired data entry belongs. \Ve use a simple scheme called Static Hashing to introduce the idea. This scheme, like ISAM, suffers from the problem of long overflow chains, which can affect performance. Two solutions to the problem are presented. The Extendible Hashing scheme uses a directory to support inserts and deletes efficiently with no overflow pages. The Linear Hashing scheme uses a clever policy for c

## Examples
### Example 1: INSERT Example
```sql
insert a data entry, we use the hash function to identify the correct bucket and then put the data entry there. If there is no space for this data entry, we allocate a new overflow page, put the data entry on this page, and add the page to the overflow chain of the bucket. to delete a data

h(key) mod N / ~-~-§=l~ // __ ~L~--.-J~. - ~G\---I...,INdPrimary bucket pages Overflow pages Static Hashing CHAPTER 11 $ entry, we use the hashing function to identify the correct bucket, locate the data entry by searching the bucket, and then remove it. If this data entry is the last in an overflow page, the overflow page is removed from the overflow chain of the bucket and added to a list of free pages. The hash function is an important component of the hashing approach. It must distribute values in the domain of the search field uniformly over the collection of buckets. If we have N buckets, numbered a through N ~ 1, a hash function h of the form h(value) = (a * value + b) works well in practice. (The bucket identified is h(value) mod N.) The constants a and b can be chosen to 'tune' the hash function. Since the number of buckets in a Static Hashing file is known when the file is created, the primary pages can be stored on successive disk pages. Hence, a search

the hash function. Since the number of buckets in a Static Hashing file is known when the file is created, the primary pages can be stored on successive disk pages. Hence, a search ideally requires just one disk I/O, and insert and delete operations require two I/Os (read and write the page), although the cost could be higher in the presence of overflow pages. As the file grows, long overflow chains can develop. Since searching a bucket requires us to search (in general) all pages in its overflow chain, it is easy to see how performance can deteriorate. By initially keeping pages 80 percent full, we can avoid overflow pages if the file does not grow too IIluch, but in general the only way to get rid of overflow chains is to create a new file with more buckets. The main problem with Static Hashing is that the number of buckets is fixed. If a file shrinks greatly, a lot of space is wasted;
```
Example INSERT statement from textbook.

### Example 2: INSERT Example
```sql
insert a new data entry into a full bucket, we need to add an overflow page. If we do not want to add overflow pages, one solution is to reorganize the file at this point by doubling the number of buckets and redistributing the entries across the new set of buckets. This solution suffers from one major defect--the entire file has to be read, and twice (h') many pages have to be written to achieve the reorganization. This problem, however, can be overcome by a simple idea: Use a directory of pointers to bucket.s, and double t.he size of the number of buckets by doubling just the directory and splitting only the bucket that overflowed. to understand the idea, consider the sample file shown in directory consists of an array of size 4, with each element being a point.er to a bucket.. (The global

bucket that overflowed. to understand the idea, consider the sample file shown in directory consists of an array of size 4, with each element being a point.er to a bucket.. (The global depth and local depth fields are discussed shortly, ignore them for now.) to locat.e a data entry, we apply a hash funct.ion to the search field and take the last. 2 bit.s of its binary represent.ation t.o get. a number between 0 and ~~. The pointer in this array position gives us t.he desired bucket.;
```
Example INSERT statement from textbook.

### Example 3: DELETE Example
```sql
delete a data

h(key) mod N / ~-~-§=l~ // __ ~L~--.-J~. - ~G\---I...,INdPrimary bucket pages Overflow pages Static Hashing CHAPTER 11 $ entry, we use the hashing function to identify the correct bucket, locate the data entry by searching the bucket, and then remove it. If this data entry is the last in an overflow page, the overflow page is removed from the overflow chain of the bucket and added to a list of free pages. The hash function is an important component of the hashing approach. It must distribute values in the domain of the search field uniformly over the collection of buckets. If we have N buckets, numbered a through N ~ 1, a hash function h of the form h(value) = (a * value + b) works well in practice. (The bucket identified is h(value) mod N.) The constants a and b can be chosen to 'tune' the hash function. Since the number of buckets in a Static Hashing file is known when the file is created, the primary pages can be stored on successive disk pages. Hence, a search

the hash function. Since the number of buckets in a Static Hashing file is known when the file is created, the primary pages can be stored on successive disk pages. Hence, a search ideally requires just one disk I/O, and insert and delete operations require two I/Os (read and write the page), although the cost could be higher in the presence of overflow pages. As the file grows, long overflow chains can develop. Since searching a bucket requires us to search (in general) all pages in its overflow chain, it is easy to see how performance can deteriorate. By initially keeping pages 80 percent full, we can avoid overflow pages if the file does not grow too IIluch, but in general the only way to get rid of overflow chains is to create a new file with more buckets. The main problem with Static Hashing is that the number of buckets is fixed. If a file shrinks greatly, a lot of space is wasted;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419*
