---
id: subqueries
title: Subqueries
definition: Nested queries - using SELECT statements within other SQL statements
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p195:c1
  - dbms-ramakrishnan-3rd-edition:p195:c2
  - dbms-ramakrishnan-3rd-edition:p196:c1
  - dbms-ramakrishnan-3rd-edition:p196:c2
  - dbms-ramakrishnan-3rd-edition:p196:c3
  - dbms-ramakrishnan-3rd-edition:p197:c1
  - dbms-ramakrishnan-3rd-edition:p197:c2
  - dbms-ramakrishnan-3rd-edition:p198:c1
  - dbms-ramakrishnan-3rd-edition:p198:c2
  - dbms-ramakrishnan-3rd-edition:p198:c3
  - dbms-ramakrishnan-3rd-edition:p199:c1
  - dbms-ramakrishnan-3rd-edition:p199:c2
  - dbms-ramakrishnan-3rd-edition:p199:c3
  - dbms-ramakrishnan-3rd-edition:p200:c1
  - dbms-ramakrishnan-3rd-edition:p200:c2
  - dbms-ramakrishnan-3rd-edition:p201:c1
  - dbms-ramakrishnan-3rd-edition:p201:c2
  - dbms-ramakrishnan-3rd-edition:p202:c1
  - dbms-ramakrishnan-3rd-edition:p202:c2
  - dbms-ramakrishnan-3rd-edition:p202:c3
  - dbms-ramakrishnan-3rd-edition:p203:c1
  - dbms-ramakrishnan-3rd-edition:p203:c2
  - dbms-ramakrishnan-3rd-edition:p204:c1
  - dbms-ramakrishnan-3rd-edition:p204:c2
  - dbms-ramakrishnan-3rd-edition:p204:c3
  - dbms-ramakrishnan-3rd-edition:p205:c1
  - dbms-ramakrishnan-3rd-edition:p205:c2
  - dbms-ramakrishnan-3rd-edition:p205:c3
  - dbms-ramakrishnan-3rd-edition:p206:c1
  - dbms-ramakrishnan-3rd-edition:p206:c2
  - dbms-ramakrishnan-3rd-edition:p207:c1
  - dbms-ramakrishnan-3rd-edition:p207:c2
  - dbms-ramakrishnan-3rd-edition:p207:c3
  - dbms-ramakrishnan-3rd-edition:p208:c1
  - dbms-ramakrishnan-3rd-edition:p208:c2
  - dbms-ramakrishnan-3rd-edition:p208:c3
  - dbms-ramakrishnan-3rd-edition:p209:c1
  - dbms-ramakrishnan-3rd-edition:p209:c2
  - dbms-ramakrishnan-3rd-edition:p209:c3
  - dbms-ramakrishnan-3rd-edition:p210:c1
  - dbms-ramakrishnan-3rd-edition:p210:c2
  - dbms-ramakrishnan-3rd-edition:p210:c3
  - dbms-ramakrishnan-3rd-edition:p211:c1
  - dbms-ramakrishnan-3rd-edition:p211:c2
  - dbms-ramakrishnan-3rd-edition:p211:c3
  - dbms-ramakrishnan-3rd-edition:p211:c4
relatedConcepts:
tags:
  - sql
  - subqueries
  - nested
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Subqueries

## Definition
Nested queries - using SELECT statements within other SQL statements

## Explanation
CHAPTER.;5 (Q35) Find the average age of sailors 'Who aTe of voting age (i.e.~ at least 18 year8 old) for each 'rating level that has at least two sailors. SELECT FROM WHERE GROUP BY HAVING S.rating, AVG ( S.age) AS avgage Sailors S S. age >= 18 S.rating 1 < ( SELECT COUNT (*) FROM Sailors S2 WHERE S.rating = S2.rating) In this variant of Query Q34, we first remove tuples with age <= 18 and group the remaining tuples by rating. For each group, the subquery in the HAVING clause computes the number of tuples in Sailors (without applying the selection age <= 18) with the same rating value as the current group. If a group has less than two sailors, it is discarded. For each remaining group, we output the average age. The answer to this query on instance 53 is shown in Figure 5.17. Note that the answer is very similar to the answer for Q34, with the only difference being that for the group with rating 10, we now ignore the sailor with age 16 while

