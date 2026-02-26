# Aggregate Functions

## Definition
Using COUNT, SUM, AVG, MAX, MIN to calculate summary values

## Explanation
SQL: QueT~ie8] Constraints] Triggers 145 $ r-~'-'-'~ -.------- -~--- ,.,.._,---..-- , ,-, ,-_ , . --------- I Relational Algebra and SQL: Nesting of queries is a feature that is not I available in relational algebra, but nested queries can be translated into i algebra, as we will see in Chapter 15. Nesting in SQL is inspired more by , relational calculus than algebra. In conjunction with some of SQL's other features, such as (multi)set operators and aggregation, nesting is a very expressive construct. This section discusses only subqueries that appear in the WHERE clause. The treatment of subqueries appearing elsewhere is quite similar. Some examples of subqueries that appear in the FROM clause are discussed later in Section 5.5.1. 5.4.1 Introduction to Nested Queries As an example, let us rewrite the following query, which we discussed earlier, using a nested subquery: (Ql) Find the names of sailors who have reserved boat 103. SELECT FROM WHERE S.sname Sailors S S.sid IN ( SELECT FROM WHERE R.sid Reserves R R.bid = 103 ) The nested subquery computes the (multi)set of sids for

boat 103. SELECT FROM WHERE S.sname Sailors S S.sid IN ( SELECT FROM WHERE R.sid Reserves R R.bid = 103 ) The nested subquery computes the (multi)set of sids for sailors who have re- served boat 103 (the set contains 22,31, and 74 on instances R2 and 83), and the top-level query retrieves the names of sailors whose sid is in this set. The IN operator allows us to test whether a value is in a given set of elements; an SQL query is used to generate the set to be tested. Note that it is very easy to modify this query to find all sailors who have not reserved boat 103-we can just replace IN by NOT IN! The best way to understand a nested query is to think of it in terms of a con- ceptual evaluation strategy. In our example, the strategy consists of examining rows in Sailors and, for each such row, evaluating the subquery over Reserves. In general, the conceptual evaluation strategy that we present

## Examples
### Example 1: SELECT Example
```sql
SELECT FROM WHERE S.sname Sailors S S.sid IN ( SELECT FROM WHERE R.sid Reserves R R.bid = 103 ) The nested subquery computes the (multi)set of sids for

boat 103. SELECT FROM WHERE S.sname Sailors S S.sid IN ( SELECT FROM WHERE R.sid Reserves R R.bid = 103 ) The nested subquery computes the (multi)set of sids for sailors who have re- served boat 103 (the set contains 22,31, and 74 on instances R2 and 83), and the top-level query retrieves the names of sailors whose sid is in this set. The IN operator allows us to test whether a value is in a given set of elements;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT FROM WHERE S.sname Sailors S S.sid IN ( SELECT R.sid FROM Reserves R WHERE R.bid IN (SELECT B.bid FROM Boats B WHERE B.color = 'red' The innermost subquery finds the set of bids of red boats (102 and 104 on instance E1). The subquery one level above finds the set of sids of sailors who have reserved one of these boats. On instances E1, R2, and 83, this set of sids contains 22, 31, and 64. The top-level query finds the names of sailors whose sid is in this set of sids;
```
Example SELECT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 180, 181, 182, 183, 184, 185, 186, 187, 188*
