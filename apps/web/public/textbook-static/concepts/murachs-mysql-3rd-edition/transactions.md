# Transactions and Locking

## Definition
Ensuring data integrity with ACID transactions and concurrency control

## Explanation
Language skills for writing stored programs This chapter presents the basic language skills that you need to write stored programs. With the skills presented in this chapter, you'll be able to code stored programs that provide functionality similar to procedural programming languages like Python, PHP, Java, C++, C#, and Visual Basic. If you have experience with another procedural language, you shouldn't have any trouble with the skills presented in this chapter. However, you should know that the programming power of MySQL is limited when compared to other languages. That's because MySQL is designed specifically to work with MySQL databases rather than as a general-purpose programming language. For its intended use, however, MySQL is both powerful and flexible. An introduction to stored programs ................................ 402 Four types of stored programs .................................................................... 402 A script that creates and calls a stored procedure ...................................... 402 A summary of statements for coding stored programs .............................. 404 How to write procedural code ........................................... 406 How to display data .................................................................................... 406 How to declare and set variables ................................................................ 408 How to code IF statements .......................................................................... 410

.............................. 404 How to write procedural code ........................................... 406 How to display data .................................................................................... 406 How to declare and set variables ................................................................ 408 How to code IF statements .......................................................................... 410 How to code CASE statements ........................

## Examples
### Example 1: SELECT Example
```sql
SELECT SUM(invoice_total - payment_total - credit_total ) INTO sum_balance_ due_var FROM invoices WHERE vendor_id = 95;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT CONCAT('Balance due: $', sum_balance_due_var) AS message;
```
Example SELECT statement from textbook.

### Example 3: DELETE Example
```sql
DELETE statement is run against a specific table. And an event executes at a scheduled time.

execute automati- cally when something happens. A trigger executes when an INSERT, UPDATE, or DELETE statement is run against a specific table. And an event executes at a scheduled time. A script that creates and calls a stored procedure The script shown in figure 13-1 creates a stored procedure named test that doesn't accept any parameters. Then, it calls this procedure to execute the state- ments that are stored within it. This provides a way for you to experiment with the procedural language features that are available from MySQL. That's why this script is used throughout this chapter. This script begins with the USE statement, which selects the AP database. Then, the DROP PROCEDURE IF EXISTS command drops the procedure named test if it already exists. This suppresses any error messages that would be displayed if you attempted to drop a procedure that didn't exist. The DELIMITER statement changes the delimiter from the default delimiter of the semicolon(;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 420, 421, 422, 423, 424, 425, 426, 427, 428, 429, 430, 431, 432*