5.17. Note that the answer is very similar to the answer for Q34, with the only difference being that for the group with rating 10, we now ignore the sailor with age 16 while computing the average. (Q36) Find the average age oj sailors who aTe of voting age (i.e., at least 18 yeaTs old) JOT each rating level that has at least two such sailors. SELECT FROM WHERE GROUP BY HAVING S.rating, AVG ( S.age) AS avgage Sailors S S. age> 18 S.rating 1 < ( SELECT COUNT (*) FROM Sailors S2 WHERE S.rating = S2.rating AND S2.age >= 18) This formulation of the query reflects its similarity to Q35. The answer to Q36 on instance 53 is shown in that there is no tuple for rating 10, since there is only one tuple with rating 10 and age 2 18. Query Q36 is actually very similar to Q32, as the following simpler formulation shows: SELECT FROM WHERE GROUP BY S.rating, AVG Sailors S S. age> 18 S.rating ( S.age) AS avgage

SQL: QueTies, Constraints, Triggers HAVING COUNT (*) > 1 This formulation of Q36 takes advantage of the fact that the WHERE clause is

## Examples
### Example 1: SELECT Example
```sql
SELECT FROM WHERE GROUP BY HAVING S.rating, AVG ( S.age) AS avgage Sailors S S. age >= 18 S.rating 1 < ( SELECT COUNT (*) FROM Sailors S2 WHERE S.rating = S2.rating) In this variant of Query Q34, we first remove tuples with age <= 18 and group the remaining tuples by rating. For each group, the subquery in the HAVING clause computes the number of tuples in Sailors (without applying the selection age <= 18) with the same rating value as the current group. If a group has less than two sailors, it is discarded. For each remaining group, we output the average age. The answer to this query on instance 53 is shown in Figure 5.17. Note that the answer is very similar to the answer for Q34, with the only difference being that for the group with rating 10, we now ignore the sailor with age 16 while

5.17. Note that the answer is very similar to the answer for Q34, with the only difference being that for the group with rating 10, we now ignore the sailor with age 16 while computing the average. (Q36) Find the average age oj sailors who aTe of voting age (i.e., at least 18 yeaTs old) JOT each rating level that has at least two such sailors. SELECT FROM WHERE GROUP BY HAVING S.rating, AVG ( S.age) AS avgage Sailors S S. age> 18 S.rating 1 < ( SELECT COUNT (*) FROM Sailors S2 WHERE S.rating = S2.rating AND S2.age >= 18) This formulation of the query reflects its similarity to Q35. The answer to Q36 on instance 53 is shown in that there is no tuple for rating 10, since there is only one tuple with rating 10 and age 2 18. Query Q36 is actually very similar to Q32, as the following simpler formulation shows: SELECT FROM WHERE GROUP BY S.rating, AVG Sailors S S. age> 18 S.rating ( S.age) AS avgage

SQL: QueTies, Constraints, Triggers HAVING COUNT (*) > 1 This formulation of Q36 takes advantage of the fact that the WHERE clause is applied before grouping is done;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT FROM WHERE Temp.rating, Temp.avgage ( SELECT S.rating, AVG ( S.age) AS COUNT (*) AS ratingcount FROM Sailors S WHERE S. age> 18 GROUP BY S.rating) AS Temp Temp.ratingcount > 1 avgage, This alternative brings out several interesting points. First, the FROM clause can also contain a nested subquery according to the SQL standard. 7 Second, the HAVING clause is not needed at all. Any query with a HAVING clause can be rewritten without one, but many queries are simpler to express with the HAVING clause. Finally, when a subquery appears in the FROM clause, using the AS keyword to give it a name is necessary (since otherwise we could not express, for instance, the condition Temp. ratingcount > 1). (Q37) Find those ratings fOT which the average

using the AS keyword to give it a name is necessary (since otherwise we could not express, for instance, the condition Temp. ratingcount > 1). (Q37) Find those ratings fOT which the average age of sailoTS is the m'inirnum over all ratings. We use this query to illustrate that aggregate operations cannot be nested. One might consider writing it as follows: SELECT FROM WHERE S.rating Sailors S AVG (S.age) = ( SELECT MIN (AVG (S2.age)) FROM Sailors S2 GROUP BY S2.rating) A little thought shows that this query will not work even if the expression MIN (AVG (S2.age)), which is illegal, were allowed. In the nested query, Sailors is partitioned int,o groups by rating, and the average age is computed for each rating value. for each group, applying MIN to this average age value for the group will return the same value! A correct version of this query follows. It essentially computes a temporary table containing the average age for each rating value and then finds the rating(s) for which this average age is the minimum. 7Not all commercial database

follows. It essentially computes a temporary table containing the average age for each rating value and then finds the rating(s) for which this average age is the minimum. 7Not all commercial database systems currently support nested queries in the FROM clause.

GHAPTER r5 r-_ m. I The Relational Model and SQL: Null values arc not part of the bask I relational model. Like SQL's treatment of tables as multisets of tuples, ~liS is a del~.~~~~r~...~~~..1~._t_h_e_l_)ru_s_,i_c_l_l1_o_d_e_1. ----' SELECT FROM WHERE Temp.rating, Temp.avgage ( SELECT S.rating, AVG (S.age) AS avgage, FROM Sailors S GROUP BY S.rating) AS Temp Temp.avgage = ( SELECT MIN (Temp.avgage) FROM Temp) The answer to this query on instance 53 is (10, 25.5). As an exercise, consider whether the following query computes the same answer. SELECT FROM GROUP BY Temp.rating, MIN (Temp.avgage) ( SELECT S.rating, AVG (S.age) AS FROM Sailors S GROUP BY S.rating) AS Temp Temp.rating avgage, 5.6 NULL VALUES Thus far, we have assumed that column values in a row are always known. In practice column values can be unknown. For example, when a sailor, say Dan, joins a yacht club, he may not yet have a rating assigned. Since the definition for the Sailors table has a rating column, what row should we insert for Dan? \\That is needed here is a special value that denotes

yet have a rating assigned. Since the definition for the Sailors table has a rating column, what row should we insert for Dan? \\That is needed here is a special value that denotes unknown. Suppose the Sailor table definition was modified to include a rnaiden-name column. However, only married women who take their husband's last name have a maiden name. For women who do not take their husband's name and for men, the nw'idcn-nmnc column is inapphcable. Again, what value do we include in this column for the row representing Dan? SQL provides H special column value called null to use in such situations. "Ve use null when the column value is either 'lJ,nknown or inapplicable. Using our Sailor table definition, we might enter the row (98. Dan, null, 39) to represent Dan. The presence of null values complicates rnany issues, and we consider the impact of null values on SQL in this section.

SQL: Q'lteT'leS, ConstT'aJnt." Trigger's 5.6.1 Comparisons Using Null Values Consider a comparison such as rat'in,g = 8. If this is applied to the row for Dan, is this condition true or false'? Since Dan's rating is unknown, it is reasonable to say that this comparison should evaluate to the value unknown. In fact, this is the C::lse for the comparisons rating> 8 and rating < 8 &'3 well. Perhaps less obviously, if we compare two null values using <, >, =, and so on, the result is always unknown. For example, if we have null in two distinct rows of the sailor relation, any comparison returns unknown. SQL also provides a special comparison operator IS NULL to test whether a column value is null;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
insert for Dan? \\That is needed here is a special value that denotes

yet have a rating assigned. Since the definition for the Sailors table has a rating column, what row should we insert for Dan? \\That is needed here is a special value that denotes unknown. Suppose the Sailor table definition was modified to include a rnaiden-name column. However, only married women who take their husband's last name have a maiden name. For women who do not take their husband's name and for men, the nw'idcn-nmnc column is inapphcable. Again, what value do we include in this column for the row representing Dan? SQL provides H special column value called null to use in such situations. "Ve use null when the column value is either 'lJ,nknown or inapplicable. Using our Sailor table definition, we might enter the row (98. Dan, null, 39) to represent Dan. The presence of null values complicates rnany issues, and we consider the impact of null values on SQL in this section.

SQL: Q'lteT'leS, ConstT'aJnt." Trigger's 5.6.1 Comparisons Using Null Values Consider a comparison such as rat'in,g = 8. If this is applied to the row for Dan, is this condition true or false'? Since Dan's rating is unknown, it is reasonable to say that this comparison should evaluate to the value unknown. In fact, this is the C::lse for the comparisons rating> 8 and rating < 8 &'3 well. Perhaps less obviously, if we compare two null values using <, >, =, and so on, the result is always unknown. For example, if we have null in two distinct rows of the sailor relation, any comparison returns unknown. SQL also provides a special comparison operator IS NULL to test whether a column value is null;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211*
