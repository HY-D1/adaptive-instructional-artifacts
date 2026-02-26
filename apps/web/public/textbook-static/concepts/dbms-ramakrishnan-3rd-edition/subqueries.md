# Subqueries

## Definition
Using queries nested inside other queries for complex data retrieval

## Explanation
6 DATABASE APPLICATION DEVELOPMENT .. How do application programs connect to a DBMS? .. How can applications manipulate data retrieved from a DBMS? .. How can applications modify data in a DBMS? .. What are cursors? .. What is JDBC and how is it used? .. What is SQLJ and how is it used? .. What are stored procedures? .. Key concepts: Embedded SQL, Dynamic SQL, cursors; JDBC, connections, drivers, ResultSets, java.sql, SQLJ; stored procedures, SQL/PSM Hf~ profits most who serves best. ------Ivlotto for Rotary International In Chapter 5, we looked at a wide range of SQL query constructs, treating SQL as an independent language in its own right. A relational DBMS supports an inteuLctive SqL interface, and users can directly enter SQL commands. This simple approach is fine as long as the task at hand can be accomplished entirely with SQL cormnands. In practice, we often encounter situations in which we need the greater flexibility of a general-purpose programming language in addi- tion to the data manipulation facilities provided by SQL. For example, we rnay want to integrate a

which we need the greater flexibility of a general-purpose programming language in addi- tion to the data manipulation facilities provided by SQL. For example, we rnay want to integrate a database application with a nice graphical user interface, or we may want to integrate with other existing applications. 185

186 CHAPTEFt 6 J Applications that rely on the DBMS to manage data run as separate processes that connect to the DBlvIS to interact with it. Once a connection is established, SQL commands can be used to insert, delete, and modify data. SQL queries can be used to retrieve desired data. but we need to bridge an important difference in how a database system sees data and how an application program in a language like Java or C sees data: The result of a database query is a set (or multiset) or records, hut Java has no set or multiset data type. This mismatch is resolved through additional SQ

## Examples
### Example 1: SELECT Example
```sql
select certain transaction properties through SQL cormnands to control the degree to which it is exposed to the changes of other concurrently running applications. \Ve touch on the transaction concept at many points i,n this chapter, and, in particular, cover transaction-related ~hS­ pects of JDBC. A full discussion of transaction properties and SQL's support for transactions is deferred until Chapter 16. Examples that appear in this chapter are available online at http://www.cs.wisc.edu/-dbbook

Database Application DeveloplTu:nt 6.1 ACCESSING DATABASES FROlVl APPLICATIONS 187 In this section, we cover how SQL commands can be executed from within a program in a host language such as C or Java. The use of SQL commands within a host language program is called Embedded SQL. Details of Embed~ ded SQL also depend on the host language. Although similar capabilities are supported for a variety of host languages, the syntax sometimes varies. vVe first cover the basics of Embedded SQL with static SQL queries in Section 6.1.1. We then introduce cursors in Section 6.1.2. vVe discuss Dynamic SQL, which allows us to construct SQL queries at runtime (and execute them) in Section 6.1.:3. 6.1.1 Embedded SQL Conceptually, embedding SQL commands in a host language program is straight- forward. SQL statements (i.e., not declarations) can be used wherever a state- ment in the host language is allowed (with a few restrictions). SQL statements must be clearly marked so that a preprocessor can deal with them before in- voking the compiler for the host language. Also, any host language variables used

restrictions). SQL statements must be clearly marked so that a preprocessor can deal with them before in- voking the compiler for the host language. Also, any host language variables used to pass arguments into an SQL command must be declared in SQL. In particular, some special host language variables must be declared in SQL (so that, for example, any error conditions arising during SQL execution can be communicated back to the main application program in the host language). There are, however, two complications to bear in mind. First, the data types recognized by SQL may not be recognized by the host language and vice versa. This mismatch is typically addressed by casting data values appropriately be- fore passing them to or frorn SQL commands. (SQL, like other programming languages, provides an operator to cast values of aIle type into values of an- other type.) The second complication h~s to do with SQL being set-oriented, and is addressed using cursors (see Section 6.1.2. Commands operate on and produce tables, which are sets In our discussion of Embedded SQL, w(~ assmne thi'Lt

with SQL being set-oriented, and is addressed using cursors (see Section 6.1.2. Commands operate on and produce tables, which are sets In our discussion of Embedded SQL, w(~ assmne thi'Lt the host language is C for concretenc~ss. because minor differcnces exist in how SQL statements are embedded in differcnt host languages. Declaring Variables and Exceptions SQL statements can refer to variables defined in the host program. Such host- language variables must be prefixed by a colon (:) in SQL statements and be declared between the commands EXEC SQL BEGIN DECLARE SECTION and EXEC

188 CHAPTER 6 ~ SQL END DECLARE SECTION. The declarations are similar to how they would look in a C program and, as usual in C. are separated by semicolons. For example. we can declare variables c-sname, c_sid, c_mt'ing, and cage (with the initial c used as a naming convention to emphasize that these are host language variables) as follows: EXEC SQL BEGIN DECLARE SECTION char c_sname[20];
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT (i.e.) a query). However, we can avoid opening a cursor if the answer contains a single row, as we see shortly. .. INSERT, DELETE, and UPDATE staternents typically require no cursor, al- though some variants of DELETE and UPDATE use a cursor. As an example, we can find the name and age of a sailor, specified by assigning a value to the host variable c~sir1, declared earlier, as follows: EXEC SQL SELECT INTO FROM WHERE S.sname, S.age :c_sname, :c_age Sailors S S.sid = :c_sid;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
INSERT INTO Sailors VALUES (:c_sname, :csid, :crating, :cage);
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231*
