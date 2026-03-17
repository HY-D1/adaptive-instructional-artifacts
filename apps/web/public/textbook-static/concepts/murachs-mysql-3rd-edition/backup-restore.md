---
id: backup-restore
title: Backup and Restore
definition: Database backup strategies and restoration procedures
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517]
chunkIds:
  - murachs-mysql-3rd-edition:p505:c1
  - murachs-mysql-3rd-edition:p505:c2
  - murachs-mysql-3rd-edition:p506:c1
  - murachs-mysql-3rd-edition:p506:c2
  - murachs-mysql-3rd-edition:p506:c3
  - murachs-mysql-3rd-edition:p507:c1
  - murachs-mysql-3rd-edition:p507:c2
  - murachs-mysql-3rd-edition:p508:c1
  - murachs-mysql-3rd-edition:p508:c2
  - murachs-mysql-3rd-edition:p509:c1
  - murachs-mysql-3rd-edition:p509:c2
  - murachs-mysql-3rd-edition:p510:c1
  - murachs-mysql-3rd-edition:p510:c2
  - murachs-mysql-3rd-edition:p511:c1
  - murachs-mysql-3rd-edition:p513:c1
  - murachs-mysql-3rd-edition:p513:c2
  - murachs-mysql-3rd-edition:p514:c1
  - murachs-mysql-3rd-edition:p514:c2
  - murachs-mysql-3rd-edition:p514:c3
  - murachs-mysql-3rd-edition:p515:c1
  - murachs-mysql-3rd-edition:p515:c2
  - murachs-mysql-3rd-edition:p516:c1
  - murachs-mysql-3rd-edition:p516:c2
  - murachs-mysql-3rd-edition:p516:c3
  - murachs-mysql-3rd-edition:p516:c4
  - murachs-mysql-3rd-edition:p517:c1
  - murachs-mysql-3rd-edition:p517:c2
  - murachs-mysql-3rd-edition:p517:c3
relatedConcepts:
tags:
  - mysql
  - backup
  - dba
sourceDocId: murachs-mysql-3rd-edition
---

# Backup and Restore

## Definition
Database backup strategies and restoration procedures

