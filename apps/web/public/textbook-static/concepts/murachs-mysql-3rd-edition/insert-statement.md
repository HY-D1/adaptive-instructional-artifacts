# The INSERT Statement

## Definition
Adding new rows to a table using INSERT INTO with VALUES or SELECT

## Explanation
136 Section 1 An introduction to MySQL How to join tables with the NATURAL keyword Figure 4-11 shows how to use the NATURAL keyword to code a natural join. When you code a natural join, you don't specify the column that's used to join the two tables. Instead, the database automatically joins the two tables based on all columns in the two tables that have the same name. As a result, this type of join only works correctly if the database is designed in a certain way. For instance, if you use a natural join to join the Vendors and Invoices tables as shown in the first example, the join works correctly because these tables only have one column in common: the vendor_id column. As a result, the database joins these two tables on the vendor_id column. However, if these tables had another column in common, this query would attempt to join these tables on both columns and wot1ld yield unexpected results. In addition, you may get unexpected results if you use natural joins for complex queries. In that case,

to join these tables on both columns and wot1ld yield unexpected results. In addition, you may get unexpected results if you use natural joins for complex queries. In that case, you can use the USING or ON clause to explicitly specify the join since these clauses give you more control over the join. If neces- sary, you can mix a natural join with the USING or ON clause within a single SELECT statement. In this figure, for example, the second SELECT statement uses a natural join for the first join and a USING clat1se for the second join. The result is the same as the result for the second statement in figure 4-10. Finally, since natural joins don't explicitly specify the join colu1nn, they may not work correctly if the structure of the database changes later. So although natural joins are easy to code, you'll usually want to avoid using them for production code.

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
