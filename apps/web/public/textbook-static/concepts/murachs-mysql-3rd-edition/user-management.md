---
id: user-management
title: User Management
definition: Creating users, granting privileges, and roles
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [487, 488, 489, 490, 491, 492, 493, 494, 495, 496, 497, 498, 499, 500]
chunkIds:
  - murachs-mysql-3rd-edition:p487:c1
  - murachs-mysql-3rd-edition:p487:c2
  - murachs-mysql-3rd-edition:p488:c1
  - murachs-mysql-3rd-edition:p489:c1
  - murachs-mysql-3rd-edition:p490:c1
  - murachs-mysql-3rd-edition:p490:c2
  - murachs-mysql-3rd-edition:p491:c1
  - murachs-mysql-3rd-edition:p491:c2
  - murachs-mysql-3rd-edition:p492:c1
  - murachs-mysql-3rd-edition:p492:c2
  - murachs-mysql-3rd-edition:p492:c3
  - murachs-mysql-3rd-edition:p493:c1
  - murachs-mysql-3rd-edition:p493:c2
  - murachs-mysql-3rd-edition:p493:c3
  - murachs-mysql-3rd-edition:p494:c1
  - murachs-mysql-3rd-edition:p495:c1
  - murachs-mysql-3rd-edition:p495:c2
  - murachs-mysql-3rd-edition:p495:c3
  - murachs-mysql-3rd-edition:p497:c1
  - murachs-mysql-3rd-edition:p498:c1
  - murachs-mysql-3rd-edition:p498:c2
  - murachs-mysql-3rd-edition:p498:c3
  - murachs-mysql-3rd-edition:p498:c4
  - murachs-mysql-3rd-edition:p499:c1
  - murachs-mysql-3rd-edition:p499:c2
  - murachs-mysql-3rd-edition:p500:c1
  - murachs-mysql-3rd-edition:p500:c2
  - murachs-mysql-3rd-edition:p500:c3
relatedConcepts:
tags:
  - mysql
  - security
  - users
sourceDocId: murachs-mysql-3rd-edition
---

# User Management

## Definition
Creating users, granting privileges, and roles

## Explanation
Chapter 15 How to create stored prvcedures and functions Some of the characteristics for a MySQL function Characteristic Description DETERMINISTIC NOT DETERMI NISTIC READS SQL DATA MODIFIES SQL DATA CONTAINS SQL NO SQL Indicates that the function produces the same results given the same input values. Indicates that the function does not produce the same results given the same inpt1t values. This is the default. Indicates that the function contains one or more SQL statem.ents st1ch as SELECT statements that read data from a database but no statements that write data. Indicates that the function contains SQL statements such as INSERT, UPDATE, and DELETE statements tl1at write data to a database. Indicates that the function contains one or more SQL statements such as SET statements that don't read from or write to a database. This is the default. Indicates that the function doesn't contain SQL statements. A function that gets a random number DELIMITER // CREATE FUNCTION rand_ i nt () RETURNS INT NOT DETERMINISTIC NO SQL BEGIN RETURN ROUND (RAND () * 1000); END// A SELECT statement that uses

function that gets a random number DELIMITER // CREATE FUNCTION rand_ i nt () RETURNS INT NOT DETERMINISTIC NO SQL BEGIN RETURN ROUND (RAND () * 1000); END// A SELECT statement that uses the function SELECT rand_ int () AS random_number; I random_number ► l3LS Description • If binary logging is enabled, which it is by default with MySQL 8.0, each function must include the DETERMINISTIC, NO SQL, or READS SQL DATA characteristic. to override this requirement, you can set the log_bin_trust_function_creators system variable to 1 (ON). For more information on working with system variables, see chapter 17. • The binary log contains a record of all the changes that have been made to the contents of a database. It can be used for replication between two servers. • Unless you code the DETERMINISTIC keyword, a function is considered to be non-dete1 ministic. This affects the type of informat

