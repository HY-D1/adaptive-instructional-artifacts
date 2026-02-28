# Stored Procedures and Functions

## Definition
Creating reusable SQL code blocks stored in the database

## Explanation
RTtemal Sorting I Inputfile PASS 0 I-page runs ~-, PASS 2-page runs -----C~--~,.._L----------"'>....,__---__O>"L.---~PASS 2 4-page runs ---------""'----=::-------=-~-------PASS3 1,2 2,3 425 ;~ 3,4 4,5 6,6 7,8 8-page runs Figure 13.2 Two-Way Merge Sort of a Seven-Page File c ~ r:=:- ------- [iNPUT 1 I~I OUTPUT ) .. [!NPUT2 1/ Disk Main memory buffers Disk Figure 13.3 Two-'Way Merge Sort with Three Buffer Pages

426 CHAPTER~3 pages). This modification is illustrated in Figure 13.4, using the input file from Figure 13.2 and a buffer pool with four pages. 2. In passes i = 1,2, ... use B-1 buffer pages for input and use the remaining page for output; hence, you do a (B - I)-way merge in each pass. The utilization of buffer pages in the merging passes is illustrated in Figure 13.5. 2,3 8,9 2nd output run 4,4 6 , 7 1st output run ! '2 3,5 6 Buffer pool with B:::4 pages Input file Figure 13.4 External Merge Sort with B Buffer Pages: Pass 0 ¢ ¢ ¢ Disk ! ~UTl ~ IINPUT2 I > I~I OUTPUT B main memory buffers ¢ ¢ ¢ Disk Figure 13.5 External IVlerge Sort with B Buffer Pages: Pass 'i > 0 The first refinement reduces the number of runs produced by Pass 0 to NI rN / Bl, versus N for the two-way merge. l The second refinement is even more important. By doing a (B ~ I)-way merge, the number of passes is reduced

rN / Bl, versus N for the two-way merge. l The second refinement is even more important. By doing a (B ~ I)-way merge, the number of passes is reduced dramatically including the initial pass, it becomes rZ0.9B- 1NIl + 1 versus [loY2Nl + 1 for the two-way merge algorithm presented earlier. Because B is 1Note that the technique used for sorting data in buffer pages is orthogonal to external sorting. You could use, say, Quicksort for sorting data in buffer pages.

External Sorting 427 typically quite large, the savings can be substantial. The external merge sort algorithm is shown is Figure 13.6. proc extsort (file) / / Given a file on disk, sorts it using three buffer pages / / P

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
*Source: dbms-ramakrishnan-3rd-edition, Pages 460, 461, 462, 463, 464, 465, 466, 467, 468, 469, 470, 471, 472, 473*
