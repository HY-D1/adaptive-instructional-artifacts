# The ORDER BY Clause

## Definition
Sorting result sets by one or more columns in ascending or descending order

## Explanation

single column. In the first example, the rows in the Vendors table are sorted in ascending sequence by the vendor_name column. Since ascending is the default sequence, the ASC keyword can be omitted. In the second example, the rows are sorted by the vendor_name column in descending sequence. To sort by more than one column, you simply list the names in the ORDER BY clause separated by commas as shown in the third example. This can be referred to as a nested sort because one sort is nested within another. Here, the rows in the Vendors table are first sorted by the vendor_state column in ascending sequence. Then, within each state, the rows are sorted by the vendor_city column in ascending sequence. Finally, within each city, the rows are sorted by the vendor_name column in ascending sequence.

Chapter 3 How to retrieve data from a sin.gle table 105 The expanded syntax of the ORDER BY clause ORDER BY expression [ASCIDESC] [, expression [ASCIDESC]] ••. An ORDER BY clause that sorts by one column in ascending sequenc

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
*Source: murachs-mysql-3rd-edition, Pages 124, 125, 126, 127, 128, 129*