---
id: where-clause-murach
title: WHERE Clause
definition: Filtering rows with comparison operators, AND, OR, NOT, IN, BETWEEN, LIKE
difficulty: beginner
estimatedReadTime: 5
pageReferences: [85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107]
chunkIds:
  - murachs-mysql-3rd-edition:p85:c1
  - murachs-mysql-3rd-edition:p85:c2
  - murachs-mysql-3rd-edition:p85:c3
  - murachs-mysql-3rd-edition:p86:c1
  - murachs-mysql-3rd-edition:p86:c2
  - murachs-mysql-3rd-edition:p86:c3
  - murachs-mysql-3rd-edition:p87:c1
  - murachs-mysql-3rd-edition:p87:c2
  - murachs-mysql-3rd-edition:p88:c1
  - murachs-mysql-3rd-edition:p88:c2
  - murachs-mysql-3rd-edition:p88:c3
  - murachs-mysql-3rd-edition:p89:c1
  - murachs-mysql-3rd-edition:p89:c2
  - murachs-mysql-3rd-edition:p90:c1
  - murachs-mysql-3rd-edition:p90:c2
  - murachs-mysql-3rd-edition:p91:c1
  - murachs-mysql-3rd-edition:p91:c2
  - murachs-mysql-3rd-edition:p93:c1
  - murachs-mysql-3rd-edition:p93:c2
  - murachs-mysql-3rd-edition:p94:c1
  - murachs-mysql-3rd-edition:p94:c2
  - murachs-mysql-3rd-edition:p94:c3
  - murachs-mysql-3rd-edition:p95:c1
  - murachs-mysql-3rd-edition:p95:c2
  - murachs-mysql-3rd-edition:p95:c3
  - murachs-mysql-3rd-edition:p96:c1
  - murachs-mysql-3rd-edition:p96:c2
  - murachs-mysql-3rd-edition:p96:c3
  - murachs-mysql-3rd-edition:p97:c1
  - murachs-mysql-3rd-edition:p97:c2
  - murachs-mysql-3rd-edition:p98:c1
  - murachs-mysql-3rd-edition:p98:c2
  - murachs-mysql-3rd-edition:p98:c3
  - murachs-mysql-3rd-edition:p99:c1
  - murachs-mysql-3rd-edition:p99:c2
  - murachs-mysql-3rd-edition:p100:c1
  - murachs-mysql-3rd-edition:p100:c2
  - murachs-mysql-3rd-edition:p101:c1
  - murachs-mysql-3rd-edition:p101:c2
  - murachs-mysql-3rd-edition:p102:c1
  - murachs-mysql-3rd-edition:p102:c2
  - murachs-mysql-3rd-edition:p102:c3
  - murachs-mysql-3rd-edition:p102:c4
  - murachs-mysql-3rd-edition:p103:c1
  - murachs-mysql-3rd-edition:p103:c2
  - murachs-mysql-3rd-edition:p104:c1
  - murachs-mysql-3rd-edition:p104:c2
  - murachs-mysql-3rd-edition:p105:c1
  - murachs-mysql-3rd-edition:p105:c2
  - murachs-mysql-3rd-edition:p106:c1
  - murachs-mysql-3rd-edition:p106:c2
  - murachs-mysql-3rd-edition:p107:c1
  - murachs-mysql-3rd-edition:p107:c2
relatedConcepts:
tags:
  - mysql
  - where
  - filtering
sourceDocId: murachs-mysql-3rd-edition
---

# WHERE Clause

## Definition
Filtering rows with comparison operators, AND, OR, NOT, IN, BETWEEN, LIKE

