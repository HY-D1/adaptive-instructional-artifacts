---
id: group-by
title: GROUP BY Clause
definition: Grouping rows with common values for aggregate calculations
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p175:c1
  - dbms-ramakrishnan-3rd-edition:p175:c2
  - dbms-ramakrishnan-3rd-edition:p175:c3
  - dbms-ramakrishnan-3rd-edition:p176:c1
  - dbms-ramakrishnan-3rd-edition:p176:c2
  - dbms-ramakrishnan-3rd-edition:p176:c3
  - dbms-ramakrishnan-3rd-edition:p177:c1
  - dbms-ramakrishnan-3rd-edition:p177:c2
  - dbms-ramakrishnan-3rd-edition:p177:c3
  - dbms-ramakrishnan-3rd-edition:p178:c1
  - dbms-ramakrishnan-3rd-edition:p178:c2
  - dbms-ramakrishnan-3rd-edition:p178:c3
  - dbms-ramakrishnan-3rd-edition:p179:c1
  - dbms-ramakrishnan-3rd-edition:p179:c2
  - dbms-ramakrishnan-3rd-edition:p179:c3
  - dbms-ramakrishnan-3rd-edition:p180:c1
  - dbms-ramakrishnan-3rd-edition:p180:c2
  - dbms-ramakrishnan-3rd-edition:p180:c3
  - dbms-ramakrishnan-3rd-edition:p181:c1
  - dbms-ramakrishnan-3rd-edition:p181:c2
  - dbms-ramakrishnan-3rd-edition:p182:c1
  - dbms-ramakrishnan-3rd-edition:p182:c2
  - dbms-ramakrishnan-3rd-edition:p182:c3
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
relatedConcepts:
tags:
  - sql
  - group-by
  - aggregation
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# GROUP BY Clause

## Definition
Grouping rows with common values for aggregate calculations

## Explanation
CHAPTERf) names (possibly prefixed by range variables) and constants, and colurnnswrne is a ne"v name for this column in the output of the query. It can also contain aggregates such as smn and count, which we will discuss in Section 5.5. The SQL standard also includes expressions over date and time values, which we will not discuss. Although not part of the SQL standard, many implementations also support the use of built-in functions such as sqrt, sin, and rnod. (Q17) Compute increments for the mtings of peTsons who have sailed two different boats on the same day. SELECT FROM WHERE S.sname, S.rating+1 AS rating Sailors S, Reserves R1, Reserves R2 S.sid = R1.sid AND S.sid = R2.sid AND R1.day = R2.day AND R1.bid <> R2.bid Also, each item in a qualification can be as general as expTession1 = expression2. SELECT S1.sname AS name1, S2.sname AS name2 FROM Sailors Sl, Sailors S2 WHERE 2*S1.rating = S2.rating-1 For string comparisons, we can use the comparison operators (=, <, >, etc.) with the ordering of strings determined alphabetically as usual. If we need

name2 FROM Sailors Sl, Sailors S2 WHERE 2*S1.rating = S2.rating-1 For string comparisons, we can use the comparison operators (=, <, >, etc.) with the ordering of strings determined alphabetically as usual. If we need to sort strings by an order other than alphabetical (e.g., sort strings denoting month names in the calendar order January, February, March, etc.), SQL supports a general concept of a collation, or sort order, for a character set. A collation allows the user to specify which characters are 'less than' which others and provides great flexibility in string manipulation. In addition, SQL provides support for pattern matching through the LIKE operator, along with the use of the wild-card symbols % (which stands for zero or more arbitrary characters) and ~ (which stands for exactly one, arbitrary, character). Thus, '_AB%' denotes a pattern matching every string that contains at lea.'3t three characters, with

