# The HAVING Clause

## Definition
Filtering grouped results based on aggregate conditions

## Explanation
162 GHAPTER r5 r-_ m . I The Relational Model and SQL: Null values arc not part of the bask I relational model. Like SQL's treatment of tables as multisets of tuples, ~liS is a del~.~~~~r~...~~~..1~._t_h_e_l_)ru_s_,i_c_l_l1_o_d_e_1. ----' SELECT FROM WHERE Temp.rating, Temp.avgage ( SELECT S.rating, AVG (S.age) AS avgage, FROM Sailors S GROUP BY S.rating) AS Temp Temp.avgage = ( SELECT MIN (Temp.avgage) FROM Temp) The answer to this query on instance 53 is (10, 25.5). As an exercise, consider whether the following query computes the same answer. SELECT FROM GROUP BY Temp.rating, MIN (Temp.avgage ) ( SELECT S.rating, AVG (S.age) AS FROM Sailors S GROUP BY S.rating) AS Temp Temp.rating avgage, 5.6 NULL VALUES Thus far, we have assumed that column values in a row are always known. In practice column values can be unknown. For example, when a sailor, say Dan, joins a yacht club, he may not yet have a rating assigned. Since the definition for the Sailors table has a rating column, what row should we insert for Dan? \\That is needed here is a special

yet have a rating assigned. Since the definition for the Sailors table has a rating column, what row should we insert for Dan? \\That is needed here is a special value that denotes unknown. Suppose the Sailor table definition was modified to include a rnaiden-name column. However, only married women who take their husband's last name have a maiden name. For women who do not take their husband's name and for men, the nw'idcn-nmnc column is inapphcable. Again, what value do we include in this column for the row representing Dan? SQL provides H special column value called null to use in such situations. "Ve use null when the column value is either 'lJ,nknown or inapplicable. Using our Sailor table definition, we might enter the row (98. Dan, null, 39) to represent Dan. The presence of null values complicates rnany issues, and we consider the impact of null values on SQL in this section.

SQL: Q'lteT'leS, ConstT'aJnt." Trigger's

## Examples
### Example 1: SELECT Example
```sql
SELECT FROM WHERE Temp.rating, Temp.avgage ( SELECT S.rating, AVG (S.age) AS avgage, FROM Sailors S GROUP BY S.rating) AS Temp Temp.avgage = ( SELECT MIN (Temp.avgage) FROM Temp) The answer to this query on instance 53 is (10, 25.5). As an exercise, consider whether the following query computes the same answer. SELECT FROM GROUP BY Temp.rating, MIN (Temp.avgage ) ( SELECT S.rating, AVG (S.age) AS FROM Sailors S GROUP BY S.rating) AS Temp Temp.rating avgage, 5.6 NULL VALUES Thus far, we have assumed that column values in a row are always known. In practice column values can be unknown. For example, when a sailor, say Dan, joins a yacht club, he may not yet have a rating assigned. Since the definition for the Sailors table has a rating column, what row should we insert for Dan? \\That is needed here is a special

yet have a rating assigned. Since the definition for the Sailors table has a rating column, what row should we insert for Dan? \\That is needed here is a special value that denotes unknown. Suppose the Sailor table definition was modified to include a rnaiden-name column. However, only married women who take their husband's last name have a maiden name. For women who do not take their husband's name and for men, the nw'idcn-nmnc column is inapphcable. Again, what value do we include in this column for the row representing Dan? SQL provides H special column value called null to use in such situations. "Ve use null when the column value is either 'lJ,nknown or inapplicable. Using our Sailor table definition, we might enter the row (98. Dan, null, 39) to represent Dan. The presence of null values complicates rnany issues, and we consider the impact of null values on SQL in this section.

SQL: Q'lteT'leS, ConstT'aJnt." Trigger's 5.6.1 Comparisons Using Null Values Consider a comparison such as rat'in,g = 8. If this is applied to the row for Dan, is this condition true or false'? Since Dan's rating is unknown, it is reasonable to say that this comparison should evaluate to the value unknown. In fact, this is the C::lse for the comparisons rating> 8 and rating < 8 &'3 well. Perhaps less obviously, if we compare two null values using <, >, =, and so on, the result is always unknown. For example, if we have null in two distinct rows of the sailor relation, any comparison returns unknown. SQL also provides a special comparison operator IS NULL to test whether a column value is null;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT S.sid, R.bid FROM Sailors S NATURAL LEFT OUTER JOIN Reserves R The NATURAL keyword specifies that the join condition is equality on all common attributes (in this example, sid), and the WHERE clause is not required (unless

Hj5 we want to specify additional, non-join conditions). On the instances of Sailors and Reserves shown in Figure 5.6, this query computes the result shown in Figure 5.19. I sid I bid I 22 101 31 null 58 103 Figure 5.19 Left Outer Join of Sailo7"1 and Rese1<Jesl 5.6.5 Disallowing Null Values We can disallow null values by specifying NOT NULL as part of the field def- inition;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
insert for Dan? \\That is needed here is a special

yet have a rating assigned. Since the definition for the Sailors table has a rating column, what row should we insert for Dan? \\That is needed here is a special value that denotes unknown. Suppose the Sailor table definition was modified to include a rnaiden-name column. However, only married women who take their husband's last name have a maiden name. For women who do not take their husband's name and for men, the nw'idcn-nmnc column is inapphcable. Again, what value do we include in this column for the row representing Dan? SQL provides H special column value called null to use in such situations. "Ve use null when the column value is either 'lJ,nknown or inapplicable. Using our Sailor table definition, we might enter the row (98. Dan, null, 39) to represent Dan. The presence of null values complicates rnany issues, and we consider the impact of null values on SQL in this section.

SQL: Q'lteT'leS, ConstT'aJnt." Trigger's 5.6.1 Comparisons Using Null Values Consider a comparison such as rat'in,g = 8. If this is applied to the row for Dan, is this condition true or false'? Since Dan's rating is unknown, it is reasonable to say that this comparison should evaluate to the value unknown. In fact, this is the C::lse for the comparisons rating> 8 and rating < 8 &'3 well. Perhaps less obviously, if we compare two null values using <, >, =, and so on, the result is always unknown. For example, if we have null in two distinct rows of the sailor relation, any comparison returns unknown. SQL also provides a special comparison operator IS NULL to test whether a column value is null;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 197, 198, 199, 200, 201*
