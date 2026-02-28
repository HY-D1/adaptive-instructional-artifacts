# Introduction to Joins

## Definition
Combining data from multiple tables using INNER JOIN, OUTER JOIN, and cross joins

## Explanation
The Relational Alodel 95 • \Vhat does the DBMS do when constraints are violated? What is referen- tial 'integr-ity? \Vhat options does SQL give application programmers for dealing with violations of referential integrity? (Section 3.3) • When are integrity constraints enforced by a DBMS? How can an appli- cation programmer control the time that constraint violations are checked during transaction execution? (Section 3.3.1) • What is a relational database query? (Section 3.4) • How can we translate an ER diagram into SQL statements to create ta- bles? How are entity sets mapped into relations? How are relationship sets mapped? How are constraints in the ER model, weak entity sets, class hierarchies, and aggregation handled? (Section 3.5) • What is a view? How do views support logical data independence? How are views used for security? How are queries on views evaluated? Why does SQL restrict the class of views that can be updated? (Section 3.6) • What are the SQL constructs to modify the structure of tables and de-- stray tables and views? Discuss what happens when we destroy a view.

be updated? (Section 3.6) • What are the SQL constructs to modify the structure of tables and de-- stray tables and views? Discuss what happens when we destroy a view. (Section 3.7) EXERCISES Exercise 3.1 Define the following terms: relation schema, relational database schema, do- main, relation instance, relation cardinality, and relation degree. Exercise 3.2 How many distinct tuples are in a relation instance with cardinality 22? Exercise 3.3 Does the relational model, as seen by an SQL query writer, provide physical and logical data independence? Explain. Exercise 3.4 \\That is the difference between a candidate key and the primary key for a given relation? What is a superkey? Exercise 3.5 Consider the instance of the Students relation shown in Figure 3.1. 1. Give an example of an attribute (or set of attributes) that you can deduce is not a candidate key, based on this instance bein

## Examples
### Example 1: SELECT Example
```sql
SELECT E.ename, Kage, E.salary FROM Emp

integer) Dept(did: integer, budget: real, managerid: integer) 1. Suppose you have a view SeniorEmp defined as follows: CREATE VIEW SeniorEmp (sname, sage, salary) AS SELECT E.ename, Kage, E.salary FROM Emp E WHERE Kage > 50 Explain what the system will do to process the following query: SELECT S.sname FROM SeniorEmp S WHERE S.salary > 100,000 2. Give an example of a view on Emp that could be automatically updated by updating Emp. 3. Give an example of a view on Emp that would be impossible to update (automatically) and explain why your example presents the update problem that it does. Exercise 3.20 C::onsider the following schema:

98 Suppliers(sid: integer, sname: string, address: string) Parts(pid: integer, pname: string, color: string) Catalog(sid: integer, pid: integer, cost: real) CHAPTER,. 3 The Catalog relation lists the prices charged for parts by Suppliers. Answer the following questions: • Give an example of an updatable view involving one relation. • Give an example of an updatable view involving two relations. • Give an example of an insertable-into view that is updatable. • Give an example of an insertable-into view that is not updatable. PROJECT-BASED EXERCISES Exercise 3.21 Create the relations Students, Faculty, Courses, Rooms, Enrolled, Teaches, and Meets_In in Minibase. Exercise 3.22 Insert the tuples shown in Figures 3.1 and 3.4 into the relations Students and Enrolled. Create reasonable instances of the other relations. Exercise 3.23 What integrity constraints are enforced by Minibase? Exercise 3.24 Run the SQL queries presented in this chapter. BIBLIOGRAPHIC NOTES The relational model was proposed in a seminal paper by Codd [187]. Childs [176] and Kuhns [454] foreshadowed some of these developments. Gallaire and :WIinker's book [296] contains several papers on the use of logic in the

seminal paper by Codd [187]. Childs [176] and Kuhns [454] foreshadowed some of these developments. Gallaire and :WIinker's book [296] contains several papers on the use of logic in the context of relational databases. A system based on a variation of the relational model in which the entire database is regarded abstractly as a single relation, called the universal relation, is described in [746]. Extensions of the relational model to incorporate null values, which indicate an unknown or missing field value, are discussed by several authors;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
select rows from a relation (a) and to project columns (7r). These operations allow us to manipulate data in a single relation. Consider the instance of the Sailors relation shown in Figure 4.2, denoted as 52. We can retrieve rows corresponding to expert sailors by using the a operator. The expression arating>8 (52) evaluates to the relation shown in Figure 4.4. The subscript rating> 8 specifies the selection criterion to be applied while retrieving tuples. sname I rating I yuppy 9 Rusty 10 Figure 4.4 O"r(lting>s(S2) yuppy 9 Lubber 8 guppy 5 Rusty 10 Figure 4.5 7r,m(lT1lc,Tating(S2) The selection operator a specifies the tuples to retain through a selection con- dition. In general, the selection condition is a Boolean combination (i.e., an expression using the logical connectives /\ and V) of terms that have the form attribute op constant or attributel op attribute2, where op is one of the com- parison operators <, <=, =, ,#, >=, or >. The reference to an attribute can be by

op constant or attributel op attribute2, where op is one of the com- parison operators <, <=, =, ,#, >=, or >. The reference to an attribute can be by position (of the form .i or i) or by name (of the form .name or name). The schema of the result of a selection is the schema of the input relation instance. The projection operator 7r allows us to extract columns from a relation;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
Insert the tuples shown in Figures 3.1 and 3.4 into the relations Students and Enrolled. Create reasonable instances of the other relations. Exercise 3.23 What integrity constraints are enforced by Minibase? Exercise 3.24 Run the SQL queries presented in this chapter. BIBLIOGRAPHIC NOTES The relational model was proposed in a seminal paper by Codd [187]. Childs [176] and Kuhns [454] foreshadowed some of these developments. Gallaire and :WIinker's book [296] contains several papers on the use of logic in the

seminal paper by Codd [187]. Childs [176] and Kuhns [454] foreshadowed some of these developments. Gallaire and :WIinker's book [296] contains several papers on the use of logic in the context of relational databases. A system based on a variation of the relational model in which the entire database is regarded abstractly as a single relation, called the universal relation, is described in [746]. Extensions of the relational model to incorporate null values, which indicate an unknown or missing field value, are discussed by several authors;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141*
