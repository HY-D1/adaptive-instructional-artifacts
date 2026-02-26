# Creating Tables and Indexes

## Definition
Using CREATE TABLE, ALTER TABLE, CREATE INDEX, and DROP statements

## Explanation
Storing Data: Disks aTul File,s 32~ Linked List of Pages One possibility is to maintain a heap file as a doubly linked list of pages. The DBMS can remember where the first page is located by maintaining a table containing pairs of (heap_file_name, page_Laddr) in a known location on disk. We call the first page of the file the header page. An important task is to maintain information about empty slots created by deleting a record from the heap file. This task has two distinct parts: how to keep track of free space within a page and how to keep track of pages that have some free space. We consider the first part in Section 9.6. The second part can be addressed by maintaining a doubly linked list of pages with free space and a doubly linked list of full pages; together, these lists contain all pages in the heap file. This organization is illustrated in Figure 9.4; note that each pointer is really a page id. Data page Data page Linked list of full pages Linked list of pages

file. This organization is illustrated in Figure 9.4; note that each pointer is really a page id. Data page Data page Linked list of full pages Linked list of pages with free space page Data Data page Figure 9.4 Heap File Organization with a Linked List If a new page is required, it is obtained by making a request to the disk space manager and then added to the list of pages in the file (probably as a page with free space, because it is unlikely that the new record will take up all the space on the page). If a page is to be deleted from the heap file, it is removed from the list and the disk space Inanager is told to deallocate it. (Note that the scheme can easily be generalized to allocate or deallocate a sequence of several pages and maintain a doubly linked list of these page sequences.) One disadvantage of this scheIue is that virtually all pages in a file will be on the free list if records are of variable length, because it

these page sequences.) One disadvantage of this scheIue is that virtu

## Examples
### Example 1: INSERT Example
```sql
insert a typical record, we must retrieve and exaInine several pages on the free list before we find one with enough free space. The directory-based heap file organization that we discuss next addresses this problem.

326 Directory of Pages CHAPTER,g An alternative to a linked list of pages is to maintain a directory of pages. The DBMS must remember where the first directory page of each heap file is located. The directory is itself a collection of pages and is shown as a linked list in Figure 9.5. (Other organizations are possible for the directory itself, of course.) Header page Data page 2 Data page N DIRECTORY Figure 9.5 Heap File Organization with a Directory Each directory entry identifies a page (or a sequence of pages) in the heap file. As the heap file grows or shrinks, the number of entries in the directory-and possibly the number of pages in the directory itself--grows or shrinks corre- spondingly. Note that since each directory entry is quite small in comparison to a typical page, the size of the directory is likely to be very small in comparison to the size of the heap file. Free space can be managed by maintaining a bit per entry, indicating whether the corresponding page has any free space, or a count

to the size of the heap file. Free space can be managed by maintaining a bit per entry, indicating whether the corresponding page has any free space, or a count per entry, indicating the amount of free space on the page. If the file contains variable-length records, we can examine the free space count for an entry to determine if the record fits on the page pointed to by the entry. Since several entries fit on a directory page, we can efficiently search for a data page with enough space to hold a record to be inserted. 9.6 PAGE FORMATS The page abstraction is appropriate when dealing with I/O issue-s, but higher levels of the DBMS see data a..<;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 360, 361, 362, 363, 364, 365, 366, 367, 368, 369, 370, 371*