## Explanation
Chapter 16 How to create triggers and events A statement that lists all triggers in the current database SHOW TRIGGERS A statement that lists all triggers in the specified database SHOW TRIGGERS IN ap J Tr19ger Event Table statement Ttming Created ► j involces_after _insert INSERT invoices BEGIN INSERT INTO invoices_audit VALUES... BEGIN DEa. ARE sum_line_jtem_amou,t DEO... BEGIN INSERT INTO invoices_audlt VALUES •.• BEGIN SET NEW. vendor _state = UPPER{NEW •... AFTER 2018-12-28 ll: invoices _befure_upda te UPDATE Invoices BEFORE 2018-12-28 11: involces_after _delete DaETE Invoices AFTER 2018-12-28 11: vendors _before _update UPDATE vendors BEFORE 2018-12-28 11: < > A statement that lists all triggers in a database that begin with ''ven'' SHOW TRIGGERS IN ap LIKE 'ven%' Trigger Event Table statement Tuning Created ► vendors_before_update UPDATE vendors BEGIN SET NE¥J.vendor_state = UPPER{NEW.... BEFORE 2018-12-28 11: A statement that drops a trigger DROP TRIGGER vendors_before_update A statement that drops a trigger only if it exists DROP TRIGGER IF EXISTS vendors_before_update Description • to view triggers, use the SHOW TRIGGERS statement. to filter the result set that's returned, include an IN

that drops a trigger only if it exists DROP TRIGGER IF EXISTS vendors_before_update Description • to view triggers, use the SHOW TRIGGERS statement. to filter the result set that's returned, include an IN clause or a LIKE clat1se. • to drop a trigger, use the DROP TRIGGER statement. to be sure a trigger exists before it's dropped, include the IF EXISTS keywords. How to view or drop triggers >

How to work with events An event, or scheduled event, is a named database object that executes, or fires, according to the event scheduler. With MySQL 8.0 and later, the event scheduler is on by default. As a result, if you don't need to use events, you should turn the event scheduler off to save system resources. Conversely, the event scheduler is off by default with MySQL 5.7 and e

## Examples
### Example 1: INSERT Example
```sql
insert INSERT invoices BEGIN INSERT INTO invoices_audit VALUES... BEGIN DEa. ARE sum_line_jtem_amou,t DEO... BEGIN INSERT INTO invoices_audlt VALUES •.• BEGIN SET NEW. vendor _state = UPPER{NEW •... AFTER 2018-12-28 ll: invoices _befure_upda te UPDATE Invoices BEFORE 2018-12-28 11: involces_after _delete DaETE Invoices AFTER 2018-12-28 11: vendors _before _update UPDATE vendors BEFORE 2018-12-28 11: < > A statement that lists all triggers in a database that begin with ''ven'' SHOW TRIGGERS IN ap LIKE 'ven%' Trigger Event Table statement Tuning Created ► vendors_before_update UPDATE vendors BEGIN SET NE¥J.vendor_state = UPPER{NEW.... BEFORE 2018-12-28 11: A statement that drops a trigger DROP TRIGGER vendors_before_update A statement that drops a trigger only if it exists DROP TRIGGER IF EXISTS vendors_before_update Description • to view triggers, use the SHOW TRIGGERS statement. to filter the result set that's returned, include an IN

that drops a trigger only if it exists DROP TRIGGER IF EXISTS vendors_before_update Description • to view triggers, use the SHOW TRIGGERS statement. to filter the result set that's returned, include an IN clause or a LIKE clat1se. • to drop a trigger, use the DROP TRIGGER statement. to be sure a trigger exists before it's dropped, include the IF EXISTS keywords. How to view or drop triggers >

How to work with events An event, or scheduled event, is a named database object that executes, or fires, according to the event scheduler. With MySQL 8.0 and later, the event scheduler is on by default. As a result, if you don't need to use events, you should turn the event scheduler off to save system resources. Conversely, the event scheduler is off by default with MySQL 5.7 and earlier. If you want to use the event scheduler with one of those releases, then, you need to turn it on. How to turn the event scheduler on or off to do that, you can use the SHOW VARIABLES statement to view the variable named event_scheduler. Then, if the event scheduler isn't on, you'll need to tum it on before you can work with events. to do that, you can use the SET statement to set the value of the event scheduler variable to ON. - Here, the ON keyword is a synonym for the INT value of 1. Conversely, the OFF keyword is a synonym for the INT value of

the value of the event scheduler variable to ON. - Here, the ON keyword is a synonym for the INT value of 1. Conversely, the OFF keyword is a synonym for the INT value of 0. Since the ON and OFF keywords are easier to read than I and 0, this chapter uses these keywords. However, if you 're using an older version of MySQL, you may need to use the INT values. When you use a SET statement to change the event_scheduler variable as shown in this figure, the change only applies until the server is restarted. However, if you want to make this change permanent, you can change this variable in MySQL's configuration ftle as described in the next chapter. How to create an event an event. You can use this statement to create a one-time event that occurs only once or a recitrring event that repeats at a regular interval. The first CREATE EVENT statement in this figure creates a one-time event named one_time_delete_audit_rows. to do that, this trigger uses the AT keyword to specify that the

event that repeats at a regular interval. The first CREATE EVENT statement in this figure creates a one-time event named one_time_delete_audit_rows. to do that, this trigger uses the AT keyword to specify that the event should be executed one month from the current date and time. Then, it uses the DO keyword to identify the statements that the event should execute. Here, the statements include the BEGIN and END keywords that identify a block of code. Within that block, a single DELETE statement deletes all rows from the Invoices_Audit table that are more than one month old. Like the code for a trigger, the code for an event doesn't have to be coded within a block if it consists of a single statement. In this case, then, the event could have been coded like this: CREATE EVENT one_time_delete_audit_rows ON SCHEDULE AT NOW () + INTERVAL 1 MONTH DO DELETE FROM invoices_audit WHERE action_date < NOW{) - INTERVAL 1 MONTH;
```
Example INSERT statement from textbook.

### Example 2: UPDATE Example
```sql
UPDATE Invoices BEFORE 2018-12-28 11: involces_after _delete DaETE Invoices AFTER 2018-12-28 11: vendors _before _update UPDATE vendors BEFORE 2018-12-28 11: < > A statement that lists all triggers in a database that begin with ''ven'' SHOW TRIGGERS IN ap LIKE 'ven%' Trigger Event Table statement Tuning Created ► vendors_before_update UPDATE vendors BEGIN SET NE¥J.vendor_state = UPPER{NEW.... BEFORE 2018-12-28 11: A statement that drops a trigger DROP TRIGGER vendors_before_update A statement that drops a trigger only if it exists DROP TRIGGER IF EXISTS vendors_before_update Description • to view triggers, use the SHOW TRIGGERS statement. to filter the result set that's returned, include an IN

that drops a trigger only if it exists DROP TRIGGER IF EXISTS vendors_before_update Description • to view triggers, use the SHOW TRIGGERS statement. to filter the result set that's returned, include an IN clause or a LIKE clat1se. • to drop a trigger, use the DROP TRIGGER statement. to be sure a trigger exists before it's dropped, include the IF EXISTS keywords. How to view or drop triggers >

How to work with events An event, or scheduled event, is a named database object that executes, or fires, according to the event scheduler. With MySQL 8.0 and later, the event scheduler is on by default. As a result, if you don't need to use events, you should turn the event scheduler off to save system resources. Conversely, the event scheduler is off by default with MySQL 5.7 and earlier. If you want to use the event scheduler with one of those releases, then, you need to turn it on. How to turn the event scheduler on or off to do that, you can use the SHOW VARIABLES statement to view the variable named event_scheduler. Then, if the event scheduler isn't on, you'll need to tum it on before you can work with events. to do that, you can use the SET statement to set the value of the event scheduler variable to ON. - Here, the ON keyword is a synonym for the INT value of 1. Conversely, the OFF keyword is a synonym for the INT value of

the value of the event scheduler variable to ON. - Here, the ON keyword is a synonym for the INT value of 1. Conversely, the OFF keyword is a synonym for the INT value of 0. Since the ON and OFF keywords are easier to read than I and 0, this chapter uses these keywords. However, if you 're using an older version of MySQL, you may need to use the INT values. When you use a SET statement to change the event_scheduler variable as shown in this figure, the change only applies until the server is restarted. However, if you want to make this change permanent, you can change this variable in MySQL's configuration ftle as described in the next chapter. How to create an event an event. You can use this statement to create a one-time event that occurs only once or a recitrring event that repeats at a regular interval. The first CREATE EVENT statement in this figure creates a one-time event named one_time_delete_audit_rows. to do that, this trigger uses the AT keyword to specify that the

event that repeats at a regular interval. The first CREATE EVENT statement in this figure creates a one-time event named one_time_delete_audit_rows. to do that, this trigger uses the AT keyword to specify that the event should be executed one month from the current date and time. Then, it uses the DO keyword to identify the statements that the event should execute. Here, the statements include the BEGIN and END keywords that identify a block of code. Within that block, a single DELETE statement deletes all rows from the Invoices_Audit table that are more than one month old. Like the code for a trigger, the code for an event doesn't have to be coded within a block if it consists of a single statement. In this case, then, the event could have been coded like this: CREATE EVENT one_time_delete_audit_rows ON SCHEDULE AT NOW () + INTERVAL 1 MONTH DO DELETE FROM invoices_audit WHERE action_date < NOW{) - INTERVAL 1 MONTH;
```
Example UPDATE statement from textbook.

### Example 3: DELETE Example
```sql
delete DaETE Invoices AFTER 2018-12-28 11: vendors _before _update UPDATE vendors BEFORE 2018-12-28 11: < > A statement that lists all triggers in a database that begin with ''ven'' SHOW TRIGGERS IN ap LIKE 'ven%' Trigger Event Table statement Tuning Created ► vendors_before_update UPDATE vendors BEGIN SET NE¥J.vendor_state = UPPER{NEW.... BEFORE 2018-12-28 11: A statement that drops a trigger DROP TRIGGER vendors_before_update A statement that drops a trigger only if it exists DROP TRIGGER IF EXISTS vendors_before_update Description • to view triggers, use the SHOW TRIGGERS statement. to filter the result set that's returned, include an IN

that drops a trigger only if it exists DROP TRIGGER IF EXISTS vendors_before_update Description • to view triggers, use the SHOW TRIGGERS statement. to filter the result set that's returned, include an IN clause or a LIKE clat1se. • to drop a trigger, use the DROP TRIGGER statement. to be sure a trigger exists before it's dropped, include the IF EXISTS keywords. How to view or drop triggers >

How to work with events An event, or scheduled event, is a named database object that executes, or fires, according to the event scheduler. With MySQL 8.0 and later, the event scheduler is on by default. As a result, if you don't need to use events, you should turn the event scheduler off to save system resources. Conversely, the event scheduler is off by default with MySQL 5.7 and earlier. If you want to use the event scheduler with one of those releases, then, you need to turn it on. How to turn the event scheduler on or off to do that, you can use the SHOW VARIABLES statement to view the variable named event_scheduler. Then, if the event scheduler isn't on, you'll need to tum it on before you can work with events. to do that, you can use the SET statement to set the value of the event scheduler variable to ON. - Here, the ON keyword is a synonym for the INT value of 1. Conversely, the OFF keyword is a synonym for the INT value of

the value of the event scheduler variable to ON. - Here, the ON keyword is a synonym for the INT value of 1. Conversely, the OFF keyword is a synonym for the INT value of 0. Since the ON and OFF keywords are easier to read than I and 0, this chapter uses these keywords. However, if you 're using an older version of MySQL, you may need to use the INT values. When you use a SET statement to change the event_scheduler variable as shown in this figure, the change only applies until the server is restarted. However, if you want to make this change permanent, you can change this variable in MySQL's configuration ftle as described in the next chapter. How to create an event an event. You can use this statement to create a one-time event that occurs only once or a recitrring event that repeats at a regular interval. The first CREATE EVENT statement in this figure creates a one-time event named one_time_delete_audit_rows. to do that, this trigger uses the AT keyword to specify that the

event that repeats at a regular interval. The first CREATE EVENT statement in this figure creates a one-time event named one_time_delete_audit_rows. to do that, this trigger uses the AT keyword to specify that the event should be executed one month from the current date and time. Then, it uses the DO keyword to identify the statements that the event should execute. Here, the statements include the BEGIN and END keywords that identify a block of code. Within that block, a single DELETE statement deletes all rows from the Invoices_Audit table that are more than one month old. Like the code for a trigger, the code for an event doesn't have to be coded within a block if it consists of a single statement. In this case, then, the event could have been coded like this: CREATE EVENT one_time_delete_audit_rows ON SCHEDULE AT NOW () + INTERVAL 1 MONTH DO DELETE FROM invoices_audit WHERE action_date < NOW{) - INTERVAL 1 MONTH;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517*
