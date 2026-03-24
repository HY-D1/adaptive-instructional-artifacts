---
id: having
title: HAVING Clause
definition: Filtering groups based on aggregate conditions
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p183:c1
  - dbms-ramakrishnan-3rd-edition:p183:c2
  - dbms-ramakrishnan-3rd-edition:p183:c3
  - dbms-ramakrishnan-3rd-edition:p184:c1
  - dbms-ramakrishnan-3rd-edition:p184:c2
  - dbms-ramakrishnan-3rd-edition:p185:c1
  - dbms-ramakrishnan-3rd-edition:p185:c2
  - dbms-ramakrishnan-3rd-edition:p186:c1
  - dbms-ramakrishnan-3rd-edition:p186:c2
  - dbms-ramakrishnan-3rd-edition:p187:c1
  - dbms-ramakrishnan-3rd-edition:p187:c2
  - dbms-ramakrishnan-3rd-edition:p188:c1
  - dbms-ramakrishnan-3rd-edition:p188:c2
  - dbms-ramakrishnan-3rd-edition:p189:c1
  - dbms-ramakrishnan-3rd-edition:p189:c2
  - dbms-ramakrishnan-3rd-edition:p190:c1
  - dbms-ramakrishnan-3rd-edition:p190:c2
  - dbms-ramakrishnan-3rd-edition:p190:c3
  - dbms-ramakrishnan-3rd-edition:p191:c1
  - dbms-ramakrishnan-3rd-edition:p191:c2
  - dbms-ramakrishnan-3rd-edition:p191:c3
  - dbms-ramakrishnan-3rd-edition:p192:c1
  - dbms-ramakrishnan-3rd-edition:p192:c2
  - dbms-ramakrishnan-3rd-edition:p193:c1
  - dbms-ramakrishnan-3rd-edition:p193:c2
  - dbms-ramakrishnan-3rd-edition:p194:c1
  - dbms-ramakrishnan-3rd-edition:p194:c2
  - dbms-ramakrishnan-3rd-edition:p195:c1
  - dbms-ramakrishnan-3rd-edition:p195:c2
relatedConcepts:
tags:
  - sql
  - having
  - filtering
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# HAVING Clause

## Definition
Filtering groups based on aggregate conditions

## Explanation
CHAPTER,.5 want to retrieve any columns from the row. This is one of the two uses of * in the SELECT clause that is good programming style; the other is &':1 an argument of the COUNT aggregate operation, which we describe shortly. As a further example, by using NOT EXISTS instead of EXISTS, we can compute the names of sailors who have not reserved a red boat. Closely related to EXISTS is the UNIQUE predicate. \Vhen we apply UNIQUE to a subquery, the resulting condition returns true if no row appears twice in the answer to the subquery, that is, there are no duplicates; in particular, it returns true if the answer is empty. (And there is also a NOT UNI QUE version.) 5.4.3 Set-Comparison Operators We have already seen the set-comparison operators EXISTS, IN, and UNIQUE, along with their negated versions. SQL also supports op ANY and op ALL, where op is one of the arithmetic comparison operators {<, <=, =, <>, >=, >}. (SOME is also available, but it is just a synonym for ANY.) (Q22) Find sailors

and op ALL, where op is one of the arithmetic comparison operators {<, <=, =, <>, >=, >}. (SOME is also available, but it is just a synonym for ANY.) (Q22) Find sailors whose rating is better than some sailor called Horatio. SELECT S.sid FROM Sailors S WHERE S.rating > ANY ( SELECT FROM WHERE S2.rating Sailors S2 S2.sname = 'Horatio') If there are several sailors called Horatio, this query finds all sailors whose rating is better than that of some sailor called Horatio. On instance 83, this computes the sids 31, 32, 58, 71, and 74. \\That if there were no sailor called Horatio? In this case the comparison S.rating > ANY... is defined to return false, and the query returns an elnpty answer set. to understand comparisons involving ANY, it is useful to think of the comparison being carried out repeatedly. In this example, S. rating is successively compared with each rating value that is an answer to the nested query. Intuitively, the subquery must return a row that makes the comp