## Explanation
Cliapter 2 How to use MySQL Workbench and other develop,nent tools The web address for the MySQL 8.0 Reference Manual https://dev.rrwsgl.com/doc/refman/8.0/en/ A web page from the MySQL Reference Manual B MySQL MySQL 8.0 'le!erence)( + D C i hnps dev.mysql.com oc/refman/8.0/en/manual-1nfo.html * e = The v10rld s most popula of)"'JI source database 0. Contact MySQL I Login I Register MyS~. MYSQL. COM OOWNLO.-\DS DOCUMENTATION DEVELO?ER ZOl~E Q. A Documentation Home MySQL 8.0 Reference Manual Preface and Legal Notices., General Information About This Manual Typographical and Syntax Convenoons > overview of the MY5QL Database Management System • What Is New In MySQL 8.0 • Server and Status vanables and opoons Added, Deprecated, or Rem011ed jr) MY5QL 8.0 Description MySQL 8.0 Reference Manual I General lnformaOOl'I I About Ths Manua version 8.0 ¥ 1.1 About This Manual This 1s the Reference Manual for the MySQL Database System, version 8.0, through release 8.0.15. Differences between minor versions of MySQL 8.0 are noted In the present text with reference to release numbers (8.0. x). For license 1nformatlon, see the Legal Notices. This manual Is

through release 8.0.15. Differences between minor versions of MySQL 8.0 are noted In the present text with reference to release numbers (8.0. x). For license 1nformatlon, see the Legal Notices. This manual Is not intended for use with older versions of the MySQL software due to the many functional and other differences between MY5QL 8.0 and previous versions. If you are using an earlier release of the MySQL software, please refer to the appropnate manual. For example, MY5QL 5. 7 Reference Monuol covers the S.7 senes of MySQL software releases. Because this manual serves as a reference, It does not provide general • to view the MySQL Reference Manual, go to the MySQL website and select the correct version of the manual. The web address for MySQL 8.0 is shown above. • to view a chapter, click the link for the chapter in the table 

## Examples
### Example 1: SELECT Example
```sql
select the correct version of the manual. The web address for MySQL 8.0 is shown above. • to view a chapter, click the link for the chapter in the table of contents on the right side of the page. • to return to the Home page for the manual, click the Start icon ( that's displayed at the top of the left sidebar. for the

on the right side of the page. • to return to the Home page for the manual, click the Start icon ( that's displayed at the top of the left sidebar. for the manual • to search for a particular word or plu ase, type the word or phrase in the ''Search this Manual'' text box in the left sidebar and click the Search icon or press the Enter key. Then, you can scroll through the results and click links to get more information. • You can also download the MySQL Reference Manual. However, it typically makes sense to use it online. How to use the MySQL Reference Manual

How to use the MySQL Co111111and Line Client Before MySQL Workbench was available, programmers used a command-line tool known as the MySQL Command Line Client to connect to a MySQL server and work with it. This tool is also known as the MySQL command line. Although you may never need this tool, you shot1ld at least be aware that it exists. This tool comes with MySQL, and it can be useful if MySQL Workbench isn't installed on the system that you're using. How to start and stop the MySQL Command Line Client in Windows. Although this figure shows the Command Prompt window that's available from Windows, you can use the MySQL Command Line Client on other operating systems too. In particular, on macOS, you can use the Terminal window to start the MySQL Command Line Client. When you use Windows, there's an easy way to start the MySQL Command Line Client if you want to log in as the root user for the database server that's running on the local computer. to do that, you just select the MySQL Command

MySQL Command Line Client if you want to log in as the root user for the database server that's running on the local computer. to do that, you just select the MySQL Command Line Client command from the Start menu. Then, MySQL will prompt you for a password. If you enter the password correctly, you will be logged on to the database server as the root user. In some cases, you'll need to use a command line to start the MySQL Command Line Client instead of using the Start menu. For example, you may need to do that if you want to log into a database that's running on a different computer, if you want to log in as a user other than the root user, or if you 're using another operating system such as macOS. In those cases, you can open a command line and change the directory to the bin dil ectory for the MySQL installation. Then, you can execute the mysql command and supply the parameters that are needed to connect to the database server. If

change the directory to the bin dil ectory for the MySQL installation. Then, you can execute the mysql command and supply the parameters that are needed to connect to the database server. If the MySQL server is located on a remote computer, you can specify -h, followed by the host name of the computer, and -u, followed by a valid username. In addition, you specify -p so MySQL prompts you for a valid password. Although it can take some experimentation to get these connection parameters right, you only need to figure this out once. Once you enter a valid password for the specified username, the MySQL Command Line Client displays a welcome message and a command line that looks like this: my sql> From this prompt, you can enter any statement that works with MySQL. When you're done, you can exit the MySQL Command Line Client by entering ''exit'' or ''quit'' followed by a semicolon.

Cliapter 2 How to use MySQL Workbench and other develop,nent tools The MySQL Command Line Client displayed by Windows ■ MySQL 8.0 Command Line Client □ X How to start the MySQL Command Line Client (Windows only) Start➔ All Programs ➔ MySQL➔ MySQL Server 8.0➔ MySQL 8.0 Command Line Client How to start the MySQL Command Line Client from the command line For Windows cd \ Program Files\ MySQL\ MySQL Server 8.0 \ bin mysql -u r oot -p For macOS cd / usr/ local/ mysql / bin. / mysql -u root -p How the mysql command works The syntax mysql -h hostname -u username -p Examples mysql - u ap_ tester -p mysql -h localhost -u root -p mysql -h murach. com -u ap_tester -p How to exit from the MySQL Command Line Client mysql>exit;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
select the database that you want to work with, you can enter a USE statement as illustrated by the second example. Here, the AP database is selected, and the message after this statement says ''Database changed'' to indicate that the statement was successful. After you select a database, the commands and statements that you enter will work with that database. to retrieve data from the database, you use a SELECT statement as illustrated by the third example. Here, the vendor_name column from the Vendors table is displayed. Note, however, that the result set is limited to only the first five rows. When you successfully execute a SELECT statement, the MySQL Command Line Client

column from the Vendors table is displayed. Note, however, that the result set is limited to only the first five rows. When you successfully execute a SELECT statement, the MySQL Command Line Client displays a message giving the nu1nber of rows that are included in the result set and the amount of time it took to run the query. In this case, it took less than 1/100 of a second to run the query.

Cliapter 2 How to use MySQL Workbench and other develop,nent tools How to list the names of all databases managed by the server mysql> show databases;
```
Example SELECT statement from textbook.

