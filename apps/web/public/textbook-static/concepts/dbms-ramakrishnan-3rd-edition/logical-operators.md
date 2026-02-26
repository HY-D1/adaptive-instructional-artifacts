# Logical Operators

## Definition
Using AND, OR, NOT, IN, BETWEEN to combine filter conditions

## Explanation
84 CHAPTER··~ The second approach is not applicable if we have employees who are neither hourly employees nor contract employees, since there is no way to store such employees. Also, if an employee is both an Hourly-.Emps and a ContracLEmps entity, then the name and lot: values are stored twice. This duplication can lead to some of the anomalies that we discuss in Chapter 19. A query that needs to examine all employees must now examine two relations. On the other hand, a query that needs to examine only hourly employees can now do so by examining just one relation. The choice between these approaches clearly depends on the semantics of the data and the frequency of common operations. In general, overlap and covering constraints can be expressed in SQL only by using assertions. 3.5.7 Translating ER Diagrams with Aggregation Consider the ER diagram shown in Figure 3.16. The Employees, Projects, Manilars Departments I _______did~ fT:C~'~~) Figure 3.16 Aggregation and Departments entity sets and the Sponsors relationship set are mapped as described in previous sections. For the Monitors relationship set,

Projects, Manilars Departments I _______did~ fT:C~'~~) Figure 3.16 Aggregation and Departments entity sets and the Sponsors relationship set are mapped as described in previous sections. For the Monitors relationship set, we create a relation with the following attributes: the key attributes of Employees (88n), the key attributes of Sponsors (d'id, p'id), and the descriptive attributes of Monitors ('/.tnt:'il). This translation is essentially the standard mapping for a relationship set, as described in Section 3.5.2.

The Relational A!odd 85 ~ There is a special case in which this translation can be refined by dropping the Sponsors relation. Consicler the Sponsors relation. It has attributes pid, did, and since; and in general we need it (in addition to l\rlonitors) for two reasons: 1. \Ve have to record the descriptive attributes (in our example, since) of the Sponsor

## Examples
### Example 1: SELECT Example
```sql
SELECT S.sname, S.sid, E.cid

The Relational 1I1odel FROM WHERE Students S, Enrolled E S.sid = E.studid AND E.grade = 'B' 87 $ The view B-Students has three fields called name, sid, and course with the same domains as the fields sname and sid in Students and cid in Enrolled. (If the optional arguments name, sid, and course are omitted from the CREATE VIEW statement, the column names sname, sid, and cid are inherited.) This view can be used just like a base table, or explicitly stored table, in defining new queries or views. Given the instances of Enrolled and Students shown in Figure 3.4, B-Students contains the tuples shown in Figure 3.18. Conceptually, whenever B-Students is used in a query, the view definition is first evaluated to obtain the corresponding instance of B-Students, then the rest of the query is evaluated treating B-Students like any other relation referred to in the query. (We discuss how queries on views are evaluated in practice in Chapter 25.) sid course History105 Reggae203 Figure 3.18 An Instance of the B-Students View 3.6.1 Views, Data Independence, Security Consider the

how queries on views are evaluated in practice in Chapter 25.) sid course History105 Reggae203 Figure 3.18 An Instance of the B-Students View 3.6.1 Views, Data Independence, Security Consider the levels of abstraction we discussed in Section 1.5.2. The physical schema for a relational database describes how the relations in the conceptual schema are stored, in terms of the file organizations and indexes used. The conceptual schema is the collection of schemas of the relations stored in the database. While some relations in the conceptual schema can also be exposed to applications, that is, be part of the exte'mal schema of the database, additional relations in the external schema can be defined using the view mechanism. The view mechanism thus provides the support for logical data independence in the relational model. That is, it can be used to define relations in the external schema that mask changes in the conceptual schema of the database from applications. For example, if the schema of a stored relation is changed, we can define a view with the old schema and applications that expect

schema of the database from applications. For example, if the schema of a stored relation is changed, we can define a view with the old schema and applications that expect to see the old schema can now use this view. Views are also valuable in the context of security: We can define views that give a group of users access to just the information they are allowed to see. For example, we can define a view that allows students to see the other students'

88 CHAPTER B name and age but not their gpa, and allows all students to access this view but not the underlying Students table (see Chapter 21). 3.6.2 Updates on Views The motivation behind the view mechanism is to tailor how users see the data. Users should not have to worry about the view versus base table distinction. This goal is indeed achieved in the case of queries on views;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT S.sid, S.gpa FROM Students S WHERE S.gpa> 3.0 We can implement a command to modify the gpa of a GoodStudents row by modifying the corresponding row in Students. We can delete a GoodStudents row by deleting the corresponding row from Students. (In general, if the view did not include a key for the underlying table, several rows in the table could 'correspond' to a single row in the view. This would be the case, for example, if we used S.sname instead of S.sid in the definition of GoodStudents. A com- mand that affects a row in the view then affects all corresponding rows in the underlying table.) We can insert a GoodStudents row by inserting a row into Students, using null values in columns of Students that do not appear in GoodStudents (e.g., sname, login). Note that

We can insert a GoodStudents row by inserting a row into Students, using null values in columns of Students that do not appear in GoodStudents (e.g., sname, login). Note that primary key columns are not allowed to contain null values. Therefore, if we attempt to insert rows through a view that does not contain the primary key of the underlying table, the insertions will be rejected. For example, if GoodStudents contained snarne but not ,c;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
insert a GoodStudents row by inserting a row into Students, using null values in columns of Students that do not appear in GoodStudents (e.g., sname, login). Note that

We can insert a GoodStudents row by inserting a row into Students, using null values in columns of Students that do not appear in GoodStudents (e.g., sname, login). Note that primary key columns are not allowed to contain null values. Therefore, if we attempt to insert rows through a view that does not contain the primary key of the underlying table, the insertions will be rejected. For example, if GoodStudents contained snarne but not ,c;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 119, 120, 121, 122, 123*
