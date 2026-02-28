# SELECT Statement Basics

## Definition
How to retrieve data from a single table using SELECT, column specifications, and aliases

## Explanation
The Relational 1\1odd 59 vVe discuss the concept of a relation in Section ~t1 and show how to create relations using the SQL language. An important component of a data model is the set of constructs it provides for specifying conditions that must be satisfied by the data. Such conditions, called 'integrity constraints (lGs), enable the DBIviS to reject operations that might corrupt the data. We present integrity constraints in the relational model in Section 3.2, along with a discussion of SQL support for les. \Ve discuss how a DBMS enforces integrity constraints in Section 3.3. In Section 3.4, we turn to the mechanism for accessing and retrieving data from the database, query languages, and introduce the querying features of SQL, which we examine in greater detail in a later chapter. We then discuss converting an ER diagram into a relational database schema in Section 3.5. We introduce views, or tables defined using queries, in Section 3.6. Views can be used to define the external schema for a database and thus provide the support for logical data independence in the

tables defined using queries, in Section 3.6. Views can be used to define the external schema for a database and thus provide the support for logical data independence in the relational model. In Section 3.7, we describe SQL commands to destroy and alter tables and views. Finally, in Section 3.8 we extend our design case study, the Internet shop in- troduced in Section 2.8, by showing how the ER diagram for its conceptual schema can be mapped to the relational model, and how the use of views can help in this design. 3.1 INTRODUCTION TO THE RELATIONAL MODEL The main construct for representing data in the relational model is a relation. A relation consists of a relation schema and a relation instance. The relation instance is a table, and the relation schema describes the column heads for the table. We first describe the relation schema and then the relation instance. The schema specifies the relation's

## Examples
### Example 1: INSERT Example
```sql
INSERT command. We can insert a single tuple into the Students table as follows: INSERT INTO Students (sid, name, login,

, CHAR(20) , INTEGER, REAL) Tuples are inserted ,using the INSERT command. We can insert a single tuple into the Students table as follows: INSERT INTO Students (sid, name, login, age, gpa) VALUES (53688, 'Smith', 'smith@ee', 18, 3.2) We can optionally omit the list of column names in the INTO clause and list the values in the appropriate order, but it is good style to be explicit about column names. We can delete tuples using the DELETE command. We can delete all Students tuples with name equal to Smith using the command: DELETE FROM WHERE Students S S.name = 'Smith' 1SQL also provides statements to destroy tables and to change the columns associated with a table;
```
Example INSERT statement from textbook.

### Example 2: INSERT Example
```sql
insert the tuple (55555, Artl04, A) into E1, the Ie is violated be- cause there is no tuple in 51 with sid 55555;
```
Example INSERT statement from textbook.

### Example 3: UPDATE Example
```sql
UPDATE com- mand. For example, we can increment the age and decrement the gpa of the student with sid 53688: UPDATE Students S SET S.age = S.age + 1, S.gpa = S.gpa - 1 WHERE S.sid = 53688 These examples illustrate some important points. The WHERE clause is applied first and determines which rows are to be modified. The SET clause then determines how these rows are to be modified. If the column being modified is also used to determine the new value, the value used in the expression on the right side of equals (=) is the old value, that is, before the modification. To illustrate these points further, consider the following variation of the previous query: UPDATE Students S SET S.gpa = S.gpa - 0.1 WHERE S.gpa >= 3.3 If this query is applied on the instance 81 of Students shown in Figure 3.1, we obtain the instance shown in Figure 3.3. I sid I name I login 50000 Dave dave@cs 19 3.2

applied on the instance 81 of Students shown in Figure 3.1, we obtain the instance shown in Figure 3.3. I sid I name I login 50000 Dave dave@cs 19 3.2 53666 Jones jones@cs 18 3.3 53688 Smith smith@ee 18 3.2 53650 Smith smith@math 19 3.7 53831 Madayan madayan@music 11 1.8 53832 Guldu guldu@music 12 2.0 Figure 3.3 Students Instance 81 after Update 3.2 INTEGRITY CONSTRAINTS OVER RELATIONS A database is only as good as the information stored in it, and a DBMS must therefore help prevent the entry of incorrect information. An integrity con- straint (Ie) is a condition specified on a database schema and restricts the data that can be stored in an instance of the databa'3e. If a database instance satisfies all the integrity constraints specified on the database schema, it is a legal instance. A DBMS enforces integrity constraints, in that it permits only legal instances to be stored in the database. Integrity constraints are specified and enforced at different times:

64 CHAPTER 3 1. \\Then the DBA or end user defines a database schema, he or she specifies the rcs that must hold on any instance of this database. 2. "Vhen a database application is run, the DBMS checks for violations and disallows changes to the data that violate the specified ICs. (In some situations, rather than disallow the change, the DBMS might make some compensating changes to the data to ensure that the database instance satisfies all ICs. In any case, changes to the database are not allowed to create an instance that violates any IC.) It is important to specify exactly when integrity constraints are checked relative to the statement that causes the change in the data and the transaction that it is part of. We discuss this aspect in Chapter 16, after presenting the transaction concept, which we introduced in Chapter 1, in more detail. Many kinds of integrity constraints can be specified in the relational model. We have already seen one example of an integrity constraint in the domain constraints associated with a relation schema (Section

of integrity constraints can be specified in the relational model. We have already seen one example of an integrity constraint in the domain constraints associated with a relation schema (Section 3.1). In general, other kinds of constraints can be specified as well;
```
Example UPDATE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105*
