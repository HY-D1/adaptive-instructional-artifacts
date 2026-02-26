# Stored Procedures and Functions

## Definition
Creating reusable SQL code blocks stored in the database

## Explanation
440 Section 4 Stored prvgram development How to lock selected rows In some cases, the default isolation level of REPEATABLE READ doesn't work the way you want. For example, suppose you want to code a transaction that selects data and then inserts or updates data in related tables. In that case, because a SELECT statement doesn't lock the data it retrieves by default, another transaction could update or delete the rows read by the first transaction before that transaction is done modifying the related tables. To solve this type of problem, MySQL provides two ways to lock the rows returned by a SELECT statement. First, you can add a FOR SHARE clause (LOCK IN SHARE MODE with MySQL 5.7 and earlier) to the end of a SELECT statement. This locks the selected rows so other transactions can read them but can't modify them until your transaction commjts. Second, you can add a FOR UPDATE clause to the end of a SELECT statement. This locks the selected rows and any associated indexes just like an UPDATE statement does. Then, other transactions

add a FOR UPDATE clause to the end of a SELECT statement. This locks the selected rows and any associated indexes just like an UPDATE statement does. Then, other transactions can't read or modify these rows until your transaction commits. When you use the FOR SHARE clause, the SELECT statement waits if it encounters rows that have been locked for update by another statement such as an UPDATE, DELETE, or SELECT ... FOR UPDATE statement. That way, it can read the most current data. However, the FOR SHARE clause doesn't wait for rows that have been locked for share. On the other hand, the FOR UPDATE clause wruts for rows that have been locked for share or for update. Because of this, the FOR SHARE clause provides better perforrnance than the FOR UPDATE clause. As a result, you should use the FOR SHARE clause if you don't need to prevent other transactions from reading the same rows. With MySQL 8.0 and later, you can also keep your transacti

## Examples
### Example 1: SELECT Example
```sql
SELECT statement doesn't lock the data it retrieves by default, another transaction could update or delete the rows read by the first transaction before that transaction is done modifying the related tables. To solve this type of problem, MySQL provides two ways to lock the rows returned by a SELECT statement. First, you can add a FOR SHARE clause (LOCK IN SHARE MODE with MySQL 5.7 and earlier) to the end of a SELECT statement. This locks the selected rows so other transactions can read them but can't modify them until your transaction commjts. Second, you can add a FOR UPDATE clause to the end of a SELECT statement. This locks the selected rows and any associated indexes just like an UPDATE statement does. Then, other transactions

add a FOR UPDATE clause to the end of a SELECT statement. This locks the selected rows and any associated indexes just like an UPDATE statement does. Then, other transactions can't read or modify these rows until your transaction commits. When you use the FOR SHARE clause, the SELECT statement waits if it encounters rows that have been locked for update by another statement such as an UPDATE, DELETE, or SELECT ... FOR UPDATE statement. That way, it can read the most current data. However, the FOR SHARE clause doesn't wait for rows that have been locked for share. On the other hand, the FOR UPDATE clause wruts for rows that have been locked for share or for update. Because of this, the FOR SHARE clause provides better perforrnance than the FOR UPDATE clause. As a result, you should use the FOR SHARE clause if you don't need to prevent other transactions from reading the same rows. With MySQL 8.0 and later, you can also keep your transactions from waiting for locks to be released. To do that, you can

other transactions from reading the same rows. With MySQL 8.0 and later, you can also keep your transactions from waiting for locks to be released. To do that, you can add the NO WAIT or SKIP LOCKED option to the end of a FOR SHARE or FOR UPDATE clause. The NO WAIT option causes the statement to immediately retur·n an error that the developer can handle. The SKIP LOCKED option skips any rows that have been locked and returns the rest. Figure 14-6 p1·esents a se1ies of transactions that show how the FOR SHARE and FOR UPDATE clauses of a SELECT statement work. To start, transaction A executes a SELECT statement that uses the FOR SHARE clause to lock the row in the Sales_Reps table that has a rep_id value of 2. At this point, no other transactions can modify this row until transaction A completes. This makes sure that transaction A can modify the data in a child table before any other transaction can update or delete the corresponding row in the parent table. In transaction B, the SELECT

transaction A can modify the data in a child table before any other transaction can update or delete the corresponding row in the parent table. In transaction B, the SELECT statement includes the FOR UPDATE clause. As a result, it attempts to lock 4 rows for update. If transaction A still has a lock on one of these rows, though, transaction B waits for that lock to be released. Once transaction A completes, the SELECT statement in transaction B is executed. This returns four rows with rep_id values of 1, 2, 3, and 4.

Chapter 14 How to use transactions and locking 441 Four transactions that show how to work with locking reads Transaction A -- Execute each statement one at a time. - - Al tern.ate with Transactions B, C, and D as described. START TRANSACTION;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT * FROM sales_reps WHERE rep_id < 5 FOR UPDATE';
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
insert row with rep_ id of 2 into child table INSERT INTO sales_ totals (rep_ id, sales_year, sales_ total) VALUES (2, 2019, 138193.69);
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 460, 461, 462, 463, 464, 465, 466, 467, 468, 469, 470, 471, 472, 473*
