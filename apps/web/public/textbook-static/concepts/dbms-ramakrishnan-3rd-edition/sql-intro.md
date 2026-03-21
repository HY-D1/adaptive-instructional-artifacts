---
id: sql-intro
title: Introduction to SQL
definition: Structured Query Language for managing relational databases
difficulty: beginner
estimatedReadTime: 5
pageReferences: [115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p115:c1
  - dbms-ramakrishnan-3rd-edition:p115:c2
  - dbms-ramakrishnan-3rd-edition:p116:c1
  - dbms-ramakrishnan-3rd-edition:p116:c2
  - dbms-ramakrishnan-3rd-edition:p116:c3
  - dbms-ramakrishnan-3rd-edition:p117:c1
  - dbms-ramakrishnan-3rd-edition:p117:c2
  - dbms-ramakrishnan-3rd-edition:p118:c1
  - dbms-ramakrishnan-3rd-edition:p118:c2
  - dbms-ramakrishnan-3rd-edition:p119:c1
  - dbms-ramakrishnan-3rd-edition:p119:c2
  - dbms-ramakrishnan-3rd-edition:p120:c1
  - dbms-ramakrishnan-3rd-edition:p121:c1
  - dbms-ramakrishnan-3rd-edition:p121:c2
  - dbms-ramakrishnan-3rd-edition:p122:c1
  - dbms-ramakrishnan-3rd-edition:p122:c2
  - dbms-ramakrishnan-3rd-edition:p122:c3
  - dbms-ramakrishnan-3rd-edition:p123:c1
  - dbms-ramakrishnan-3rd-edition:p123:c2
  - dbms-ramakrishnan-3rd-edition:p123:c3
  - dbms-ramakrishnan-3rd-edition:p124:c1
  - dbms-ramakrishnan-3rd-edition:p124:c2
  - dbms-ramakrishnan-3rd-edition:p124:c3
  - dbms-ramakrishnan-3rd-edition:p125:c1
  - dbms-ramakrishnan-3rd-edition:p125:c2
  - dbms-ramakrishnan-3rd-edition:p126:c1
  - dbms-ramakrishnan-3rd-edition:p126:c2
  - dbms-ramakrishnan-3rd-edition:p126:c3
  - dbms-ramakrishnan-3rd-edition:p127:c1
  - dbms-ramakrishnan-3rd-edition:p127:c2
  - dbms-ramakrishnan-3rd-edition:p128:c1
  - dbms-ramakrishnan-3rd-edition:p128:c2
  - dbms-ramakrishnan-3rd-edition:p128:c3
  - dbms-ramakrishnan-3rd-edition:p129:c1
  - dbms-ramakrishnan-3rd-edition:p129:c2
relatedConcepts:
tags:
  - sql
  - fundamentals
  - introduction
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Introduction to SQL

## Definition
Structured Query Language for managing relational databases

## Explanation
CHAPTER'3 Manages and WorksJn CREATE TABLE DepLMgr ( did INTEGER, dname CHAR(20), budget REAL, ssn CHAR(11) NOT NULL, since DATE, PRIMARY KEY (did), FOREIGN KEY (ssn) REFERENCES Employees ON DELETE NO ACTION) It also captures the participation constraint that every department must have a manager: Because ssn cannot take on null values, each tuple of DepLMgr identifies a tuple in Employees (who is the manager). The NO ACTION specification, which is the default and need not be explicitly specified, ensures that an Employees tuple cannot be deleted while it is pointed to by a Dept-Mgr tuple. If we wish to delete such an Employees tuple, we must first change the DepLMgr tuple to have a new employee &'3 manager. (vVe could have specified CASCADE instead of NO ACTION, but deleting all information about a department just because its manager has been fired seems a bit extreme!) The constraint that every department must have a manager cannot be captured using the first translation approach discussed in Section 3.5.3. (Look at the definition of lVIanages and think about what effect it would

The constraint that every department must have a manager cannot be captured using the first translation approach discussed in Section 3.5.3. (Look at the definition of lVIanages and think about what effect it would have if we added NOT NULL constraints to the ssn and did fields. Hint: The constraint would prevent the firing of a manager, but does not ensure that a manager is initially appointed for each department!) This situation is a strong argument

The Relational lvfodel 8~ in favor of using the second approach for one-to-many relationships such as Manages, especially when the entity set with the key constraint also has a total participation constraint. Unfortunately, there are many participation constraints that we cannot capture using SQL, short of using table constraints or assertions. Table constraints and assertions can be specified using the full power of the SQL query language 

## Examples
### Example 1: SELECT Example
```sql
SELECT S.sname, S.sid, E.cid

The Relational 1I1odel FROM WHERE Students S, Enrolled E S.sid = E.studid AND E.grade = 'B' $ The view B-Students has three fields called name, sid, and course with the same domains as the fields sname and sid in Students and cid in Enrolled. (If the optional arguments name, sid, and course are omitted from the CREATE VIEW statement, the column names sname, sid, and cid are inherited.) This view can be used just like a base table, or explicitly stored table, in defining new queries or views. Given the instances of Enrolled and Students shown in Conceptually, whenever B-Students is used in a query, the view definition is first evaluated to obtain the corresponding instance of B-Students, then the rest of the query is evaluated treating B-Students like any other relation referred to in the query. (We discuss how queries on views are evaluated in practice in Chapter 25.) sid course History105 Reggae203 An Instance of the B-Students View 3.6.1 Views, Data Independence, Security Consider the levels of abstraction we discussed in Section 1.5.2. The physical schema for a

in Chapter 25.) sid course History105 Reggae203 An Instance of the B-Students View 3.6.1 Views, Data Independence, Security Consider the levels of abstraction we discussed in Section 1.5.2. The physical schema for a relational database describes how the relations in the conceptual schema are stored, in terms of the file organizations and indexes used. The conceptual schema is the collection of schemas of the relations stored in the database. While some relations in the conceptual schema can also be exposed to applications, that is, be part of the exte'mal schema of the database, additional relations in the external schema can be defined using the view mechanism. The view mechanism thus provides the support for logical data independence in the relational model. That is, it can be used to define relations in the external schema that mask changes in the conceptual schema of the database from applications. For example, if the schema of a stored relation is changed, we can define a view with the old schema and applications that expect to see the old schema can now use this view.

For example, if the schema of a stored relation is changed, we can define a view with the old schema and applications that expect to see the old schema can now use this view. Views are also valuable in the context of security: We can define views that give a group of users access to just the information they are allowed to see. For example, we can define a view that allows students to see the other students'

CHAPTER B name and age but not their gpa, and allows all students to access this view but not the underlying Students table (see Chapter 21). 3.6.2 Updates on Views The motivation behind the view mechanism is to tailor how users see the data. Users should not have to worry about the view versus base table distinction. This goal is indeed achieved in the case of queries on views;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT S.sid, S.gpa FROM Students S WHERE S.gpa> 3.0 We can implement a command to modify the gpa of a GoodStudents row by modifying the corresponding row in Students. We can delete a GoodStudents row by deleting the corresponding row from Students. (In general, if the view did not include a key for the underlying table, several rows in the table could 'correspond' to a single row in the view. This would be the case, for example, if we used S.sname instead of S.sid in the definition of GoodStudents. A command that affects a row in the view then affects all corresponding rows in the underlying table.) We can insert a GoodStudents row by inserting a row into Students, using null values in columns of Students that do not appear in GoodStudents (e.g., sname, login). Note

in the underlying table.) We can insert a GoodStudents row by inserting a row into Students, using null values in columns of Students that do not appear in GoodStudents (e.g., sname, login). Note that primary key columns are not allowed to contain null values. Therefore, if we attempt to insert rows through a view that does not contain the primary key of the underlying table, the insertions will be rejected. For example, if GoodStudents contained snarne but not,c;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
insert a GoodStudents row by inserting a row into Students, using null values in columns of Students that do not appear in GoodStudents (e.g., sname, login). Note

in the underlying table.) We can insert a GoodStudents row by inserting a row into Students, using null values in columns of Students that do not appear in GoodStudents (e.g., sname, login). Note that primary key columns are not allowed to contain null values. Therefore, if we attempt to insert rows through a view that does not contain the primary key of the underlying table, the insertions will be rejected. For example, if GoodStudents contained snarne but not,c;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129*
