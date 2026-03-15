---
id: functions-murach
title: Stored Functions
definition: Creating user-defined functions in MySQL
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [417, 418, 419, 420, 421, 422, 423, 424, 425, 426, 427, 428]
chunkIds:
  - murachs-mysql-3rd-edition:p417:c1
  - murachs-mysql-3rd-edition:p418:c1
  - murachs-mysql-3rd-edition:p418:c2
  - murachs-mysql-3rd-edition:p419:c1
  - murachs-mysql-3rd-edition:p421:c1
  - murachs-mysql-3rd-edition:p421:c2
  - murachs-mysql-3rd-edition:p422:c1
  - murachs-mysql-3rd-edition:p422:c2
  - murachs-mysql-3rd-edition:p422:c3
  - murachs-mysql-3rd-edition:p423:c1
  - murachs-mysql-3rd-edition:p423:c2
  - murachs-mysql-3rd-edition:p424:c1
  - murachs-mysql-3rd-edition:p424:c2
  - murachs-mysql-3rd-edition:p424:c3
  - murachs-mysql-3rd-edition:p425:c1
  - murachs-mysql-3rd-edition:p426:c1
  - murachs-mysql-3rd-edition:p426:c2
  - murachs-mysql-3rd-edition:p427:c1
  - murachs-mysql-3rd-edition:p428:c1
  - murachs-mysql-3rd-edition:p428:c2
  - murachs-mysql-3rd-edition:p428:c3
  - murachs-mysql-3rd-edition:p428:c4
relatedConcepts:
tags:
  - mysql
  - functions
  - programming
sourceDocId: murachs-mysql-3rd-edition
---

# Stored Functions

## Definition
Creating user-defined functions in MySQL

## Explanation
A statement that creates a view CREATE VIEW vendors_ sw AS SELECT* FROM vendors WHERE vendor state IN ( 'CA' 'AZ' 'NV' 'NM') -,,, Chapter 12 How to create views A statement that replaces the view with a new view CREATE OR REPLACE VIEW vendors_ sw AS SELECT* FROM vendors WHERE vendor_state IN ('CA','AZ','NV','NM','UT', 'CO') A statement that drops the view DROP VIEW vendors_ sw Description • to alter a view, use the CREATE OR REPLACE VIEW statement to replace the existing view with a new one. • to delete a view from the database, use the DROP VIEW statement. How to alter or drop a view

Perspective In this chapter, you learned how to create and use views. As you've seen, views provide a powerful and flexible way to predefine the data that can be retrieved from a database. By using them, you can restJ.ict the access to a database while providing a consistent and simplified way for end t1sers and application programs to access that data. Terms • view nested view updatable view read-only view base table viewed table Exercises 1. Create a view named open_items that shows the invoices that haven't been paid. This view should return four columns from the Vendors and Invoices tables: vendor_name, invoice_number, invoice_total, and balance_due (invoice_total - payment_total - credit_total). A row should only be returned when the balance due is greater than zero, and the rows should be in sequence by vendor_name. 2. Write a SELECT statement that returns all of the columns in the open_items view that you created in exercise 1, with one row for each invoice that has a balance due of $1000 or more. 3. Create a view named open_items_summary that returns one summary

open_items view that you created in exercise 1, with one row for each invoice that has a balance due of $1000 or more. 3. Create a view named open_items_summary that returns one summary row for each vendor that has invoices that haven't been paid. Each row should include vendor_name, open_item_count (the number of inv

## Examples
### Example 1: SELECT Example
```sql
SELECT statement that returns all of the columns in the open_items view that you created in exercise 1, with one row for each invoice that has a balance due of $1000 or more. 3. Create a view named open_items_summary that returns one summary

open_items view that you created in exercise 1, with one row for each invoice that has a balance due of $1000 or more. 3. Create a view named open_items_summary that returns one summary row for each vendor that has invoices that haven't been paid. Each row should include vendor_name, open_item_count (the number of invoices with a balance due), and open_item_total (the total of the balance due amounts) The rows should be sorted by the open item totals in descending sequence. 4. Write a SELECT statement that returns just the first 5 rows from the open_items_summary view that you created in exercise 3. 5. Create an updatable view named vendor_address that returns the vendor_id column and all of the address columns for each vendor. 6. Write an UPDATE statement that changes the address for the 1 ow with a vendor ID of 4 so the suite number (Ste 260) is stored in the vendor_address2 column instead of the vendor address 1 column. -

Stored program development This section presents the essential skills for using MySQL to create stored programs. These are the skills that will take your SQL capabilities to the next level. In chapter 13, you'll learn the language basics for writing procedural code within sto1 ed programs. In chapter 14, you '11 learn how to manage transactions and locking from within stored programs. In chapter 15, you'll learn how to create two types of stored programs: stored procedures and functions. And in chapter 16, you'll learn how to create two more types of stored programs: triggers and events.

Language skills for writing stored programs This chapter presents the basic language skills that you need to write stored programs. With the skills presented in this chapter, you'll be able to code stored programs that provide functionality similar to procedural programming languages like Python, PHP, Java, C++, C#, and Visual Basic. If you have experience with another procedural language, you shouldn't have any trouble with the skills presented in this chapter. However, you should know that the programming power of MySQL is limited when compared to other languages. That's because MySQL is designed specifically to work with MySQL databases rather than as a general-purpose programming language. For its intended use, however, MySQL is both powerful and flexible. An introduction to stored programs................................ 402 Four types of stored programs.................................................................... 402 A script that creates and calls a stored procedure...................................... 402 A summary of statements for coding stored programs.............................. 404 How to write procedural code........................................... 406 How to display data.................................................................................... 406 How to declare and set variables................................................................ 408 How to code IF statements.......................................................................... 410 How to code CASE statements.................................................................... 412 How to

404 How to write procedural code........................................... 406 How to display data.................................................................................... 406 How to declare and set variables................................................................ 408 How to code IF statements.......................................................................... 410 How to code CASE statements.................................................................... 412 How to code loops....................................................................................... 414 How to use a cursor..................................................................................... 416 How to declare a condition handJer............................................................. 418 How to use a condition handJer................................................................... 420 How to use multiple condition handlers...................................................... 424 Perspective......................................................................... 426

An introduction to stored progran,s MySQL provides for using standard SQL to write stored programs. Stored programs can include procedural code that controls the flow of execution. Four types of stored programs in MySQL. A stored procedure can be called from an application that has access to the database. For example, a PHP application can call a stored procedure and pass parameters to it. A stored function can be called from a SQL statement, just like the functions provided by MySQL that you learned about in chapter 9. However, you can customize stored functions so they perform tasks that are specific to your database. Stored procedures and stored functions are similar in many ways and are also known as stored routines. Triggers and events don't need to be called. Instead, they execute automatically when something happens. A trigger executes when an INSERT, UPDATE, or DELETE statement is run against a specific table. And an event executes at a scheduled time. A script that creates and calls a stored procedure The script shown in doesn't accept any parameters. Then, it calls

run against a specific table. And an event executes at a scheduled time. A script that creates and calls a stored procedure The script shown in doesn't accept any parameters. Then, it calls this procedure to execute the statements that are stored within it. This provides a way for you to experiment with the procedural language features that are available from MySQL. That's why this script is used throughout this chapter. This script begins with the USE statement, which selects the AP database. Then, the DROP PROCEDURE IF EXISTS command drops the procedure named test if it already exists. This suppresses any error messages that would be displayed if you attempted to drop a procedure that didn't exist. The DELIMITER statement changes the delimiter from the default delimiter of the semicolon(;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT SUM(invoice_total - payment_total - credit_total) INTO sum_balance_ due_var FROM invoices WHERE vendor_id = 95;
```
Example SELECT statement from textbook.

