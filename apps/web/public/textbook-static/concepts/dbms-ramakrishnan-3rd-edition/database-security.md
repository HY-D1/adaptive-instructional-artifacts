# Database Security

## Definition
Managing users, privileges, roles, and securing database access

## Explanation
A TYVical Q'lteTy Optim'izer 5()5 FROM ~lHERE Sailors S EXISTS ( SELECT * FROM Reserves R WHERE R.bid = 103 AND S.sid = R.sid ) This query is correlated-"the tuple variable S from the top-level query appears in the nested subquery. Therefore, we cannot evaluate the subquery just once. In this case the typical evaluation strategy is to evaluate the nested subquery for each tuple of Sailors. An important point to note about nested queries is that a typical optimizer is likely to do a poor job, because of the limited approach to nested query optimization. This is highlighted next: • In a nested query with correlation, the join method is effectively index nested loops, with the inner relation typically a subquery (and therefore potentially expensive to compute). This approach creates two distinct problems. First, the nested subquery is evaluated once per outer tuple; if the same value appears in the correlation field (S.sid in our example) of several outer tuples, the same subquery is evaluated many times. The sec- ond problem is that the approach to nested subqueries is

the correlation field (S.sid in our example) of several outer tuples, the same subquery is evaluated many times. The sec- ond problem is that the approach to nested subqueries is not set-oriented. In effect, a join is seen as a scan of the outer relation with a selection on the inner subquery for each outer tuple. This precludes consideration of alternative join methods, such as a sort-merge join or a hash join, that could lead to superior plans. • Even if index nested loops is the appropriate join method, nested query evaluation may be inefficient. For example, if there is an index on the sid field of Reserves, a good strategy might be to do an index nested loops join with Sailors as the outer relation and Reserves &'3 the inner relation and apply the selection on bid on-the-fly. However, this option is not considered when optimizing the version of the query that uses IN, because the nested subquery i

## Examples
### Example 1: SELECT Example
```sql
SELECT * FROM Reserves R WHERE R.bid = 103 AND S.sid = R.sid ) This query is correlated-"the tuple variable S from the top-level query appears in the nested subquery. Therefore, we cannot evaluate the subquery just once. In this case the typical evaluation strategy is to evaluate the nested subquery for each tuple of Sailors. An important point to note about nested queries is that a typical optimizer is likely to do a poor job, because of the limited approach to nested query optimization. This is highlighted next: • In a nested query with correlation, the join method is effectively index nested loops, with the inner relation typically a subquery (and therefore potentially expensive to compute). This approach creates two distinct problems. First, the nested subquery is evaluated once per outer tuple;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT S.sname FROM Sailors S, Reserves R WHERE S.sid = R.sid AND R.bid=103 A typical SQL optimizer is likely to find a much better evaluation strategy if it is given the unnested or 'decOlTelated' version of the example query than if it were given either of the nested versions of the query. Many current optimizers cannot recognize the equivalence of these queries and

'decOlTelated' version of the example query than if it were given either of the nested versions of the query. Many current optimizers cannot recognize the equivalence of these queries and transform one of the nested versions to the nonnested form. This is, unfortunately, up to the educated user. From an efficiency standpoint, users are advised to consider such alternative formulations of a query. We conclude our discussion of nested queries by observing that there could be several levels of nesting. In general, the approach we sketched is extended by evaluating such queries from the innermost to the outermost levels, in order, in the absence of correlation. A correlated subquery must be evaluated for each candidate tuple of the higher-level (sub)query that refers to it. The basic idea is therefore similar to the case of one-level nested queries;
```
Example SELECT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 540, 541, 542, 543, 544, 545, 546, 547, 548*
