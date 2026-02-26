# Subqueries

## Definition
Using queries nested inside other queries for complex data retrieval

## Explanation
200 Section 2 More SQL skills cts you need them An introduction to subqueries As you learned in chapter 5, a subquery is a SELECT statement that's coded within another SQL statement. Since you already know how to code SELECT statements, you already know how to code subqueries. Now you just need to learn where you can code them and when you should use them. Where to code subqueries Figure 7-1 shows that a subquery can be coded, or introduced, in the WHERE, HAVING, FROM, or SELECT clause of a SELECT statement. In this figure, for example, the SELECT statement shows how you can use a subquery in a WHERE clause. This statement retrieves all the invoices from the Invoices table that have invoice totals greater than the average of all the invoices. To do that, the subquery calculates the average of all the invoices. Then, the search condition tests each invoice to see if its invoice total is greater than that average. When a subquery returns a single value as it does in this example, you can use it

each invoice to see if its invoice total is greater than that average. When a subquery returns a single value as it does in this example, you can use it anywhere you would normally use a single value. However, a subquery can also return a list of values (a result set that has one column). In that case, you can use the subque1·y in place of a list of values, such as the list for an IN operator. In addition, a subquery can return a table of values (a result set that has multiple columns). In that case, you can use the subquery in the FROM clause in place of a table. In this chapter, you '11 learn about all of these different types of subqueries. Finally, you can code a subquery within another subquery. In that case, the subqueries are said to be nested. Because nested subqueries can be difficult to read, you should use them only when necessary.

Chapter 7 How to l·ode subqueries 201 Four ways to introduce a subquery in a SELECT statement 1. In a WHERE clause as a search conditio

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
*Source: murachs-mysql-3rd-edition, Pages 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231*
