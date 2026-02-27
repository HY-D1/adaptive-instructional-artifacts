# The INSERT Statement

## Definition
Adding new rows to a table using INSERT INTO with VALUES or SELECT

## Explanation

to join these tables on both columns and would yield unexpected results. In addition, you may get unexpected results if you use natural joins for complex queries. In that case, you can use the USING or ON clause to explicitly specify the join since these clauses give you more control over the join. If neces- sary, you can mix a natural join with the USING or ON clause within a single SELECT statement. In this figure, for example, the second SELECT statement uses a natural join for the first join and a USING clat1se for the second join. The result is the same as the result for the second statement in figure 4-10. Finally, since natural joins don't explicitly specify the join colu1nn, they may not work correctly if the structure of the database changes later. So although natural joins are easy to code, you'll usually want to avoid using them for production code.

Chapter 4 How to retrieve data f rom two or m.ore tables 137 The syntax for a join that uses the NATURAL keywor

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
*Source: murachs-mysql-3rd-edition, Pages 156, 157, 158, 159, 160, 161, 162, 163*