## Examples
### Example 1: SELECT Example
```sql
SELECT statements that read data from a database but no statements that write data. Indicates that the function contains SQL statements such as INSERT, UPDATE, and DELETE statements tl1at write data to a database. Indicates that the function contains one or more SQL statements such as SET statements that don't read from or write to a database. This is the default. Indicates that the function doesn't contain SQL statements. A function that gets a random number DELIMITER // CREATE FUNCTION rand_ i nt () RETURNS INT NOT DETERMINISTIC NO SQL BEGIN RETURN ROUND (RAND () * 1000);
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT statement that uses

function that gets a random number DELIMITER // CREATE FUNCTION rand_ i nt () RETURNS INT NOT DETERMINISTIC NO SQL BEGIN RETURN ROUND (RAND () * 1000);
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
INSERT statement. If the account description is a duplicate, this procedure should raise an error with a SQLSTATE code of 23000, a MySQL code of 1062, and a message that says ''Duplicate account description." 4. Write a script that creates and calls a stored procedure named insert_terms. First, code a statement that creates a procedure that adds a new row to the Terms table in the AP schema. to do that, this procedure should have two parameters: one for the ter1ns_due_days column and another for the terms_description column. If the value for the description column is nt1ll, the stored procedure should be able to create a default value for the description column based on the value

and another for the terms_description column. If the value for the description column is nt1ll, the stored procedure should be able to create a default value for the description column based on the value of the due days column. For example, for a due days column of 120, the description column should have a default value of ''Net due 120 days''. Then, code a CALL statement that tests this procedure.

How to create triggers and events Now that you've learned bow to work with stored procedures and functions, you're ready to learn about two more types of stored programs: triggers and events. Triggers can be executed before or after an INSERT, UPDATE, or DELETE statement is executed on a table. As a result, they provide a powerful way to enforce data consistency, log changes to the database, and implement business rules. Events can be executed at a schedt1led time. As a result, they provide a convenient way to automatically perform any task that needs to be run regularly, such as scheduled maintenance of tables. How to work with triggers.................................................. 478 How to create a BEFORE trigger................................................................ 478 How to use a trigger to enforce data consistency....................................... 480 How to create an AFTER trigger................................................................ 482 How to view or drop triggers...................................................................... 484 How to work with events.................................................... 486 How to turn the event scheduler on or off................................................... 486 How to create an event................................................................................. 486 How to view, alter, or drop events............................................................... 488 Perspective......................................................................... 490

How to work with triggers A trigger is a named database object that is executed, or fired, automatically when a particular type of SQL statement is executed. When using MySQL, a trigger is fired when an INSERT, UPDATE, or DELETE statement is executed on a table. How to create a BEFORE trigger start, you code the CREATE TRIGGER keywords followed by the name of the trigger. In this figure, for instance, the first example creates a trigger named vendors_before_update. This name indicates that the trigger is associated with the Vendors table and that it is fired before an update. This chapter uses a similar naming convention for the other triggers. After the name of the trigger, you code the BEFORE or AFTER keyword to indicate when the trigger is fired. Then, you identify the statement that causes the trigger to fire. Next, yoL1 code an ON clause that identifies the name of the table. In this figure, for instance, the first example creates a trigger that's executed before any UPDATE statements on the Vendors table. Although each trigger is associated

identifies the name of the table. In this figure, for instance, the first example creates a trigger that's executed before any UPDATE statements on the Vendors table. Although each trigger is associated with a single table, with MySQL 5.7 and later, you can code multiple BEFORE and AFTER triggers for the same event on the same table. Since this can be confusing to manage and debug, however, I recommend you have no more than one BEFORE and one AFTER trigger for each event. After the ON clause, you code the FOR EACH ROW clause. This clause indicates that the trigger is a row-level trigger that fires for each row that's modified. For example, an UPDATE statement that updates five rows would cause the trigger to be executed five times, once for each row. Although some databases support other types of triggers, MySQL only supports row-level triggers. Within the body of a trigger, you can use the NEW keyword to work with the new values in a row that's being inserted or updated. In this figure, for example, the NEW keyword

the body of a trigger, you can use the NEW keyword to work with the new values in a row that's being inserted or updated. In this figure, for example, the NEW keyword gets and sets the value for the vendor_state column of the new row. If you try to use this keyword with a row that's being deleted, you'll get an error since this row doesn't have any new values. You can also use the OLD keyword to work with the old values in a row that's being updated or deleted. You can't use this keyword with a row that's being inserted, though, since a new row doesn't have any old values. The body of a trigger typically contains a block of code that's identified by the BEGIN and END keywords. In this figure, for example, the body of the trigger contains a block of code with a single statement that updates the vendor_state column so state codes are always stored with uppercase letters. to accomplish that, this statement uses the UPPER function to convert the new value for

code with a single statement that updates the vendor_state column so state codes are always stored with uppercase letters. to accomplish that, this statement uses the UPPER function to convert the new value for the vendor_state column to uppercase.

Chapter 16 How to create triggers and events The syntax of the CREATE TRIGGER statement CREATE TRIGGER trigger_name {BEFOREIAFTER} {INSERTjUPDATEIDELETE} ON table_ name FOR EACH ROW trigger_body A CREATE TRIGGER statement that corrects mixed-case state names DELIMITER// CREATE TRIGGER vendors_before_ update BEFORE UPDATE ON vendors FOR EACH ROW BEGIN SET NEW.vendor_ state = UPPER(NEW.vendor_ state);
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 487, 488, 489, 490, 491, 492, 493, 494, 495, 496, 497, 498, 499, 500*
