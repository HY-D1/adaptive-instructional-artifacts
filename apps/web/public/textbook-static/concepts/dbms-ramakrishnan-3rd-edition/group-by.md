# The GROUP BY Clause

## Definition
Grouping rows for aggregate calculations

## Explanation
154 CHAPTEFt,~5 Relationa~ Algebra and SQL: ~~~~:egation is a fUIl~~~:·mental operati(~:l-'-l that canIlot be expressed in relational algebra. Similarly, SQL'8 grouping I construct cannot be expressed in algebra. I L..- ._. .....__ . I a rating of 10. The use of ANY intuitively corresponds to the use of MIN, instead of MAX, in the previous query. 5.5.1 The GROUP BY and HAVING Clauses Thus far, we have applied aggregate operations to all (qualifying) rows in a relation. Often we want to apply aggregate operations to each of a number of groups of rows in a relation, where the number of groups depends on the relation instance (i.e., is not known in advance). For example, consider the following query. (Q31) Find the age of the youngest sailor for each rating level. If we know that ratings are integers in the range 1 to la, we could write 10 queries of the form: SELECT MIN (S.age) FROM Sailors S WHERE S.rating = i where i = 1,2, ... ,10. vVriting 10 such queries is tedious. More important, we may not know what

form: SELECT MIN (S.age) FROM Sailors S WHERE S.rating = i where i = 1,2, ... ,10. vVriting 10 such queries is tedious. More important, we may not know what rating levels exist in advance. To write such queries, we need a major extension to the basic SQL query form, namely, the GROUP BY clause. In fact, the extension also includes an optional HAVING clause that can be used to specify qualificatioIls over groups (for example, we may be interested only in rating levels> 6. The general form of an SQL query with these extensions is: SELECT [ DISTINCT] select-list FROM from-list WHERE 'qualification GROUP BY grouping-list HAVING group-qualification Using the GROUP BY clause, we can write Q:n a.s follows: SELECT S.rating, MIN (S.age)

S(JL: queries. Constraints. Triggers FROM Sailors S GROUP BY S.rating Let us consider some important points concerning the new clauses: II The select-list in the SELECT clause consists of (1) a list of column names and (2) a list of terms 

## Examples
### Example 1: SELECT Example
```sql
SELECT MIN (S.age) FROM Sailors S WHERE S.rating = i where i = 1,2, ... ,10. vVriting 10 such queries is tedious. More important, we may not know what

form: SELECT MIN (S.age) FROM Sailors S WHERE S.rating = i where i = 1,2, ... ,10. vVriting 10 such queries is tedious. More important, we may not know what rating levels exist in advance. To write such queries, we need a major extension to the basic SQL query form, namely, the GROUP BY clause. In fact, the extension also includes an optional HAVING clause that can be used to specify qualificatioIls over groups (for example, we may be interested only in rating levels> 6. The general form of an SQL query with these extensions is: SELECT [ DISTINCT] select-list FROM from-list WHERE 'qualification GROUP BY grouping-list HAVING group-qualification Using the GROUP BY clause, we can write Q:n a.s follows: SELECT S.rating, MIN (S.age)

S(JL: queries. Constraints. Triggers FROM Sailors S GROUP BY S.rating Let us consider some important points concerning the new clauses: II The select-list in the SELECT clause consists of (1) a list of column names and (2) a list of terms having the form aggop ( column-name) AS new- name. vVe already saw AS used to rename output columns. Columns that are the result of aggregate operators do not already have a column name, and therefore giving the column a name with AS is especially useful. Every column that appears in (1) must also appear in grouping-list. The reason is that each row in the result of the query corresponds to one gmup, which is a collection of rows that agree on the values of columns in grouping- list. In general, if a column appears in list (1), but not in grouping-list, there can be multiple rows within a group that have different values in this column, and it is not clear what value should be assigned to this column in an answer row. We can sometimes use primary key

that have different values in this column, and it is not clear what value should be assigned to this column in an answer row. We can sometimes use primary key information to verify that a column has a unique value in all rows within each group. For example, if the grouping-list contains the primary key of a table in the from-list, every column of that table has a unique value within each group. In SQL:1999, such columns are also allowed to appear in part (1) of the select-list. II The expressions appearing in the group-qualification in the HAVING clause must have a single value per group. The intuition is that the HAVING clause determines whether an answer row is to be generated for a given group. To satisfy this requirement in SQL-92, a column appearing in the group- qualification must appear a'3 the argument to an aggregation operator, or it must also appear in grouping-list. In SQL:1999, two new set functions have been introduced that allow us to check whether every or any row in a group satisfies a condition;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT FROM WHERE GROUP BY HAVING S.rating, MIN (S.age) AS minage Sailors S S.age >= 18 S.rating COUNT (*) > 1

156 CHAPTERl,5 vVe will evaluate this query on instance 83 of Sailors, reproduced in Figure 5.10 for convenience. The instance of Sailors on which this query is to be evaluated is shown in Figure 5.10. Extending the conceptual evaluation strategy presented in Section 5.2, we proceed as follows. The first step is to construct the cross- product of tables in the from-list. Because the only relation in the from-list in Query Q32 is Sailors, the result is just the instance shown in Figure 5.10. 22 Dustin 7 45.0 29 Brutus 1 33.0 31 Lubber 8 55.5 32 Andy 8 25.5 58 Rusty 10 35.0 64 Horatio 7 35.0 71 Zorba 10 16.0 74 Horatio 9 35.0 85 Art 3 25.5 95 Bob 3 63.5 96 Frodo 3 25.5 Figure 5.10 Instance 53 of Sailors The second step is to apply the qualification in the WHERE clause, S. age >= 18. This step eliminates the row (71, zorba, 10, 16). The third step is to eliminate unwanted columns. Only columns mentioned in the SELECT clause, the GROUP BY clause, or the

This step eliminates the row (71, zorba, 10, 16). The third step is to eliminate unwanted columns. Only columns mentioned in the SELECT clause, the GROUP BY clause, or the HAVING clause are necessary, which means we can eliminate sid and sname in our example. The result is shown in Figure 5.11. Observe that there are two identical rows with rating 3 and age 25.5-SQL does not eliminate duplicates except when required to do so by use of the DISTINCT keyword! The number of copies of a row in the intermediate table of Figure 5.11 is determined by the number of rows in the original table that had these values in the projected columns. The fourth step is to sort the table according to the GROUP BY clause to identify the groups. The result of this step is shown in Figure 5.12. The fifth step ,-is to apply the group-qualification in the HAVING clause, that is, the condition COUNT (*) > 1. This step eliminates the groups with rating equal to 1, 9, and 10. Observe that the order in

in the HAVING clause, that is, the condition COUNT (*) > 1. This step eliminates the groups with rating equal to 1, 9, and 10. Observe that the order in which the WHERE and GROUP BY clauses are considered is significant: If the WHERE clause were not consid- ered first, the group with rating=10 would have met the group-qualification in the HAVING clause. The sixth step is to generate one answer row for each remaining group. The answer row corresponding to a group consists of a subset

SqL: queries, Constraints, Triggers 3 25.5 3 25.5 3 63.5 55.5 25.5 35.0 35.0 I 10 ~~tl?l (J;
```
Example SELECT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 189, 190, 191, 192, 193, 194, 195, 196*
