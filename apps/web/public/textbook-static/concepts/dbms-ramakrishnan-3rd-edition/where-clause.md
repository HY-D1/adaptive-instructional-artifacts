# The WHERE Clause

## Definition
How to filter rows using comparison operators, AND/OR, IN, BETWEEN, LIKE, and IS NULL

## Explanation
The Relational l'lfodel 71 • For every Enrolled row that refers to it, set the studid column to null. In our example, this option conflicts with the fact that stud'id is part of the primary key of Enrolled and therefore cannot be set to mtll. Therefore, we are limited to the first three options in our example, although this fourth option (setting the foreign key to null) is available in general. 3. What should we do if the primary key val'ue of a Students row is updated? The options here are similar to the previous case. SQL allows us to choose any of the four options on DELETE and UPDATE. For example, we can specify that when a Students row is deleted, all Enrolled rows that refer to it are to be deleted as well, but that when the sid column of a Students row is modified, this update is to be rejected if an Enrolled row refers to the modified Students row: CREATE TABLE Enrolled ( studid CHAR(20) , cid CHAR(20) , grade CHAR(10), PRIMARY KEY (studid, dd), FOREIGN

to be rejected if an Enrolled row refers to the modified Students row: CREATE TABLE Enrolled ( studid CHAR(20) , cid CHAR(20) , grade CHAR(10), PRIMARY KEY (studid, dd), FOREIGN KEY (studid) REFERENCES Students ON DELETE CASCADE ON UPDATE NO ACTION) The options are specified as part of the foreign key declaration. The default option is NO ACTION, which means that the action (DELETE or UPDATE) is to be rejected, Thus, the ON UPDATE clause in our example could be omitted, with the same effect. The CASCADE keyword says that, if a Students row is deleted, all Enrolled rows that refer to it are to be deleted as well. If the UPDATE clause specified CASCADE, and the sid column of a Students row is updated, this update is also carried out in each Enrolled row that refers to the updated Students row. If a Students row is deleted, we can switch the enrollment to a 'default' student by using ON DELETE SET DEFAULT. The default student is specified 3.'3 part of the definition of the sid field in Enrolled; for

switch th

## Examples
### Example 1: SELECT Example
```sql
SELECT * FROM Students S

of the Students relation shown in Figure 3.1. We can retrieve rows corresponding to students who are younger than 18 with the following SQL query: SELECT * FROM Students S WHERE S.age < 18 The symbol ,*, means that we retain all fields of selected tuples in the result. Think of S as a variable that takes on the value of each tuple in Students, one tuple after the other. The condition S. age < 18 in the WHERE clause specifies that we want to select only tuples in which the age field has a value less than 18. This query evaluates to the relation shown in Figure 3.6. I··sid j . name I login 53831 Madayan madayan@music 11 I 1.8 53832 Guldu guldu@music 12 I 2.0 Figure 3.6 Students with age < 18 OIl Instance 51 This example illustrates that the domain of a field restricts the operations that are permitted on field values, in addition to restricting the values that can appear in the field. The condition S. age < 18 involves an arithmetic comparison of an age

are permitted on field values, in addition to restricting the values that can appear in the field. The condition S. age < 18 involves an arithmetic comparison of an age value with an integer and is permissible because the domain of age is the set of integers. On the other hand, a condition such as S.age = S."id does not make sense because it compares an integer value with a string value, and this comparison is defined to fail in SQL;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT S.name, S.login FROM Students S WHERE S.age < 18 Figure 3.7 shows the answer to this query;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
insert the very first course or student tuple? One cannot be inseited without the other. The only way to accomplish this insertion is to defer the constraint che~king that would normally be carried out at the end of an INSERT statement. SQL allows a constraint to be in DEFERRED or IMMEDIATE mode. SET CONSTRAINT ConstntintFoo DEFERRED

The Relational 1\11odel A constraint in deferred mode is checked at commit time. In our example, the foreign key constraints on Boats and Sailors can both be declared to be in deferred mode. "VVe can then insert? boat with a nonexistent sailor as the cap- tain (temporarily making the database inconsistent), insert the sailor (restoring consistency), then commit and check that both constraints are satisfied. 3.4 QUERYING RELATIONAL DATA A relational database query (query, for short) is a question about the data, and the answer consists of a new relation containing the result. For example, we might want to find all students younger than 18 or all students enrolled in Reggae203. A query language is a specialized language for writing queries. SQL is the most popular commercial query language for a relational DBMS. We now present some SQL examples that illustrate how easily relations can be queried. Consider the instance of the Students relation shown in Figure 3.1. We can retrieve rows corresponding to students who are younger than 18 with the following SQL query: SELECT * FROM Students S

of the Students relation shown in Figure 3.1. We can retrieve rows corresponding to students who are younger than 18 with the following SQL query: SELECT * FROM Students S WHERE S.age < 18 The symbol ,*, means that we retain all fields of selected tuples in the result. Think of S as a variable that takes on the value of each tuple in Students, one tuple after the other. The condition S. age < 18 in the WHERE clause specifies that we want to select only tuples in which the age field has a value less than 18. This query evaluates to the relation shown in Figure 3.6. I··sid j . name I login 53831 Madayan madayan@music 11 I 1.8 53832 Guldu guldu@music 12 I 2.0 Figure 3.6 Students with age < 18 OIl Instance 51 This example illustrates that the domain of a field restricts the operations that are permitted on field values, in addition to restricting the values that can appear in the field. The condition S. age < 18 involves an arithmetic comparison of an age

are permitted on field values, in addition to restricting the values that can appear in the field. The condition S. age < 18 involves an arithmetic comparison of an age value with an integer and is permissible because the domain of age is the set of integers. On the other hand, a condition such as S.age = S."id does not make sense because it compares an integer value with a string value, and this comparison is defined to fail in SQL;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118*
