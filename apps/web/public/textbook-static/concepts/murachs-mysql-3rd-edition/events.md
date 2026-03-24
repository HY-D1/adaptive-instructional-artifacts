---
id: events
title: Events
definition: Scheduled tasks in MySQL
difficulty: advanced
estimatedReadTime: 5
pageReferences: [441, 442, 443, 444, 445, 446, 447, 448, 449, 450, 451, 452]
chunkIds:
  - murachs-mysql-3rd-edition:p441:c1
  - murachs-mysql-3rd-edition:p442:c1
  - murachs-mysql-3rd-edition:p442:c2
  - murachs-mysql-3rd-edition:p442:c3
  - murachs-mysql-3rd-edition:p443:c1
  - murachs-mysql-3rd-edition:p443:c2
  - murachs-mysql-3rd-edition:p444:c1
  - murachs-mysql-3rd-edition:p444:c2
  - murachs-mysql-3rd-edition:p445:c1
  - murachs-mysql-3rd-edition:p445:c2
  - murachs-mysql-3rd-edition:p446:c1
  - murachs-mysql-3rd-edition:p446:c2
  - murachs-mysql-3rd-edition:p446:c3
  - murachs-mysql-3rd-edition:p447:c1
  - murachs-mysql-3rd-edition:p447:c2
  - murachs-mysql-3rd-edition:p447:c3
  - murachs-mysql-3rd-edition:p449:c1
  - murachs-mysql-3rd-edition:p450:c1
  - murachs-mysql-3rd-edition:p450:c2
  - murachs-mysql-3rd-edition:p450:c3
  - murachs-mysql-3rd-edition:p451:c1
  - murachs-mysql-3rd-edition:p451:c2
  - murachs-mysql-3rd-edition:p452:c1
  - murachs-mysql-3rd-edition:p452:c2
  - murachs-mysql-3rd-edition:p452:c3
relatedConcepts:
tags:
  - mysql
  - events
  - scheduling
  - advanced
sourceDocId: murachs-mysql-3rd-edition
---

# Events

## Definition
Scheduled tasks in MySQL

## Explanation
Chapter 13 Language skills for writing stored progra,ns A stored procedure that doesn't handle errors DELIMITER// CREATE PROCEDURE test() BEGIN INSERT INTO general_ ledger_ accounts VALUES (130, 'Cash'); SELECT '1 row was inserted.'; END// The response from the system Error Code: 1062. Duplicate entry 'Cash' for key 'account_description' A stored procedure that uses a CONTINUE handler to handle an error DELIMITER// CREATE PROCEDURE test() BEGIN DECLARE duplicate_entry_ for_key TINYINT DEFAULT FALSE; DECLARE CONTINUE HANDLER FOR 1062 SET duplicate_entry_ for_key = TRUE; INSERT INTO general_ ledger_accounts VALUES (130, 'Cash'); IF duplicate_entry_ for_key = TRUE THEN SELECT 'Row was not inserted - duplicate key encountered.' AS message; ELSE SELECT '1 row was inserted.' AS message; END IF; END// The response from the system message ► Row was not inserted - duplicate key encountered. How to use a condition handler (part 1 of 2)

The first stored procedure in part 2 shows how to exit the current block of code as soon as an error occurs. to start, this stored procedure begins by declaring a variable named duplicate_entry _for_key just like the stored procedure in part 1. Then, it uses the BEGIN and END keywords to nest a block of code within the block of code for the procedu1 e. Within the nested block of code, the first statement declares a condition handler for the MySQL error with a code of 1062. This handler uses the EXIT keyword to indicate that it should exit the block of code when this error occurs. Then, the second statement executes the INSERT statement that may cause the error. If no error occurs, the third statement in the block displays a message that indicates that the row was inserted. If an error occurs, however, the duplicate_entry _for_key variable is set to TRUE. In addition, code execution exits the block of code and jumps to the IF statement that's coded after the block. This statement displays a message that

duplicate_entry _for_key variable is set

## Examples
### Example 1: SELECT Example
```sql
SELECT '1 row was inserted.';
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT 'Row was not inserted - duplicate key encountered.' AS message;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
INSERT INTO general_ ledger_ accounts VALUES (130, 'Cash');
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 441, 442, 443, 444, 445, 446, 447, 448, 449, 450, 451, 452*
