---
id: set-operations
title: Set Operations in SQL
definition: UNION, INTERSECT, and EXCEPT operations in relational algebra and SQL
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p93:c1
  - dbms-ramakrishnan-3rd-edition:p93:c2
  - dbms-ramakrishnan-3rd-edition:p93:c3
  - dbms-ramakrishnan-3rd-edition:p94:c1
  - dbms-ramakrishnan-3rd-edition:p94:c2
  - dbms-ramakrishnan-3rd-edition:p94:c3
  - dbms-ramakrishnan-3rd-edition:p95:c1
  - dbms-ramakrishnan-3rd-edition:p95:c2
  - dbms-ramakrishnan-3rd-edition:p96:c1
  - dbms-ramakrishnan-3rd-edition:p96:c2
  - dbms-ramakrishnan-3rd-edition:p96:c3
  - dbms-ramakrishnan-3rd-edition:p97:c1
  - dbms-ramakrishnan-3rd-edition:p97:c2
  - dbms-ramakrishnan-3rd-edition:p98:c1
  - dbms-ramakrishnan-3rd-edition:p98:c2
  - dbms-ramakrishnan-3rd-edition:p99:c1
  - dbms-ramakrishnan-3rd-edition:p99:c2
  - dbms-ramakrishnan-3rd-edition:p99:c3
  - dbms-ramakrishnan-3rd-edition:p100:c1
  - dbms-ramakrishnan-3rd-edition:p100:c2
  - dbms-ramakrishnan-3rd-edition:p100:c3
  - dbms-ramakrishnan-3rd-edition:p100:c4
  - dbms-ramakrishnan-3rd-edition:p101:c1
  - dbms-ramakrishnan-3rd-edition:p101:c2
  - dbms-ramakrishnan-3rd-edition:p102:c1
  - dbms-ramakrishnan-3rd-edition:p102:c2
  - dbms-ramakrishnan-3rd-edition:p102:c3
  - dbms-ramakrishnan-3rd-edition:p103:c1
  - dbms-ramakrishnan-3rd-edition:p103:c2
  - dbms-ramakrishnan-3rd-edition:p104:c1
  - dbms-ramakrishnan-3rd-edition:p104:c2
  - dbms-ramakrishnan-3rd-edition:p104:c3
relatedConcepts:
tags:
  - sql
  - set-operations
  - relational
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Set Operations in SQL

## Definition
UNION, INTERSECT, and EXCEPT operations in relational algebra and SQL

## Explanation
CHAPTER ~ SQL. Originally developed as the query language of the pioneering System-R relational DBl\1S at IBIYl, structured query language (SQL) has become the most widely used language for creating, manipulating, and querying relational DBMSs. Since many vendors offer SQL products, there IS a need for a standard that defines \official SQL.' The existence of a standard allows users to measure a given vendor's version of SQL for completeness. It also allows users to distinguish SQLfeatures specific to one product from those that are standard; an application that relies on nonstandard features is less portable. The first SQL standard was developed in 1986 by the American National Standards Institute (ANSI) and was called SQL-86. There was a minor revision in 1989 called SQL-89 and a major revision in 1992 called SQL92. The International Standards Organization (ISO) collaborated with ANSI to develop SQL-92. Most commercial DBMSs currently support (the core subset of) SQL-92 and are working to support the recently adopted SQL:1999 version of the standard, a major extension of SQL-92. Our coverage of SQL is based on SQL:1999, but is

support (the core subset of) SQL-92 and are working to support the recently adopted SQL:1999 version of the standard, a major extension of SQL-92. Our coverage of SQL is based on SQL:1999, but is applicable to SQL-92 as well; features unique to SQL:1999 are explicitly noted. and the network model); the relational model revolutionized the database field and largely supplanted these earlier models. Prototype relational databa.'3e management systems were developed in pioneering research projects at IBM and DC-Berkeley by the mid-197Gs, and several vendors were offering relational database products shortly thereafter. Today, the relational model is by far the dominant data model and the foundation for the leading DBMS products, including IBM's DB2 family, Informix, Oracle, Sybase, Microsoft's Access and SQLServer, FoxBase, and Paradox. Relationa

