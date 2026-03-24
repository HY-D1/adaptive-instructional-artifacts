---
id: indexes
title: Database Indexes
definition: Data structures that improve the speed of data retrieval operations
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p385:c1
  - dbms-ramakrishnan-3rd-edition:p385:c2
  - dbms-ramakrishnan-3rd-edition:p385:c3
  - dbms-ramakrishnan-3rd-edition:p386:c1
  - dbms-ramakrishnan-3rd-edition:p386:c2
  - dbms-ramakrishnan-3rd-edition:p387:c1
  - dbms-ramakrishnan-3rd-edition:p387:c2
  - dbms-ramakrishnan-3rd-edition:p387:c3
  - dbms-ramakrishnan-3rd-edition:p387:c4
  - dbms-ramakrishnan-3rd-edition:p388:c1
  - dbms-ramakrishnan-3rd-edition:p388:c2
  - dbms-ramakrishnan-3rd-edition:p388:c3
  - dbms-ramakrishnan-3rd-edition:p389:c1
  - dbms-ramakrishnan-3rd-edition:p389:c2
  - dbms-ramakrishnan-3rd-edition:p389:c3
  - dbms-ramakrishnan-3rd-edition:p390:c1
  - dbms-ramakrishnan-3rd-edition:p390:c2
  - dbms-ramakrishnan-3rd-edition:p390:c3
  - dbms-ramakrishnan-3rd-edition:p391:c1
  - dbms-ramakrishnan-3rd-edition:p391:c2
  - dbms-ramakrishnan-3rd-edition:p392:c1
  - dbms-ramakrishnan-3rd-edition:p392:c2
  - dbms-ramakrishnan-3rd-edition:p392:c3
  - dbms-ramakrishnan-3rd-edition:p393:c1
  - dbms-ramakrishnan-3rd-edition:p393:c2
  - dbms-ramakrishnan-3rd-edition:p393:c3
  - dbms-ramakrishnan-3rd-edition:p394:c1
  - dbms-ramakrishnan-3rd-edition:p394:c2
  - dbms-ramakrishnan-3rd-edition:p394:c3
  - dbms-ramakrishnan-3rd-edition:p395:c1
  - dbms-ramakrishnan-3rd-edition:p395:c2
  - dbms-ramakrishnan-3rd-edition:p395:c3
  - dbms-ramakrishnan-3rd-edition:p396:c1
  - dbms-ramakrishnan-3rd-edition:p397:c1
  - dbms-ramakrishnan-3rd-edition:p397:c2
  - dbms-ramakrishnan-3rd-edition:p398:c1
  - dbms-ramakrishnan-3rd-edition:p398:c2
  - dbms-ramakrishnan-3rd-edition:p398:c3
  - dbms-ramakrishnan-3rd-edition:p399:c1
  - dbms-ramakrishnan-3rd-edition:p399:c2
  - dbms-ramakrishnan-3rd-edition:p399:c3
relatedConcepts:
tags:
  - performance
  - indexes
  - optimization
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Database Indexes

## Definition
Data structures that improve the speed of data retrieval operations

## Explanation
CHAPTER jO /,_ - - Entry to be inserted in parent 11(.)de. [i]1 <-- - (Note that 5 is 'copied up' and _-....... "---\,ontin.", to,ppcM;n the lenf.) EEf-rJ-~r Split Leaf Pages during Insert of Entry 8* The split pages in our example are shown in pointing to the new non-leaf node is the pair (17, pointer to new index-level page); note that the key value 17 is 'pushed up' the tree, in contrast to the splitting key value 5 in the leaf split, which was 'copied up.' / Entry to be inserted in parent node. ~..£~ _:' - - (Note that 17 is 'pushed up' and and appears once In the index. Contrast thIS with a leaf spILt.))EffJD HPJ Split Index Pages during Insert of Entry 8* The difference in handling leaf-level and index-level splits arises from the B+ tree requirement that all data entries h must reside in the leaves. This requirement prevents us from 'pushing up' 5 and leads to the slight redundancy of having some key values appearing in the leaf level as well as in some

h must reside in the leaves. This requirement prevents us from 'pushing up' 5 and leads to the slight redundancy of having some key values appearing in the leaf level as well as in some index leveL However, range queries can be efficiently answered by just retrieving the sequence of leaf pages; the redundancy is a small price to pay for efficiency. In dealing with the index levels, we have more flexibility, and we 'push up' 17 to avoid having two copies of 17 in the index levels. Now, since the split node was the old root, we need to create a new root node to hold the entry that distinguishes the two split index pages. The tree after completing the insertion of the entry 8* is shown in One variation of the insert algorithm tries to redistribute entries of a node N with a sibling before splitting the node; this improves average occupancy. The sibling of a node N, in this context, is a node that is immediately to the left or right of N and has the same

sibling before splitting the node; this improves average o

## Examples
### Example 1: INSERT Example
```sql
Insert of Entry 8* The split pages in our example are shown in pointing to the new non-leaf node is the pair (17, pointer to new index-level page);
```
Example INSERT statement from textbook.

### Example 2: INSERT Example
```sql
Insert of Entry 8* The difference in handling leaf-level and index-level splits arises from the B+ tree requirement that all data entries h must reside in the leaves. This requirement prevents us from 'pushing up' 5 and leads to the slight redundancy of having some key values appearing in the leaf level as well as in some

h must reside in the leaves. This requirement prevents us from 'pushing up' 5 and leads to the slight redundancy of having some key values appearing in the leaf level as well as in some index leveL However, range queries can be efficiently answered by just retrieving the sequence of leaf pages;
```
Example INSERT statement from textbook.

### Example 3: DELETE Example
```sql
DELETE The algorithm for deletion takes an entry, finds the leaf node where it belongs, and deletes it. Pseudocode for the B+ tree deletion algorithm is given in the entry by calling the delete algorithm on the appropriate child node. We usually go down to the leaf node where the entry belongs, remove the entry from there, and return all the way back to the root node. Occasionally a node is at minimum occupancy before the deletion, and the deletion causes it to go below the occupancy threshold. When this happens, we must either redistribute entries from an adjacent sibling or merge the node with a sibling to maintain minimum occupancy. If entries are redistributed between two nodes, their parent node must be updated to reflect this;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 395, 396, 397, 398, 399*
