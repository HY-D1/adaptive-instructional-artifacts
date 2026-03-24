---
id: 3nf
title: Third Normal Form (3NF)
definition: Eliminating transitive dependencies
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353]
chunkIds:
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
  - dbms-ramakrishnan-3rd-edition:p347:c1
  - dbms-ramakrishnan-3rd-edition:p347:c2
  - dbms-ramakrishnan-3rd-edition:p347:c3
  - dbms-ramakrishnan-3rd-edition:p348:c1
  - dbms-ramakrishnan-3rd-edition:p348:c2
  - dbms-ramakrishnan-3rd-edition:p348:c3
  - dbms-ramakrishnan-3rd-edition:p349:c1
  - dbms-ramakrishnan-3rd-edition:p349:c2
  - dbms-ramakrishnan-3rd-edition:p349:c3
  - dbms-ramakrishnan-3rd-edition:p350:c1
  - dbms-ramakrishnan-3rd-edition:p350:c2
  - dbms-ramakrishnan-3rd-edition:p350:c3
  - dbms-ramakrishnan-3rd-edition:p351:c1
  - dbms-ramakrishnan-3rd-edition:p351:c2
  - dbms-ramakrishnan-3rd-edition:p351:c3
  - dbms-ramakrishnan-3rd-edition:p352:c1
  - dbms-ramakrishnan-3rd-edition:p352:c2
  - dbms-ramakrishnan-3rd-edition:p352:c3
  - dbms-ramakrishnan-3rd-edition:p353:c1
  - dbms-ramakrishnan-3rd-edition:p353:c2
  - dbms-ramakrishnan-3rd-edition:p353:c3
relatedConcepts:
tags:
  - design
  - normalization
  - 3nf
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Third Normal Form (3NF)

## Definition
Eliminating transitive dependencies

## Explanation
Storing Data: Disks and Files Disk ann Arm movement Structure of a Disk ____ Block Sectors Cylinder - Tracks,.. Platter ~07 characteristic of the disk and cannot be changed. The size of a disk block can be set when the disk is initialized as a multiple of the sector size. An array of disk heads, one per recorded surface, is moved as a unit; when one head is positioned over a block, the other heads are in identical positions with respect to their platters. to read or write a block, a disk head must be positioned on top of the block. Current systems typically allow at most one disk head to read or write at any one time. All the disk heads cannot read or write in parallel~-this technique would increa.se data transfer rates by a factor equal to the number of disk heads and considerably speed up sequential scans. The rea.son they cannot is that it is very difficult to ensure that all the heads are perfectly aligned on the corresponding tracks. Current approaches are both expensive and more

up sequential scans. The rea.son they cannot is that it is very difficult to ensure that all the heads are perfectly aligned on the corresponding tracks. Current approaches are both expensive and more prone to faults than disks with a single active heacl. In practice, very few commercial products support this capability and then only in a limited way; for example, two disk heads may be able to operate in parallel. A disk controller interfaces a disk drive to the computer. It implements commands to read or write a sector by moving the arm assembly and transferring data to and from the disk surfaces. A checksum is computed for when data is written to a sector and stored with the sector. The checksum is computed again when the data on the sector is read back. If the sector is corrupted or the

CHAPTER 9 An Example of a Current Disk: The IBM Deskstar 14G~~~Th~l IBM Deskstar 14GPX is a 3.5 inch§.J4.4 GB hfl,rd disk with an average seek time of 9.1 miUisecoudsTmsec) and an average rotationa

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
*Source: dbms-ramakrishnan-3rd-edition, Pages 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353*