## Examples
### Example 1: INSERT Example
```sql
INSERT command. We can insert a single tuple into the Students table as follows: INSERT INTO Students (sid, name, login, age, gpa) VALUES (53688, 'Smith',

CHAR(20), INTEGER, REAL) Tuples are inserted,using the INSERT command. We can insert a single tuple into the Students table as follows: INSERT INTO Students (sid, name, login, age, gpa) VALUES (53688, 'Smith', 'smith@ee', 18, 3.2) We can optionally omit the list of column names in the INTO clause and list the values in the appropriate order, but it is good style to be explicit about column names. We can delete tuples using the DELETE command. We can delete all Students tuples with name equal to Smith using the command: DELETE FROM WHERE Students S S.name = 'Smith' 1SQL also provides statements to destroy tables and to change the columns associated with a table;
```
Example INSERT statement from textbook.

### Example 2: INSERT Example
```sql
insert the tuple (55555, Artl04, A) into E1, the Ie is violated because there is no tuple in 51 with sid 55555;
```
Example INSERT statement from textbook.

### Example 3: UPDATE Example
```sql
UPDATE command. For example, we can increment the age and decrement the gpa of the student with sid 53688: UPDATE Students S SET S.age = S.age + 1, S.gpa = S.gpa - WHERE S.sid = 53688 These examples illustrate some important points. The WHERE clause is applied first and determines which rows are to be modified. The SET clause then determines how these rows are to be modified. If the column being modified is also used to determine the new value, the value used in the expression on the right side of equals (=) is the old value, that is, before the modification. to illustrate these points further, consider the following variation of the previous query: UPDATE Students S SET S.gpa = S.gpa - 0.1 WHERE S.gpa >= 3.3 If this query is applied on the instance 81 of Students shown in obtain the instance shown in I sid I name I login 50000 Dave dave@cs 3.2 53666 Jones jones@cs 3.3 53688 Smith smith@ee 3.2

query is applied on the instance 81 of Students shown in obtain the instance shown in I sid I name I login 50000 Dave dave@cs 3.2 53666 Jones jones@cs 3.3 53688 Smith smith@ee 3.2 53650 Smith smith@math 3.7 53831 Madayan madayan@music 1.8 53832 Guldu guldu@music 2.0 Students Instance 81 after Update 3.2 INTEGRITY CONSTRAINTS OVER RELATIONS A database is only as good as the information stored in it, and a DBMS must therefore help prevent the entry of incorrect information. An integrity constraint (Ie) is a condition specified on a database schema and restricts the data that can be stored in an instance of the databa'3e. If a database instance satisfies all the integrity constraints specified on the database schema, it is a legal instance. A DBMS enforces integrity constraints, in that it permits only legal instances to be stored in the database. Integrity constraints are specified and enforced at different times:

CHAPTER 3 1. \\Then the DBA or end user defines a database schema, he or she specifies the rcs that must hold on any instance of this database. 2. "Vhen a database application is run, the DBMS checks for violations and disallows changes to the data that violate the specified ICs. (In some situations, rather than disallow the change, the DBMS might make some compensating changes to the data to ensure that the database instance satisfies all ICs. In any case, changes to the database are not allowed to create an instance that violates any IC.) It is important to specify exactly when integrity constraints are checked relative to the statement that causes the change in the data and the transaction that it is part of. We discuss this aspect in Chapter 16, after presenting the transaction concept, which we introduced in Chapter 1, in more detail. Many kinds of integrity constraints can be specified in the relational model. We have already seen one example of an integrity constraint in the domain constraints associated with a relation schema (Section 3.1).

kinds of integrity constraints can be specified in the relational model. We have already seen one example of an integrity constraint in the domain constraints associated with a relation schema (Section 3.1). In general, other kinds of constraints can be specified as well;
```
Example UPDATE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104*
