---
id: aggregate-functions
title: Aggregate Functions
definition: Computing summary values with COUNT, SUM, AVG, MAX, MIN
difficulty: beginner
estimatedReadTime: 5
pageReferences: [165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p165:c1
  - dbms-ramakrishnan-3rd-edition:p165:c2
  - dbms-ramakrishnan-3rd-edition:p166:c1
  - dbms-ramakrishnan-3rd-edition:p166:c2
  - dbms-ramakrishnan-3rd-edition:p166:c3
  - dbms-ramakrishnan-3rd-edition:p167:c1
  - dbms-ramakrishnan-3rd-edition:p167:c2
  - dbms-ramakrishnan-3rd-edition:p167:c3
  - dbms-ramakrishnan-3rd-edition:p168:c1
  - dbms-ramakrishnan-3rd-edition:p168:c2
  - dbms-ramakrishnan-3rd-edition:p169:c1
  - dbms-ramakrishnan-3rd-edition:p169:c2
  - dbms-ramakrishnan-3rd-edition:p170:c1
  - dbms-ramakrishnan-3rd-edition:p170:c2
  - dbms-ramakrishnan-3rd-edition:p171:c1
  - dbms-ramakrishnan-3rd-edition:p171:c2
  - dbms-ramakrishnan-3rd-edition:p171:c3
  - dbms-ramakrishnan-3rd-edition:p172:c1
  - dbms-ramakrishnan-3rd-edition:p172:c2
  - dbms-ramakrishnan-3rd-edition:p173:c1
  - dbms-ramakrishnan-3rd-edition:p173:c2
  - dbms-ramakrishnan-3rd-edition:p174:c1
  - dbms-ramakrishnan-3rd-edition:p174:c2
  - dbms-ramakrishnan-3rd-edition:p174:c3
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
relatedConcepts:
tags:
  - sql
  - aggregates
  - functions
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Aggregate Functions

## Definition
Computing summary values with COUNT, SUM, AVG, MAX, MIN

## Explanation
SQL: QUERIES, CONSTRNNTS, TRIGGERS.. What is included in the SQL language? What is SQL:1999?.. How are queries expressed in SQL? How is the meaning of a query specified in the SQL standard?,..- How does SQL build on and extend relational algebra and calculus? l"- \Vhat is grouping? How is it used with aggregate operations?... What are nested queries?.. What are null values?... How can we use queries in writing complex integrity constraints?... What are triggers, and why are they useful? How are they related to integrity constraints? Itt Key concepts: SQL queries, connection to relational algebra and calculus; features beyond algebra, DISTINCT clause and multiset semantics, grouping and aggregation; nested queries, correlation; setcomparison operators; null values, outer joins; integrity constraints specified using queries; triggers and active databases, event-conditionaction rules. -------_.__._---_._------------_..__._---------------_ _ _----_.._.._--- \Vhat men or gods are these? \\1hat Inaiclens loth? \Vhat mad pursuit? \1\7hat struggle to escape? \Vhat pipes and tilubrels? \Vhat wild ecstasy?.... John Keats, Odc on (L Gr'ccian Urn Structured Query Language (SQL) is the most widely used conunercial relational database language. It wa.", originally developed at

\Vhat pipes and tilubrels? \Vhat wild ecstasy?.... John Keats, Odc on (L Gr'ccian Urn Structured Query Language (SQL) is the most widely used conunercial relational database language. It wa.", originally developed at IBlVI in the SEQUEL-

SQL Standards Conformance: SQL:1999 ha.,;; a collection of features called Core SQL that a vendor must implement to claim conformance with the SQL:1999 standard. It is estimated that all the major vendors can comply with Core SQL with little effort. l\IIany of the remaining features are organized into packages. For example, packages address each of the following (with relevant chapters in parentheses): enhanced date and time, enhanced integrity management I and active dat

## Examples
### Example 1: SELECT Example
```sql
SELECT [DISTINCT] select-list FROM from-list WHERE qualification 1All references to a query can be found in the subject index for the book.

I sid I sname 1 rating I age I Dustin 45.0 Brutus 33.0 Lubber 55.5 Andy 25.5 Rusty 35.0 Horatio 35.0 Zorba 16.0 Horatio 35.0 Art 25.5 Bob 63.5 An Instance 53 of Sailors 10/10/98 10/10/98 10/8/98 10/7/98 11/10/98 11/6/98 11/12/98 9/5/98 9/8/98 9/8/98 An Instance R2 of Reserves ~ bname I color 1 Interlake blue Interlake red Clipper green Marine red An Instance Bl of Boats Every query must have a SELECT clause, which specifies columns to be retained in the result, and a FROM clause, which specifies a cross-product of tables. The optional WHERE clause specifies selection conditions on the tables mentioned in the FROM clause. Such a query intuitively corresponds to a relational algebra expression involving selections, projections, and cross-products. The close relationship between SQL and relational algebra is the basis for query optimization in a relational DBMS, as we will see in Chapters 12 and 15. Indeed, execution plans for SQL queries are represented using a variation of relational algebra expressions (Section 15.1). Let us consider a simple example. (Q15) Find the' names and ages of

Chapters 12 and 15. Indeed, execution plans for SQL queries are represented using a variation of relational algebra expressions (Section 15.1). Let us consider a simple example. (Q15) Find the' names and ages of all sailors. SELECT DISTINCT S.sname, S.age FROM Sailors S The answer is a set of rows, each of which is a pair (sname, age). If two or more sailors have the same name and age, the answer still contains just one pair

SQL: Q1Le7~ies. Con8tnrint8, TriggeT8 ~ with that name and age. This query is equivalent to applying the projection operator of relational algebra. If we omit the keyword DISTINCT, we would get a copy of the row (s,a) for each sailor with name s and age a;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT S.sid, S.sname, S.rating, S.age FROM Sailors AS S WHERE S.rating > 7 This query uses the optional keyword AS to introduce a range variable. Incidentally, when we want to retrieve all columns, as in this query, SQL provides a

CHAPTER fj convenient shorthand: \eVe can simply write SELECT *. This notation is useful for interactive querying, but it is poor style for queries that are intended to be reused and maintained because the schema of the result is not clear from the query itself;
```
Example SELECT statement from textbook.

### Example 3: DELETE Example
```sql
Delete rows in the cross-product that fail the qualification conditions. 3. Delete all columns that do not appear in the select-list. 4. If DISTINCT is specified, eliminate duplicate rows. 2ExpressiollS with NOT can always be replaced by equivalent expressions without NOT given the set of comparison operators just listed.

SCJL: Queries, ConstTaints, TriggeTs ~ This straightforward conceptual evaluation strategy makes explicit the rows that must be present in the answer to the query. However, it is likely to be quite inefficient. We will consider how a DB:MS actually evaluates queries in later chapters;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181*