## Examples
### Example 1: SELECT Example
```sql
SELECT FROM WHERE S.sname, S.rating+1 AS rating Sailors S, Reserves R1, Reserves R2 S.sid = R1.sid AND S.sid = R2.sid AND R1.day = R2.day AND R1.bid <> R2.bid Also, each item in a qualification can be as general as expTession1 = expression2. SELECT S1.sname AS name1, S2.sname AS name2 FROM Sailors Sl, Sailors S2 WHERE 2*S1.rating = S2.rating-1 For string comparisons, we can use the comparison operators (=, <, >, etc.) with the ordering of strings determined alphabetically as usual. If we need

name2 FROM Sailors Sl, Sailors S2 WHERE 2*S1.rating = S2.rating-1 For string comparisons, we can use the comparison operators (=, <, >, etc.) with the ordering of strings determined alphabetically as usual. If we need to sort strings by an order other than alphabetical (e.g., sort strings denoting month names in the calendar order January, February, March, etc.), SQL supports a general concept of a collation, or sort order, for a character set. A collation allows the user to specify which characters are 'less than' which others and provides great flexibility in string manipulation. In addition, SQL provides support for pattern matching through the LIKE operator, along with the use of the wild-card symbols % (which stands for zero or more arbitrary characters) and ~ (which stands for exactly one, arbitrary, character). Thus, '_AB%' denotes a pattern matching every string that contains at lea.'3t three characters, with the second and third characters being A and B respectively. Note that unlike the other comparison operators, blanks can be significant for the LIKE operator (depending on the collation for the underlying character

second and third characters being A and B respectively. Note that unlike the other comparison operators, blanks can be significant for the LIKE operator (depending on the collation for the underlying character set). Thus, 'Jeff' = 'Jeff' is true while 'Jeff'LIKE 'Jeff, is false. An example of the use of LIKE in a query is given below. (Q18) Find the ages of sailors wh08e name begins and ends with B and has at least three chamcters. SELECT S.age

SQL: Q'Il,e'rie8, Constraints, TTiggeTs $ r---'-~~-~:~;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT FROM WHERE S.sname Sailors S, Reserves R, Boats B S.sid = R.sid AND R.bid = B.bid AND (B.color = 'red' OR B.color = 'green').. _---- 4Note that although the SQL standard includes these operations, many systems currently support only UNION. Also. many systems recognize

AND R.bid = B.bid AND (B.color = 'red' OR B.color = 'green').. _---- 4Note that although the SQL standard includes these operations, many systems currently support only UNION. Also. many systems recognize the keyword MINUS for EXCEPT.

CHAPTERD This query is easily expressed using the OR connective in the WHERE clause. Hovvever, the following query, which is identical except for the use of 'and' rather than 'or' in the English version, turns out to be much more difficult: (Q6) Find the names of sailor's who have rescr'ved both a red and a green boat. If we were to just replace the use of OR in the previous query by AND, in analogy to the English statements of the two queries, we would retrieve the names of sailors who have reserved a boat that is both red and green. The integrity constraint that bid is a key for Boats tells us that the same boat cannot have two colors, and so the variant of the previous query with AND in place of OR will always return an empty answer set. A correct statement of Query Q6 using AND is the following: SELECT FROM WHERE S.sname Sailors S, Reserves RI, Boats BI, Reserves R2, Boats B2 S.sid = Rl.sid AND R1.bid = Bl.bid AND S.sid = R2.sid AND R2.bid

Query Q6 using AND is the following: SELECT FROM WHERE S.sname Sailors S, Reserves RI, Boats BI, Reserves R2, Boats B2 S.sid = Rl.sid AND R1.bid = Bl.bid AND S.sid = R2.sid AND R2.bid = B2.bid AND B1.color='red' AND B2.color = 'green' We can think of RI and BI as rows that prove that sailor S.sid has reserved a red boat. R2 and B2 similarly prove that the same sailor has reserved a green boat. S.sname is not included in the result unless five such rows S, RI, BI, R2, and B2 are found. The previous query is difficult to understand (and also quite inefficient to execute, as it turns out). In particular, the similarity to the previous OR query (Query Q5) is completely lost. A better solution for these two queries is to use UNION and INTERSECT. The OR query (Query Q5) can be rewritten as follows: SELECT FROM WHERE UNION SELECT FROM WHERE S.sname Sailors S, Reserves R, Boats B S.sicl = R.sid AND R.bid = B.bid AND B.color = 'red' S2.sname Sailors S2, Boats B2, Reserves H2

follows: SELECT FROM WHERE UNION SELECT FROM WHERE S.sname Sailors S, Reserves R, Boats B S.sicl = R.sid AND R.bid = B.bid AND B.color = 'red' S2.sname Sailors S2, Boats B2, Reserves H2 S2.sid = H2.sid AND R2.bid = B2.bicl AND B2.color = 'green' This query sa,)'s that we want the union of the set of sailors who have reserved red boats and the set of sailors who have reserved green boats. In complete symmetry, the AND query (Query Q6) can be rewritten a.s follovvs: SELECT S.snarne

SqL: Q'lleries 7 Constraints, Triggers FROM Sailors S, Reserves R, Boats B WHERE S.sid = R.sid AND R.bid = B.bid AND B.color = 'red' INTERSECT SELECT S2.sname FROM Sailors S2, Boats B2, Reserves R2 WHERE S2.sid = R2.sid AND R2.bid = B2.bid AND B2.color = 'green' This query actually contains a subtle bug-if there are two sailors such as Horatio in our example instances B1, R2, and 83, one of whom has reserved a red boat and the other has reserved a green boat, the name Horatio is returned even though no one individual called Horatio has reserved both a red and a green boat. Thus, the query actually computes sailor names such that some sailor with this name has reserved a red boat and some sailor with the same name (perhaps a different sailor) has reserved a green boat. As we observed in Chapter 4, the problem arises because we are using sname to identify sailors, and sname is not a key for Sailors! If we select sid instead of sname in the previous query, we would compute the

the problem arises because we are using sname to identify sailors, and sname is not a key for Sailors! If we select sid instead of sname in the previous query, we would compute the set of sids of sailors who have reserved both red and green boats. (to compute the names of such sailors requires a nested query;
```
Example SELECT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189*
