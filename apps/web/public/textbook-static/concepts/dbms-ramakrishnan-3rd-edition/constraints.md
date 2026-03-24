---
id: constraints
title: Integrity Constraints
definition: PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, and NOT NULL constraints
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252]
chunkIds:
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
  - dbms-ramakrishnan-3rd-edition:p242:c1
  - dbms-ramakrishnan-3rd-edition:p242:c2
  - dbms-ramakrishnan-3rd-edition:p243:c1
  - dbms-ramakrishnan-3rd-edition:p243:c2
  - dbms-ramakrishnan-3rd-edition:p243:c3
  - dbms-ramakrishnan-3rd-edition:p244:c1
  - dbms-ramakrishnan-3rd-edition:p244:c2
  - dbms-ramakrishnan-3rd-edition:p244:c3
  - dbms-ramakrishnan-3rd-edition:p245:c1
  - dbms-ramakrishnan-3rd-edition:p245:c2
  - dbms-ramakrishnan-3rd-edition:p246:c1
  - dbms-ramakrishnan-3rd-edition:p246:c2
  - dbms-ramakrishnan-3rd-edition:p247:c1
  - dbms-ramakrishnan-3rd-edition:p247:c2
  - dbms-ramakrishnan-3rd-edition:p248:c1
  - dbms-ramakrishnan-3rd-edition:p248:c2
  - dbms-ramakrishnan-3rd-edition:p249:c1
  - dbms-ramakrishnan-3rd-edition:p249:c2
  - dbms-ramakrishnan-3rd-edition:p250:c1
  - dbms-ramakrishnan-3rd-edition:p250:c2
  - dbms-ramakrishnan-3rd-edition:p251:c1
  - dbms-ramakrishnan-3rd-edition:p251:c2
  - dbms-ramakrishnan-3rd-edition:p252:c1
  - dbms-ramakrishnan-3rd-edition:p252:c2
relatedConcepts:
tags:
  - sql
  - constraints
  - integrity
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Integrity Constraints

## Definition
PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, and NOT NULL constraints

## Explanation
CHAPTER ().. public boolean isClosed() throws SQLException. Checks whether the current connection has already been closed... setAutoCommit and get AutoCommit. vVe already discussed these two functions. Establishing a connection to a data source is a costly operation since it involves several steps, such as establishing a network connection to the data source, authentication, and allocation of resources such as memory. In case an application establishes many different connections from different parties (such as a Web server), connections are often pooled to avoid this overhead. A connection pool is a set of established connections to a data source. Whenever a new connection is needed, one of the connections from the pool is used, instead of creating a new connection to the data source. Connection pooling can be handled either by specialized code in the application, or the optional j avax. sql package, which provides functionality for connection pooling and allows us to set different parameters, such as the capacity of the pool, and shrinkage and growth rates. Most application servers (see Section 7.7.2) implement the j avax.sql package or a proprietary

and allows us to set different parameters, such as the capacity of the pool, and shrinkage and growth rates. Most application servers (see Section 7.7.2) implement the j avax.sql package or a proprietary variant. 6.3.3 Executing SQL Statements We now discuss how to create and execute SQL statements using JDBC. In the JDBC code examples in this section, we assume that we have a Connection object named con. JDBC supports three different ways of executing statements: statement, PreparedStatement, and CallableStatement. The statement class is the base class for the other two statment classes. It allows us to query the data source with any static or dynamically generated SQL query. We cover the PreparedStatement class here and the CallableStatement class in Section 6.5, when we discuss stored procedures. The PreparedStatem

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
*Source: dbms-ramakrishnan-3rd-edition, Pages 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252*
