---
id: data-types
title: SQL Data Types
definition: Integer, decimal, character, date/time, and blob data types in SQL
difficulty: beginner
estimatedReadTime: 5
pageReferences: [228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241]
chunkIds:
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
  - dbms-ramakrishnan-3rd-edition:p239:c1
  - dbms-ramakrishnan-3rd-edition:p239:c2
  - dbms-ramakrishnan-3rd-edition:p240:c1
  - dbms-ramakrishnan-3rd-edition:p241:c1
  - dbms-ramakrishnan-3rd-edition:p241:c2
relatedConcepts:
tags:
  - sql
  - data-types
  - ddl
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# SQL Data Types

## Definition
Integer, decimal, character, date/time, and blob data types in SQL

## Explanation
Database Apphcation Development transactions in which we access (and possibly change) a large number of rows of a table. If the transaction is aborted for any reason, the system potentially has to redo a lot of work when the transaction is restarted. Even if the transaction is not aborted, its locks are held for a long time and reduce the concurrency of the system. The alternative is to break the transaction into several smaller transactions, but remembering our position in the table between transactions (and other similar details) is complicated and error-prone. Allowing the application program to commit the transaction it initiated, while retaining its handle on the active table (i.e., the cursor) solves this problem: The application can commit its transaction and start a new transaction and thereby save the changes it has made thus far. Finally, in what order do FETCH commands retrieve rows? In general this order is unspecified, but the optional ORDER BY clause can be used to specify a sort order. Note that columns mentioned in the ORDER BY clause cannot be updated through the

general this order is unspecified, but the optional ORDER BY clause can be used to specify a sort order. Note that columns mentioned in the ORDER BY clause cannot be updated through the cursor! The order-item-list is a list of order-items; an order-item is a column name, optionally followed by one of the keywords ASC or DESC. Every column mentioned in the ORDER BY clause must also appear in the select-list of the query associated with the cursor; otherwise it is not clear what columns we should sort on. The keywords ASC or DESC that follow a column control whether the result should be sorted-with respect to that column-in ascending or descending order; the default is ASC. This clause is applied as the last step in evaluating the query. Consider the query discussed in Section 5.5.1, and the answer shown in Figure 5.13. Suppose that a cursor is opened on this query, with the clause: ORDER BY

## Examples
### Example 1: SELECT Example
```sql
SELECT query. JDBC has its own cursor mechanism in the form of a ResultSet object, which we discuss next. The execute method is more general than executeQuery and executeUpdate;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT title, price INTO:title,:price FROM Books WHERE author =:author };
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
*Source: dbms-ramakrishnan-3rd-edition, Pages 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241*