### Example 3: UPDATE Example
```sql
UPDATE statement that changes the address for the 1 ow with a vendor ID of 4 so the suite number (Ste 260) is stored in the vendor_address2 column instead of the vendor address 1 column. -

Stored program development This section presents the essential skills for using MySQL to create stored programs. These are the skills that will take your SQL capabilities to the next level. In chapter 13, you'll learn the language basics for writing procedural code within sto1 ed programs. In chapter 14, you '11 learn how to manage transactions and locking from within stored programs. In chapter 15, you'll learn how to create two types of stored programs: stored procedures and functions. And in chapter 16, you'll learn how to create two more types of stored programs: triggers and events.

Language skills for writing stored programs This chapter presents the basic language skills that you need to write stored programs. With the skills presented in this chapter, you'll be able to code stored programs that provide functionality similar to procedural programming languages like Python, PHP, Java, C++, C#, and Visual Basic. If you have experience with another procedural language, you shouldn't have any trouble with the skills presented in this chapter. However, you should know that the programming power of MySQL is limited when compared to other languages. That's because MySQL is designed specifically to work with MySQL databases rather than as a general-purpose programming language. For its intended use, however, MySQL is both powerful and flexible. An introduction to stored programs................................ 402 Four types of stored programs.................................................................... 402 A script that creates and calls a stored procedure...................................... 402 A summary of statements for coding stored programs.............................. 404 How to write procedural code........................................... 406 How to display data.................................................................................... 406 How to declare and set variables................................................................ 408 How to code IF statements.......................................................................... 410 How to code CASE statements.................................................................... 412 How to

404 How to write procedural code........................................... 406 How to display data.................................................................................... 406 How to declare and set variables................................................................ 408 How to code IF statements.......................................................................... 410 How to code CASE statements.................................................................... 412 How to code loops....................................................................................... 414 How to use a cursor..................................................................................... 416 How to declare a condition handJer............................................................. 418 How to use a condition handJer................................................................... 420 How to use multiple condition handlers...................................................... 424 Perspective......................................................................... 426

An introduction to stored progran,s MySQL provides for using standard SQL to write stored programs. Stored programs can include procedural code that controls the flow of execution. Four types of stored programs in MySQL. A stored procedure can be called from an application that has access to the database. For example, a PHP application can call a stored procedure and pass parameters to it. A stored function can be called from a SQL statement, just like the functions provided by MySQL that you learned about in chapter 9. However, you can customize stored functions so they perform tasks that are specific to your database. Stored procedures and stored functions are similar in many ways and are also known as stored routines. Triggers and events don't need to be called. Instead, they execute automatically when something happens. A trigger executes when an INSERT, UPDATE, or DELETE statement is run against a specific table. And an event executes at a scheduled time. A script that creates and calls a stored procedure The script shown in doesn't accept any parameters. Then, it calls

run against a specific table. And an event executes at a scheduled time. A script that creates and calls a stored procedure The script shown in doesn't accept any parameters. Then, it calls this procedure to execute the statements that are stored within it. This provides a way for you to experiment with the procedural language features that are available from MySQL. That's why this script is used throughout this chapter. This script begins with the USE statement, which selects the AP database. Then, the DROP PROCEDURE IF EXISTS command drops the procedure named test if it already exists. This suppresses any error messages that would be displayed if you attempted to drop a procedure that didn't exist. The DELIMITER statement changes the delimiter from the default delimiter of the semicolon(;
```
Example UPDATE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 417, 418, 419, 420, 421, 422, 423, 424, 425, 426, 427, 428*
