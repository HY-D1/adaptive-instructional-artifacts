# Correlated Subqueries

## Definition
Subqueries that reference columns from the outer query

## Explanation
212 Section 2 More SQL skills cts you need them How to code correlated subqueries So far, all of the subqueries in this chapter have been uncorrelated subque- ries. An uncorrelated subquery is executed only once for the entire query. However, you can also code a correlated subquery that's executed once for each row that's processed by the main query. This type of query is similar to using a loop to do repetitive processing in a procedural programming language like PHP or Java. Figure 7-7 shows how correlated subqueries work. The example 1·etrieves rows from the Invoices table for those invoices that have an invoice total that's greater than the average of all the invoices for the same vendor. To do that, the WHERE clause of the subquery refers to the vendor_id value of the main query. That way, only the invoices for the current vendor are included in the average. Each time MySQL processes a row in the main query, it substitutes the value in the vendor_id column for the column reference in the subquery. Then, MySQL executes the

average. Each time MySQL processes a row in the main query, it substitutes the value in the vendor_id column for the column reference in the subquery. Then, MySQL executes the subquery based on that value. For example, if the vendor_ id value is 95, MySQL executes this subquery: SELECT AVG (invoice_ total) FROM i nvoic e s WHERE vendor_ id = 95 After MySQL executes this subquery, it uses the returned value to detern1ine whether to include the current invoice in the result set. For example, for vendor 95, the subquery returns a value of 28.501667. Then, MySQL compares that value with the invoice total of the current invoice. If the invoice total is greater than that value, MySQL includes the invoice in the result set. Otherwise, it doesn't. MySQL repeats this process until it has processed each of the invoices in the Invoices table. In this figure, the WHERE clause of the subquery qualifies the vendor_id column from the main query with the ali

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
*Source: murachs-mysql-3rd-edition, Pages 232, 233, 234, 235, 236, 237, 238*