### Example 3: DELETE Example
```sql
Delete thee at the end of vendor_name and run the statement again. Note the error number and the description of the error. 9. Open another SQL Editor tab. Then, enter and run this statement: SELECT COUNT(*) AS nwnber_ of_ invoices, SUM(invoice_total) AS grand_ invoice_total FROM invoices Use MySQL Workbench to open and run scripts 10. Open the select_vendor_city_state script that's in the c:\rnu1 ach\mysql\scripts\ch02 directory. Note that this script contains just one SQL statement. Then, run the statement. 11. Open the select_ vendor_total_due script that's in the ch02 directory. Note that this opens another SQL Editor tab. 12. Open the select_ vendor_info1

just one SQL statement. Then, run the statement. 11. Open the select_ vendor_total_due script that's in the ch02 directory. Note that this opens another SQL Editor tab. 12. Open the select_ vendor_info1 mation script that's in the ch02 directory. Notice that this script contains two SQL statements that end with semicolons (scroll down if you need to). 13. Press the Ctrl+Shift+Enter keys or click the Execute SQL Script button to tun both of the statements in this script. Note that this displays the results in two Result grids. Make sure to view the results of both SELECT statements. 14. Move the insertion point into the first statement and press Ctrl+Enter to run just that statement. 15. Move the insertion point into the second statement and press Ctrl+Enter to run just that statement. 16. Exit from MySQL Workbench.

How to retrieve data from a single table In this chapter, you'll learn how to code SELECT statements that 1 etrieve data from a single table. The skills covered here are the essential ones that apply to any SELECT statement you code... no matter how many tables it operates on, no matter how complex the retrieval. So you'll want to be sure you have a good understanding ot the material in this chapter before you go on to the chapters that follow. An introduction to the SELECT statement........................ 74 The basic syntax of the SELECT statement.................................................. 74 SELECT statement examples........................................................................ 76 How to code the SELECT clause........................................ 78 How to code column specifications............................................................... 78 How to name the columns in a result set using aliases................................. 80 How to code arithmetic expressions.............................................................. 82 How to use the CONCAT function to join strings....................................... 84 How to use functions with strings, dates, and n11mbers................................ 86 How to test expressions by coding statements without FROM clauses........ 88 How to eliminate duplicate rows.................................................................. 90 How to code the WHERE clause......................................... 92 How to use the

functions with strings, dates, and n11mbers................................ 86 How to test expressions by coding statements without FROM clauses........ 88 How to eliminate duplicate rows.................................................................. 90 How to code the WHERE clause......................................... 92 How to use the comparison operators........................................................... 92 How to use the AND, OR, and NOT logical operators................................. 94 How to use the IN operator............................................................................ 96 How to use the BETWEEN operator............................................................ 98 How to use the LIKE and REGEXP operators........................................... 100 How to use the IS NULL clause.................................................................. 102 How to code the OR DER BY clause................................. 104 How to sort by a column narne.................................................................... 104 How to sort by an alias, expression, or column number............................. 106 How to code the LIM IT clause........................................... 108 How to limit the number of rows................................................................. 108 How to return a range of rows..................................................................... 108 Perspective......................................................................... 110

An introduction to the SELECT staten,ent to get you started quickly, this chapter begins by presenting the basic syntax of the SELECT statement. Then, it presents several examples that should give you an overview of how this statement works. The basic syntax of the SELECT statement summary at the top of this figure uses conventions that are similar to those used in other programming manuals. Capitalized words are keywords that you have to type exactly as shown. In contras~ you have to provide replacements for the lowercase words. For example, you can enter a list of columns in place of select_list, and you can enter a table name in place of table_source. Beyond that, you can omit the clauses enclosed in brackets ( []). If you compare the syntax in this figure with the coding examples in the next figure, you should easily see how the two are related. This syntax summary has been simplified so you can focus on the five main clauses of the SELECT stateme nt: SELECT, FROM, WHERE, ORDER BY, and LIMIT. Most SELECT statements contain

related. This syntax summary has been simplified so you can focus on the five main clauses of the SELECT stateme nt: SELECT, FROM, WHERE, ORDER BY, and LIMIT. Most SELECT statements contain the first four of these clauses. However, only the SELECT clause is required. The SELECT clause is al ways the first clause in a SELECT statement. It identifies the columns in the result set. These columns are retrieved from the base tables named in the FROM clause. Since this chapter focuses on retrieving data from a single table, the examples in this chapter use FROM clau.ses that name a single base table. In the next chapter, though, you'll learn how to retrieve data from two or more tables. The WHERE, ORDER BY, and LIMIT clauses rule optional. The ORDER BY clause determines how the rows in the result set are sorted, and the WHERE clause determines which rows in the base table are included in the result set. The WHERE clause specifies a search condition that's used to filter the rows in the base table. When this condition

determines which rows in the base table are included in the result set. The WHERE clause specifies a search condition that's used to filter the rows in the base table. When this condition is true, the row is included in the result set. The LIMIT clause limits the number of rows in the result set. In contrast to the WHERE clause, which uses a search condition, the LIMIT clause simply returns a specified number of rows, regardless of the size of the full result set. of cotrrse, if the result set has fewer rows than are specified by the LIMIT clause, all the rows in the result set are returned.

Chapter 3 How to retrieve datafrom a single table The basic syntax of the SELECT statement SELECT select_ list [FROM table_ source] [WHERE search condition] [ORDER BY order_by_ list] [LIMIT row_ limit] The five clauses of the SELECT statement Clause Description SELECT FROM WHERE ORDER BY LIMIT Description Describes the columns in the result set. Names the base table from which the query retrieves the data. Specifies the conditions that must be met for a row to be included ia tbe result set. Specifies how to sort the rows in the result set. Specifies the number of rows to return. • You use the basic SELECT statement shown above to retrieve the columns specified in the SELECT clause from the base table specified in the FROM clause and store them in a result set. • The WHERE clause is used to filter the rows in the base table so that only those rows that match the search condition are included in the result set. If you omit the WHERE clause, all of the rows in the base table are included.

table so that only those rows that match the search condition are included in the result set. If you omit the WHERE clause, all of the rows in the base table are included. • The search condition of a WHERE clause consists of one or more Boolean expressions that result in a true, false, or null value. If the combination of all the expressions is a t1ue value, the row being tested is included in the result set. Otherwise, it's not. • If you include the ORDER BY clause, the rows in the result set are sorted in the specified sequence. Otherwise, the sequence of the rows is not guaranteed by MySQL. • If you include the LIMIT clause, the result set that's retrieved is limited to a specified number of 1 ows. If you omit this clause, all rows that match are returned. • You 1nust code the clauses in the 01 der shown or you'll get a syntax error. Note • The syntax shown above does not include all of the clauses of the SELECT statement. You '11

code the clauses in the 01 der shown or you'll get a syntax error. Note • The syntax shown above does not include all of the clauses of the SELECT statement. You '11 learn about the other clauses later in this book. The basic syntax of the SELECT statement

SELECT statement examples ments retrieve data from the Invoices table that you expe1imented with in the last chapter. After each statement, you can see its result set as displayed by MySQL Workbench. In these examples, a horizontal or vertical sc1 oll bar indicates that the result set contains more rows or columns than can be displayed at one time. The first statement in this figure retrieves all of the rows and columns from the Invoices table. Here, an asterisk (*) is used as a shorthand to indicate that all of the columns should be retrieved, and the WHERE and LIMIT clauses are omitted so all of the rows in the table are retrieved. In addition, this statement doesn't include an ORDER BY clause, so the rows are in primary key sequence. The second statement retrieves selected columns from the Invoices table. These columns are listed in the SELECT clause. Like the first statement, this statement doesn't include a WHERE or a LIMIT clause, so all the rows are retrieved. Then, the ORDER BY clause causes the rows to be sorted

the SELECT clause. Like the first statement, this statement doesn't include a WHERE or a LIMIT clause, so all the rows are retrieved. Then, the ORDER BY clause causes the rows to be sorted by the invoice_total column in descending order, from largest to smallest. The third statement also lists the columns to be retrieved. In this case, though, the last column is calculated from two columns in the base table, credit_total and payment_total, and the resulting column is given the name total_credits. In addition, the WHERE clause specifies that only the invoice whose invoice_id column has a value of 17 should be retrieved. The fourth SELECT statement includes a WHERE clause whose condition specifies a range of values. In this case, only invoices with invoice dates between 06/01/2018 and 06/30/2018 are retrieved. In addition, the rows in the result set are sorted by invoice date. The last statement in this figure shows another example of the WHERE clause. In this case, only those rows with invoice totals greater than 50,000 are retrieved. Since none of the rows in the

date. The last statement in this figure shows another example of the WHERE clause. In this case, only those rows with invoice totals greater than 50,000 are retrieved. Since none of the rows in the Invoices table satisfy this condition, the result set is empty.

Chapter 3 How to retrieve datafrom a single table A SELECT statement that retrieves all the data from the Invoices table SELECT* FROM invoices invoice_id vendor_id invoice_number invoice_date invoice_total payment_total credit_total termsjd ~ 989319-457 2018-04-08 3813.33 3813.33 0.00 263253241 2018-04-10 40.20 40. 20 0.00 963253234 2018-04-13 138.75 1.38. 75 0.00 < (114 rows) A SELECT statement that retrieves three columns from each row, sorted in descending sequence by invoice total SELECT invoice_number, invoice_date, invoice_ total FROM invoices ORDER BY invoice_total DESC invoice number invoice date invoice total - - - -;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107*
