---
id: triggers
title: Triggers
definition: Automatic actions on INSERT, UPDATE, DELETE
difficulty: advanced
estimatedReadTime: 5
pageReferences: [429, 430, 431, 432, 433, 434, 435, 436, 437, 438, 439, 440]
chunkIds:
  - murachs-mysql-3rd-edition:p429:c1
  - murachs-mysql-3rd-edition:p429:c2
  - murachs-mysql-3rd-edition:p430:c1
  - murachs-mysql-3rd-edition:p430:c2
  - murachs-mysql-3rd-edition:p430:c3
  - murachs-mysql-3rd-edition:p431:c1
  - murachs-mysql-3rd-edition:p431:c2
  - murachs-mysql-3rd-edition:p432:c1
  - murachs-mysql-3rd-edition:p432:c2
  - murachs-mysql-3rd-edition:p432:c3
  - murachs-mysql-3rd-edition:p433:c1
  - murachs-mysql-3rd-edition:p433:c2
  - murachs-mysql-3rd-edition:p434:c1
  - murachs-mysql-3rd-edition:p434:c2
  - murachs-mysql-3rd-edition:p434:c3
  - murachs-mysql-3rd-edition:p434:c4
  - murachs-mysql-3rd-edition:p435:c1
  - murachs-mysql-3rd-edition:p435:c2
  - murachs-mysql-3rd-edition:p436:c1
  - murachs-mysql-3rd-edition:p436:c2
  - murachs-mysql-3rd-edition:p436:c3
  - murachs-mysql-3rd-edition:p436:c4
  - murachs-mysql-3rd-edition:p437:c1
  - murachs-mysql-3rd-edition:p437:c2
  - murachs-mysql-3rd-edition:p438:c1
  - murachs-mysql-3rd-edition:p438:c2
  - murachs-mysql-3rd-edition:p438:c3
  - murachs-mysql-3rd-edition:p439:c1
  - murachs-mysql-3rd-edition:p439:c2
  - murachs-mysql-3rd-edition:p439:c3
  - murachs-mysql-3rd-edition:p440:c1
  - murachs-mysql-3rd-edition:p440:c2
  - murachs-mysql-3rd-edition:p440:c3
relatedConcepts:
tags:
  - mysql
  - triggers
  - automation
  - advanced
sourceDocId: murachs-mysql-3rd-edition
---

# Triggers

## Definition
Automatic actions on INSERT, UPDATE, DELETE

## Explanation
Chapter 13 Language skills for writing stored progra,ns The syntax for declaring a variable DECLARE variable_name data_type [DEFAULT literal_value]; The syntax for setting a variable to a literal value or an expression SET variable_name = {literal_value lexpression}; The syntax for setting a variable to a selected value SELECT column_ l[, column_ 2] ••• INTO variable_ name_ l[, variable_name_ 2] ••• A stored procedure that uses variables DELIMITER/ / CREATE PROCEDURE test() BEGIN DECLARE max_ invoice_total DECLARE min invoice total - - DECLARE percent_difference DECLARE count_ invoice id DECLARE vendor id var SET vendor_ id_var = 95; DECIMAL (9,2); DECIMAL(9,2); DECIMAL (9,4); INT; INT; SELECT MAX(invoice_total), MIN(invoice_total), COUNT(invoice_ id) INTO max_ invoice_total, min_ invoice_total, count_ invoice_ id FROM invoices WHERE vendor_ id = vendor_ id_var; SET percent_difference = (max_ invoice_total - min_ invoice_total) / min_ invoice_ total * 100; SELECT CONCAT('$', max_ invoice_total) AS 'Maximum invoice', CONCAT('$', min_ invoice_total) AS 'Minimum invoice•, CONCAT(' %', ROUND (percent_difference, 2)) AS 'Percent difference', count invoice id AS 'Number of invoices'; END// The response from the system when the procedure is called Maxmum invoice ►

invoice_total) AS 'Minimum invoice•, CONCAT(' %', ROUND (percent_difference, 2)) AS 'Percent difference', count invoice id AS 'Number of invoices'; END// The response from the system when the procedure is called Maxmum invoice ► $46.21 Description Minimum invoice S16.33 Percent difference %182.98 Number of invoices • A variable stores a value that can change as a stored program executes..I • A variable must have a name that's different from the names of any columns used in any SELECT statement within the stored program. to distinguish a variable from a column, you can add a suffix like ''_ var'' to the variable name. How to declare and set variables

How to code IF statements statements based on a value that's r

## Examples
### Example 1: SELECT Example
```sql
SELECT column_ l[, column_ 2] ••• INTO variable_ name_ l[, variable_name_ 2] ••• A stored procedure that uses variables DELIMITER/ / CREATE PROCEDURE test() BEGIN DECLARE max_ invoice_total DECLARE min invoice total - - DECLARE percent_difference DECLARE count_ invoice id DECLARE vendor id var SET vendor_ id_var = 95;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT MAX(invoice_total), MIN(invoice_total), COUNT(invoice_ id) INTO max_ invoice_total, min_ invoice_total, count_ invoice_ id FROM invoices WHERE vendor_ id = vendor_ id_var;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
insert a NULL value into a column that doesn't accept NULL values. Occurs when a pro grain attempts to add or update a child row but can't because of a foreign key constraint. Occurs when a program atten1pts to delete or update a parent row but can't because of a foreign key constraint. Built-in named conditions Named condition Description NOT FOUND SQLEXCEPTION SQLWARNING Occurs when a progran1 attempts to use a FETCH statement or a SELECT statement to retrieve data and no data is found. Occurs when any error condition other than the NOT FOUND condition occtrrs. Occurs when any error condition other than the NOT FOUND condition occurs or when any warning

data and no data is found. Occurs when any error condition other than the NOT FOUND condition occtrrs. Occurs when any error condition other than the NOT FOUND condition occurs or when any warning messages occur. The syntax for declaring a condition handler DECLARE {CONTINUE jEXIT} HANDLER FOR {mysql_error_ codelSQLSTATE sqlstate_ code lnamed_condition} handl er_ ac tions;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 429, 430, 431, 432, 433, 434, 435, 436, 437, 438, 439, 440*
