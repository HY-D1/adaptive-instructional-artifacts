# Logical Operators

## Definition
Using AND, OR, NOT, IN, BETWEEN to combine filter conditions

## Explanation
Chapter 3 How to retrieve datafrom a sin.gle table 99 The syntax of the WHERE clause with a BETWEEN phrase WHERE test_expression [NOT] BETWEEN begin_ expression AND end_ expression Examples of the BETWEEN phrase A BETWEEN phrase with literal values WHERE invoice_date BETWEEN '2018-06-01' AND '2018-06-30' A BETWEEN phrase preceded by NOT WHERE vendor_ zip_ code NOT BETWEEN 93600 AND 93799 A BETWEEN phrase with a test expression coded as a calculated value WHERE invoice_total - payment_total - credit_total BETWEEN 200 AND 500 A BETWEEN phrase with the upper and lower limits coded as calculated values WHERE payment_ total BETWEEN credit_total AND credit_total + 500 Description • You can use the BETWEEN phrase to test whether an expression falls within a range of values. The lower limit must be coded as the first expression, and the upper limit must be coded as the second expression. Otherwise, MySQL returns an empty result set. • The two expressions used in the BETWEEN phrase for the range of values are inclusive. That is, the result set includes values that are equal to the

result set. • The two expressions used in the BETWEEN phrase for the range of values are inclusive. That is, the result set includes values that are equal to the upper or lower limit. • You can use the NOT operator to test for an expression that's not within the given range. Figure 3-13 How to use the BETWEEN operator

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
*Source: murachs-mysql-3rd-edition, Pages 119, 120, 121, 122, 123*