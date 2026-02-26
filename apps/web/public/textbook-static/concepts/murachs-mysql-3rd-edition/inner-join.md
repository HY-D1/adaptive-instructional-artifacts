# Inner Joins

## Definition
Retrieving matching rows from two or more tables

## Explanation
122 Section 1 An introduction to MySQL How to use a self-join A self-join. joins a table to itself. Although self-joins are rare, they are sometimes useful for retrieving data that can't be retrieved any other way. For example, figure 4-5 presents a self-join that returns rows from the Vendors table where the vendor is in a city and state that has at least one other vendor. In other words, it does not return a vendor if that vendor is the only vendor in that city and state. Since this example uses the same table twice, it must use aliases to distin- guish one occurrence of the table from the other. In addition, this query must qualify each column name with a table alias since every column occurs in both tables. Then, the join condition uses three comparisons. The first two match the vendor_city and vendor_state columns in the two tables. As a result, the query returns rows for vendors that are in the same city and state as another vendor. However, since a vendor resides in the same city

tables. As a result, the query returns rows for vendors that are in the same city and state as another vendor. However, since a vendor resides in the same city and state as itself, a third comparison is included to exclt1de rows that match a vendor with itself. To do that, this condition uses the not-equal operator to compare the vendor_name columns in the two tables. In addition, this statement includes the DISTINCT keyword. That way, a vendor appears only once in the result set. Otherwise, a vendor would appear once for every other row with a matching city and state. For example, if a vendor is in a city and state that has nine other vendors in that city and state, this query would return nine rows for that vendor. This example also shows how you can use columns other than key columns in a join condition. Keep in nund, however, that this is an unusual situation and you 're not likely to code joins like this often.

Chapter 4 How to retrieve data f rom two or m.ore tables 123 A sel

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
*Source: murachs-mysql-3rd-edition, Pages 142, 143, 144, 145, 146, 147*
