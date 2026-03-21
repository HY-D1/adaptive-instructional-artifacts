---
id: create-table
title: CREATE TABLE
definition: Creating database tables with column definitions and constraints
difficulty: beginner
estimatedReadTime: 5
pageReferences: [225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p225:c1
  - dbms-ramakrishnan-3rd-edition:p225:c2
  - dbms-ramakrishnan-3rd-edition:p226:c1
  - dbms-ramakrishnan-3rd-edition:p226:c2
  - dbms-ramakrishnan-3rd-edition:p226:c3
  - dbms-ramakrishnan-3rd-edition:p227:c1
  - dbms-ramakrishnan-3rd-edition:p227:c2
  - dbms-ramakrishnan-3rd-edition:p227:c3
  - dbms-ramakrishnan-3rd-edition:p228:c1
  - dbms-ramakrishnan-3rd-edition:p228:c2
  - dbms-ramakrishnan-3rd-edition:p228:c3
  - dbms-ramakrishnan-3rd-edition:p229:c1
  - dbms-ramakrishnan-3rd-edition:p229:c2
  - dbms-ramakrishnan-3rd-edition:p229:c3
  - dbms-ramakrishnan-3rd-edition:p230:c1
  - dbms-ramakrishnan-3rd-edition:p230:c2
  - dbms-ramakrishnan-3rd-edition:p230:c3
  - dbms-ramakrishnan-3rd-edition:p231:c1
  - dbms-ramakrishnan-3rd-edition:p231:c2
  - dbms-ramakrishnan-3rd-edition:p231:c3
  - dbms-ramakrishnan-3rd-edition:p232:c1
  - dbms-ramakrishnan-3rd-edition:p232:c2
  - dbms-ramakrishnan-3rd-edition:p232:c3
  - dbms-ramakrishnan-3rd-edition:p233:c1
  - dbms-ramakrishnan-3rd-edition:p233:c2
  - dbms-ramakrishnan-3rd-edition:p233:c3
  - dbms-ramakrishnan-3rd-edition:p234:c1
  - dbms-ramakrishnan-3rd-edition:p234:c2
  - dbms-ramakrishnan-3rd-edition:p235:c1
  - dbms-ramakrishnan-3rd-edition:p235:c2
  - dbms-ramakrishnan-3rd-edition:p235:c3
  - dbms-ramakrishnan-3rd-edition:p236:c1
  - dbms-ramakrishnan-3rd-edition:p236:c2
  - dbms-ramakrishnan-3rd-edition:p237:c1
  - dbms-ramakrishnan-3rd-edition:p237:c2
  - dbms-ramakrishnan-3rd-edition:p237:c3
  - dbms-ramakrishnan-3rd-edition:p238:c1
  - dbms-ramakrishnan-3rd-edition:p238:c2
relatedConcepts:
tags:
  - sql
  - ddl
  - create-table
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# CREATE TABLE

## Definition
Creating database tables with column definitions and constraints

## Explanation
CHAPTEl} 6.. \Ve usually need to open a cursor if the embedded statement is a SELECT (i.e.) a query). However, we can avoid opening a cursor if the answer contains a single row, as we see shortly... INSERT, DELETE, and UPDATE staternents typically require no cursor, although some variants of DELETE and UPDATE use a cursor. As an example, we can find the name and age of a sailor, specified by assigning a value to the host variable c~sir1, declared earlier, as follows: EXEC SQL SELECT INTO FROM WHERE S.sname, S.age:c_sname,:c_age Sailors S S.sid =:c_sid; The INTO clause allows us to assign the columns of the single answer row to the host variables csname and c_age. Therefore, we do not need a cursor to embed this query in a host language program. But what about the following query, which computes the names and ages of all sailors with a rating greater than the current value of the host variable cminmting? SELECT S.sname, S.age FROM Sailors S WHERE S.rating >:c_minrating This query returns a collection of rows, not just one row.

sailors with a rating greater than the current value of the host variable cminmting? SELECT S.sname, S.age FROM Sailors S WHERE S.rating >:c_minrating This query returns a collection of rows, not just one row. 'When executed interactively, the answers are printed on the screen. If we embed this query in a C program by prefixing the cOlnmand with EXEC SQL, how can the answers be bound to host language variables? The INTO clause is inadequate because we must deal with several rows. The solution is to use a cursor: DECLARE sinfo CURSOR FOR SELECT S.sname, S.age FROM Sailors S WHERE S.rating >:c_minrating; This code can be included in a C program, and once it is executed, the cursor 8ir~lo is defined. Subsequently, we can open the cursor: OPEN sinfo: The value of cminmting in the SQL query associated with the cursor is the value of this variable when we open the cursor. (The cursor declaration is processed at compile-time, and the OPEN command is 

## Examples
### Example 1: SELECT Example
```sql
SELECT (i.e.) a query). However, we can avoid opening a cursor if the answer contains a single row, as we see shortly... INSERT, DELETE, and UPDATE staternents typically require no cursor, although some variants of DELETE and UPDATE use a cursor. As an example, we can find the name and age of a sailor, specified by assigning a value to the host variable c~sir1, declared earlier, as follows: EXEC SQL SELECT INTO FROM WHERE S.sname, S.age:c_sname,:c_age Sailors S S.sid =:c_sid;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT S.sname, S.age FROM Sailors S WHERE S.rating >:c_minrating This query returns a collection of rows, not just one row.

sailors with a rating greater than the current value of the host variable cminmting? SELECT S.sname, S.age FROM Sailors S WHERE S.rating >:c_minrating This query returns a collection of rows, not just one row. 'When executed interactively, the answers are printed on the screen. If we embed this query in a C program by prefixing the cOlnmand with EXEC SQL, how can the answers be bound to host language variables? The INTO clause is inadequate because we must deal with several rows. The solution is to use a cursor: DECLARE sinfo CURSOR FOR SELECT S.sname, S.age FROM Sailors S WHERE S.rating >:c_minrating;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
INSERT staternents, as in

Database Application Develop'ment / / initial quantity is always zero String sql = "INSERT INTO Books VALUES('?, 7, '?,?, 0, 7)";
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238*