## Examples
### Example 1: SELECT Example
```sql
SELECT clause that is good programming style;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT S.sid FROM Sailors S WHERE S.rating > ANY ( SELECT FROM WHERE S2.rating Sailors S2 S2.sname = 'Horatio') If there are several sailors called Horatio, this query finds all sailors whose rating is better than that of some sailor called Horatio. On instance 83, this computes the sids 31, 32, 58, 71, and 74. \\That if there were no sailor called Horatio? In this case the comparison S.rating > ANY... is defined to return false, and the query returns an elnpty answer set. to understand comparisons involving ANY, it is useful to think of the comparison being carried out repeatedly. In this example, S. rating is successively compared with each rating value that is an answer to the nested query. Intuitively, the subquery must return a row that makes the comparison true, in order for S. rat'ing

S. rating is successively compared with each rating value that is an answer to the nested query. Intuitively, the subquery must return a row that makes the comparison true, in order for S. rat'ing > ANY... to return true. (Q23) Find sailors whose rating is better than every sailor' called Horat to. vVe can obtain all such queries with a simple modification to Query Q22: Just replace ANY with ALL in the WHERE clause of the outer query. On instance 8~~, we would get the sid", 58 and 71. If there were no sailor called Horatio, the comparison S.rating > ALL... is defined to return true! The query would then return the names of all sailors. Again, it is useful to think of the comparison

SQL: C2uerie,s, ConstTain,ts, Triggers being carried out repeatedly. Intuitively, the comparison must be true for every returned row for S.rating> ALL... to return true. As another illustration of ALL, consider the following query. (Q24J Find the 8ailor's with the highest rating. SELECT S.sid FROM Sailors S WHERE S.rating >= ALL ( SELECT S2.rating FROM Sailors S2) The subquery computes the set of all rating values in Sailors. The outer WHERE condition is satisfied only when S.rating is greater than or equal to each of these rating values, that is, when it is the largest rating value. In the instance 53, the condition is satisfied only for rating 10, and the answer includes the sid." of sailors with this rating, Le., 58 and 71. Note that IN and NOT IN are equivalent to = ANY and <> ALL, respectively. 5.4.4 More Examples of Nested Queries Let us revisit a query that we considered earlier using the INTERSECT operator. (Q6) Find the names of sailors who have reserved both a red and a green boat. SELECT FROM WHERE S.sname Sailors S, Reserves

a query that we considered earlier using the INTERSECT operator. (Q6) Find the names of sailors who have reserved both a red and a green boat. SELECT FROM WHERE S.sname Sailors S, Reserves R, Boats B S.sid = R.sid AND R.bid = B.bid AND B.color = 'red' AND S.sid IN ( SELECT S2.sid FROM Sailors S2, Boats B2, Reserves R2 WHERE S2.sid = R2.sid AND R2.bid = B2.bid AND B2.color = 'green') This query can be understood as follows: "Find all sailors who have reserved a red boat and, further, have sids that are included in the set of sids of sailors who have reserved a green boat." This formulation of the query illustrates how queries involving INTERSECT can be rewritten using IN, which is useful to know if your system does not support INTERSECT. Queries using EXCEPT can be similarly rewritten by using NOT IN. to find the side:, of sailors who have reserved red boats but not green boats, we can simply replace the keyword IN in the previous query by NOT IN.

CHAPTER"S As it turns out, writing this query (Q6) using INTERSECT is more complicated because we have to use sids to identify sailors (while intersecting) and have to return sailor names: SELECT S.sname FROM Sailors S WHERE S.sid IN (( SELECT R.sid FROM Boats B, Reserves R WHERE R.bid = B.bid AND B.color = 'red') INTERSECT (SELECT R2.sid FROM Boats B2, Reserves R2 WHERE R2.bid = B2.bid AND B2.color = 'green')) Our next example illustrates how the division operation in relational algebra can be expressed in SQL. (Q9) Find the names of sailors who have TeseTved all boats. SELECT S.sname FROM Sailors S WHERE NOT EXISTS (( SELECT B.bid FROM Boats B) EXCEPT (SELECT R.bid FROM Reserves R WHERE R.sid = S.sid)) Note that this query is correlated--for each sailor S, we check to see that the set of boats reserved by S includes every boat. An alternative way to do this query without using EXCEPT follows: SELECT S.sname FROM Sailors S WHERE NOT EXISTS ( SELECT FROM WHERE B.bid Boats B NOT EXISTS ( SELECT R.bid FROM Reserves R

alternative way to do this query without using EXCEPT follows: SELECT S.sname FROM Sailors S WHERE NOT EXISTS ( SELECT FROM WHERE B.bid Boats B NOT EXISTS ( SELECT R.bid FROM Reserves R WHERE R.bid = B.bid AND R.sid = S.sid)) Intuitively, for each sailor we check that there is no boat that has not been reserved by this sailor.

SQL: Q'ueT'ics. Constraint8, Triggers lQJ SQL:1999 Aggregate Functions: The collection of aggregate functions is greatly expanded in the new standard, including several statistical tions such as standard deviation, covariance, and percentiles. However, new aggregate functions are in the SQLjOLAP package and may not supported by all vendors. 5.5 AGGREGATE OPERATORS In addition to simply retrieving data, we often want to perform some computation or summarization. As we noted earlier in this chapter, SQL allows the use of arithmetic expressions. We now consider a powerful class of constructs for computing aggregate values such as MIN and SUM. These features represent a significant extension of relational algebra. SQL supports five aggregate operations, which can be applied on any column, say A, of a relation: 1. COUNT ([DISTINCT] A): The number of (unique) values in the A column. 2. SUM ([DISTINCT] A): The sum of all (unique) values in the A column. 3. AVG ([DISTINCT] A): The average of all (unique) values in the A column. 4. MAX (A): The maximum value in the A column. 5. MIN (A): The minimum value in

the A column. 3. AVG ([DISTINCT] A): The average of all (unique) values in the A column. 4. MAX (A): The maximum value in the A column. 5. MIN (A): The minimum value in the A column. Note that it does not make sense to specify DISTINCT in conjunction with MIN or MAX (although SQL does not preclude this). (Q25) Find the average age of all sailors. SELECT AVG (S.age) FROM Sailors S On instance 53, the average age is 37.4. of course, the WHERE clause can be used to restrict the sailors considered in computing the average age. (Q26) Find the average age of sailors with a rating of 10. SELECT AVG (S.age) FROM Sailors S WHERE S.rating = 10 There are two such sailors, and their average age is 25.5. MIN (or MAX) can be used instead of AVG in the above queries to find the age of the youngest (oldest)

1,..') 0... sailor. However) finding both the name and the age of the oldest sailor is more tricky, as the next query illustrates. (Q,"21) Find the name and age of the oldest sailor. Consider the following attempt to answer this query: SELECT S.sname, MAX (S.age) FROM Sailors S The intent is for this query to return not only the maximum age but also the name of the sailors having that age. However, this query is illegal in SQL-if the SELECT clause uses an aggregate operation, then it must use only aggregate operations unless the query contains a GROUP BY clause! (The intuition behind this restriction should become clear when we discuss the GROUP BY clause in Section 5.5.1.) Therefore, we cannot use MAX (S.age) as well as S.sname in the SELECT clause. We have to use a nested query to compute the desired answer to Q27: SELECT FROM WHERE S.sname, S.age Sailors S S.age = ( SELECT MAX (S2.age) FROM Sailors S2) Observe that we have used the result of an aggregate operation in the subquery as an argument to

SELECT FROM WHERE S.sname, S.age Sailors S S.age = ( SELECT MAX (S2.age) FROM Sailors S2) Observe that we have used the result of an aggregate operation in the subquery as an argument to a comparison operation. Strictly speaking, we are comparing an age value with the result of the subquery, which is a relation. However, because of the use of the aggregate operation, the subquery is guaranteed to return a single tuple with a single field, and SQL Gonverts such a relation to a field value for the sake of the comparison. The following equivalent query for Q27 is legal in the SQL standard but, unfortunately, is not supported in many systems: SELECT FROM WHERE S.sname, S.age Sailors S ( SELECT MAX (S2.age) FROM Sailors S2) = S.age \Vc can count the number of sailors using COUNT. This exarnple illustrates the use of * as an argument to COUNT, which is useful when \ve want to count all rows. (Q28) Count the n:umbCT of sa:iloTs. SELECT COUNT (*)

FROM Sailors S vVe can think of * as shorthand for all the columns (in the cross-product of the from-list in the FROM clause). Contrast this query with the following query, which computes the number of distinct sailor names. (Remember that,'mame is not a key!) (Q29) Count the nmnber of d'i.fferent sailor names. SELECT COUNT ( DISTINCT S.sname) FROM Sailors S On instance 83, the answer to Q28 is 10, whereas the answer to Q29 is 9 (because two sailors have the same name, Horatio). If DISTINCT is omitted, the answer to Q29 is 10, because the name Horatio is counted twice. If COUNT does not include DISTINCT, then COUNT (*) gives the same answer as COUNT (x), where x is any set of attributes. In our example, without DISTINCT Q29 is equivalent to Q28. However, the use of COUNT (*) is better querying style, since it is immediately clear that all records contribute to the total count. Aggregate operations offer an alternative to the ANY and ALL constructs. For example, consider the following query: (Q30) Find the names of

it is immediately clear that all records contribute to the total count. Aggregate operations offer an alternative to the ANY and ALL constructs. For example, consider the following query: (Q30) Find the names of sailors who are older than the oldest sailor with a rating of 10. SELECT FROM WHERE S.sname Sailors S S.age > ( SELECT MAX ( S2.age) FROM Sailors S2 WHERE S2.rating = 10) On instance 83, the oldest sailor with rating 10 is sailor 58, whose age is ~j5. The names of older sailors are Bob, Dustin, Horatio, and Lubber. Using ALL, this query could alternatively be written as follows: SELECT S.sname FROM Sailors S WHERE S.age > ALL ( SELECT FROM WHERE S2.age Sailors S2 S2.rating = 10) However, the ALL query is more error proncone could easily (and incorrectly!) use ANY instead of ALL, and retrieve sailors who are older than some sailor with

CHAPTEFt,~5 Relationa~ Algebra and SQL: ~~~~:egation is a fUIl~~~: mental operati(~:l-'-l that canIlot be expressed in relational algebra. Similarly, SQL'8 grouping I construct cannot be expressed in algebra. I L..-._......__. I a rating of 10. The use of ANY intuitively corresponds to the use of MIN, instead of MAX, in the previous query. 5.5.1 The GROUP BY and HAVING Clauses Thus far, we have applied aggregate operations to all (qualifying) rows in a relation. Often we want to apply aggregate operations to each of a number of groups of rows in a relation, where the number of groups depends on the relation instance (i.e., is not known in advance). For example, consider the following query. (Q31) Find the age of the youngest sailor for each rating level. If we know that ratings are integers in the range 1 to la, we could write 10 queries of the form: SELECT MIN (S.age) FROM Sailors S WHERE S.rating = i where i = 1,2,...,10. vVriting 10 such queries is tedious. More important, we may not know what rating levels exist in advance.

form: SELECT MIN (S.age) FROM Sailors S WHERE S.rating = i where i = 1,2,...,10. vVriting 10 such queries is tedious. More important, we may not know what rating levels exist in advance. to write such queries, we need a major extension to the basic SQL query form, namely, the GROUP BY clause. In fact, the extension also includes an optional HAVING clause that can be used to specify qualificatioIls over groups (for example, we may be interested only in rating levels> 6. The general form of an SQL query with these extensions is: SELECT [ DISTINCT] select-list FROM from-list WHERE 'qualification GROUP BY grouping-list HAVING group-qualification Using the GROUP BY clause, we can write Q:n a.s follows: SELECT S.rating, MIN (S.age)

S(JL: queries. Constraints. Triggers FROM Sailors S GROUP BY S.rating Let us consider some important points concerning the new clauses: II The select-list in the SELECT clause consists of (1) a list of column names and (2) a list of terms having the form aggop ( column-name) AS newname. vVe already saw AS used to rename output columns. Columns that are the result of aggregate operators do not already have a column name, and therefore giving the column a name with AS is especially useful. Every column that appears in (1) must also appear in grouping-list. The reason is that each row in the result of the query corresponds to one gmup, which is a collection of rows that agree on the values of columns in groupinglist. In general, if a column appears in list (1), but not in grouping-list, there can be multiple rows within a group that have different values in this column, and it is not clear what value should be assigned to this column in an answer row. We can sometimes use primary key information to

group that have different values in this column, and it is not clear what value should be assigned to this column in an answer row. We can sometimes use primary key information to verify that a column has a unique value in all rows within each group. For example, if the grouping-list contains the primary key of a table in the from-list, every column of that table has a unique value within each group. In SQL:1999, such columns are also allowed to appear in part (1) of the select-list. II The expressions appearing in the group-qualification in the HAVING clause must have a single value per group. The intuition is that the HAVING clause determines whether an answer row is to be generated for a given group. to satisfy this requirement in SQL-92, a column appearing in the groupqualification must appear a'3 the argument to an aggregation operator, or it must also appear in grouping-list. In SQL:1999, two new set functions have been introduced that allow us to check whether every or any row in a group satisfies a condition;
```
Example SELECT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195*
