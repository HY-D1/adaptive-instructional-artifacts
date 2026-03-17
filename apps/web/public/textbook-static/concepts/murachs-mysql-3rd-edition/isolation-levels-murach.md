---
id: isolation-levels-murach
title: Transaction Isolation Levels
definition: READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE
difficulty: advanced
estimatedReadTime: 5
pageReferences: [471, 472, 473, 474, 475, 476, 477, 478, 479, 480, 481, 482]
chunkIds:
  - murachs-mysql-3rd-edition:p471:c1
  - murachs-mysql-3rd-edition:p471:c2
  - murachs-mysql-3rd-edition:p472:c1
  - murachs-mysql-3rd-edition:p472:c2
  - murachs-mysql-3rd-edition:p473:c1
  - murachs-mysql-3rd-edition:p473:c2
  - murachs-mysql-3rd-edition:p474:c1
  - murachs-mysql-3rd-edition:p474:c2
  - murachs-mysql-3rd-edition:p474:c3
  - murachs-mysql-3rd-edition:p474:c4
  - murachs-mysql-3rd-edition:p475:c1
  - murachs-mysql-3rd-edition:p475:c2
  - murachs-mysql-3rd-edition:p476:c1
  - murachs-mysql-3rd-edition:p476:c2
  - murachs-mysql-3rd-edition:p477:c1
  - murachs-mysql-3rd-edition:p478:c1
  - murachs-mysql-3rd-edition:p478:c2
  - murachs-mysql-3rd-edition:p479:c1
  - murachs-mysql-3rd-edition:p479:c2
  - murachs-mysql-3rd-edition:p480:c1
  - murachs-mysql-3rd-edition:p480:c2
  - murachs-mysql-3rd-edition:p480:c3
  - murachs-mysql-3rd-edition:p480:c4
  - murachs-mysql-3rd-edition:p481:c1
  - murachs-mysql-3rd-edition:p481:c2
  - murachs-mysql-3rd-edition:p482:c1
relatedConcepts:
tags:
  - mysql
  - transactions
  - isolation
  - advanced
sourceDocId: murachs-mysql-3rd-edition
---

# Transaction Isolation Levels

## Definition
READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE

## Explanation
Chapter 15 How to create stored prvcedures and functions A CREATE PROCEDURE statement that provides a default value DELIMITER// CREATE PROCEDURE update_ invoices_credit_total ( invoice_ id_param INT, credit_ total_param DECIMAL(9,2)) BEGIN DECLARE sql_error TINYINT DEFAULT FALSE; DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET sql_error = TRUE; -- Set default values for NULL values IF credit_ total_param IS NULL THEN SET credit_ total_param = 100; END IF; START TRANSACTION; UPDATE invoices SET credit_total = credit_ total_param WHERE invoice id= invoice_ id_param; IF sql_ error = FALSE THEN COMMIT; ELSE ROLLBACK; END IF; END// A statement that calls the stored procedure CALL update_ invoices_credit_total(56, 200); Another statement that calls the stored procedure CALL update_ invoices_credit_total(56, NULL); Description • You can provide a default value for a parameter so that if the calling program passes a null value for the parameter, the default value is used instead. • to set a default value for a parameter, you can use an IF statement to check if the parameter contains a null value. If it does, you can assign a default value to the parameter. •

a parameter, you can use an IF statement to check if the parameter contains a null value. If it does, you can assign a default value to the parameter. • It's a good programming practice to code your CREATE PROCEDURE statements so they list parameters that require values first, fallowed by parameters that allow null values. How to set a default value for a parameter

How to validate parameters and raise errors Within a stored procedure, it's generally considered a good practice to prevent errors by checking the parameters before they 're used to make sure they're valid. This is often refe1Ted to as data validation. Then, if the data isn't valid, you can execute code that makes it valid, or you can raise an error, which returns the error to the calling program. that are available from MySQL. to do that, you code the SIGNAL

## Examples
### Example 1: SELECT Example
```sql
SELECT statement gets the value of the default terms id column for the vendor and stores it in the terms id variable. If - - - this parameter isn't null, the value of the terrr1s_id parameter is assigned to the terms id variable. The next IF statement is similar. It checks the value of the parameter for the invoice_due_date column for a null value. If the parameter is nt1ll, a SELECT statement uses the value of the terms_id variable to get the number of days until the invoice is due

for the invoice_due_date column for a null value. If the parameter is nt1ll, a SELECT statement uses the value of the terms_id variable to get the number of days until the invoice is due from the terms table, and it stores this value in the terms_due_days variable. Then, it calculates a due date for the invoice by using the DATE_ADD function to add the number of days to the invoice date. If the invoice_due_date parameter isn't null, though, this code sets the invoice_due_date variable to the value that's stored in the parameter.

Chapter 15 How to create stored prvcedures and functions A stored procedure that validates the data in a new invoice DELIMITER// CREATE PROCEDURE insert_ invoice ( vendor_id_param invoice_ number_param invoice_date_param invoice_ total_param terms_id_param invoice_due_date_param INT, VARCHAR(SO), DATE, DECIMAL(9,2), INT,) BEGIN DECLARE terms id var DATE DECLARE invoice_due_date_var DECLARE terms_due_days_var -- Validate paramater values INT;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT default_ terms_ id INTO terms id var FROM vendors WHERE vendor_ id = vendor_ id_param;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
INSERT INTO invoices (vendor_ id, invoice_nwnber, invoice_date, invoice_ total,

INTO terms_due_days_var FROM terms WHERE terms_ id = terms_ id_var;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 471, 472, 473, 474, 475, 476, 477, 478, 479, 480, 481, 482*
