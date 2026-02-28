# Backup and Restore

## Definition

Backup and restore are processes used to save copies of databases and recover them when needed. This ensures data safety and availability.

## Explanation

Database backups are crucial for protecting against data loss due to hardware failures, software errors, or malicious attacks. A backup creates a copy of the database at a specific point in time. When a restore is performed, this backup is used to recreate the database state. This process helps maintain business continuity and data integrity.

## Examples

### Basic Backup

```sql
-- SQL command to CREATE a backup of the 'mydatabase' database mysqldump -u username -p mydatabase > mydatabase_backup.sql;
```

This example demonstrates how to use the mysqldump utility to create a backup of a database. The backup file is saved in the current directory.

### Practical Example

```sql
-- SQL command to restore 'mydatabase' from a backup
mysql -u username -p mydatabase < mydatabase_backup.sql;
```

This example shows how to restore a database using the mysqldump utility. The database is restored from the previously created backup file.

## Common Mistakes

### Forgetting to include the database name in the backup command

**Incorrect:**

```sql
-- Incorrect backup command mysqldump -u username -p > mydatabase_backup.sql;
```

**Correct:**

```sql
-- Correct backup command mysqldump -u username -p mydatabase > mydatabase_backup.sql;
```

**Why this happens:** This mistake can lead to an incomplete backup. Always specify the database name in the mysqldump command.

---

## Practice

**Question:** How would you create a backup of a database named 'sales' using mysqldump?

**Solution:** The correct SQL command is: mysqldump -u username -p sales > sales_backup.sql. This command will prompt for the password and then create a backup of the 'sales' database, saving it as 'sales_backup.sql'.

---

*Source: Murach's MySQL 3rd Edition*