# Backup and Restore

🟢 **Difficulty:** Beginner  
⏱️ **Estimated Time:** 20 minutes

## Learning Objectives

- Understand different backup strategies (full, incremental, differential)
- Learn how to create and restore database backups
- Know how to export and import data using SQL dumps
- Understand point-in-time recovery concepts

## What is This?

**Backup and restore** are database administration processes that create copies of data to protect against loss and recover databases to a previous state when needed.

Backups come in two main forms: **logical backups** (SQL dump files containing CREATE and INSERT statements that can recreate the database) and **physical backups** (direct file system copies of database files). Restoration uses these backups to recreate the database, either to the exact state when backed up or to a specific point in time using transaction logs. Backups protect against hardware failures that destroy data, user errors like accidental DELETE statements, security breaches that corrupt information, and compliance requirements that mandate data preservation. Common backup strategies include **full backups** (complete copies of all data), **incremental backups** (only changes since the last backup for faster, smaller copies), and **differential backups** (all changes since the last full backup).

**Note:** The sql.js environment runs entirely in the browser with no file system access. The examples below show real-world database commands for MySQL, PostgreSQL, and SQLite that would be run in actual production environments.

## Examples

### Example 1: Creating SQL Dump Backups

**Difficulty:** Beginner

**Scenario:** Create a full backup of the e-commerce database using standard SQL dump tools.

```sql
-- ============================================================
-- COMMAND LINE TOOLS (run in terminal, not in SQL client)
-- ============================================================

-- MySQL: mysqldump utility
-- Full database backup
mysqldump -u username -p ecommerce > ecommerce_backup_2024.sql

-- Backup specific tables only
mysqldump -u username -p ecommerce users orders order_items > ecommerce_core_tables.sql

-- Backup with data only (no CREATE TABLE statements)
mysqldump -u username -p --no-create-info ecommerce > ecommerce_data_only.sql

-- Backup structure only (no data)
mysqldump -u username -p --no-data ecommerce > ecommerce_schema_only.sql

-- PostgreSQL: pg_dump utility
-- Full database backup
pg_dump -U username -d ecommerce -f ecommerce_backup.sql

-- Compressed backup
pg_dump -U username -d ecommerce | gzip > ecommerce_backup.sql.gz

-- SQLite: Simply copy the database file or use .dump
sqlite3 ecommerce.db ".dump" > ecommerce_backup.sql

-- SQLite: Copy database file directly (physical backup)
cp ecommerce.db ecommerce_backup_$(date +%Y%m%d).db
```

**Explanation of dump file contents:**
```sql
-- Typical SQL dump file structure:

-- 1. Disable foreign key checks during restore
SET FOREIGN_KEY_CHECKS=0;

-- 2. Drop and recreate tables
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `age` int DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Insert data
INSERT INTO `users` VALUES 
  (1,'Alice','alice@email.com',25,'Seattle'),
  (2,'Bob','bob@email.com',30,'Portland'),
  (3,'Charlie','charlie@email.com',22,'Seattle');

-- 4. Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS=1;
```

**Explanation:** SQL dumps are portable text files containing all SQL statements needed to recreate the database. They're database-version independent and human-readable. However, for large databases, physical backups (copying data files directly) are faster but less portable.

---

### Example 2: Restoring from Backup

**Difficulty:** Beginner

**Scenario:** Restore the e-commerce database from a SQL dump file.

```sql
-- ============================================================
-- RESTORE COMMAND LINE TOOLS
-- ============================================================

-- MySQL: Restore from dump file
mysql -u username -p ecommerce < ecommerce_backup_2024.sql

-- Restore to a new database (create first)
mysql -u username -p -e "CREATE DATABASE ecommerce_new;"
mysql -u username -p ecommerce_new < ecommerce_backup_2024.sql

-- PostgreSQL: Restore from dump
psql -U username -d ecommerce -f ecommerce_backup.sql

-- SQLite: Restore from dump
sqlite3 ecommerce_restored.db < ecommerce_backup.sql

-- SQLite: Restore by copying file
cp ecommerce_backup_20240115.db ecommerce.db

-- ============================================================
-- SQL-BASED RESTORE OPERATIONS
-- ============================================================

-- Create a new database for restore
CREATE DATABASE ecommerce_restore;
USE ecommerce_restore;

-- Restore individual tables from backup
-- (Usually done by executing the dump file, but can be manual)

-- Example: Restore a single table from a partial backup
-- First, create the table structure
CREATE TABLE orders_restore (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount DECIMAL(10,2),
    order_date TIMESTAMP,
    status TEXT
);

-- Then insert data from a staging table or backup source
INSERT INTO orders_restore (user_id, total_amount, order_date, status)
SELECT user_id, total_amount, order_date, status
FROM staging_orders_backup;

-- Verify restore
SELECT COUNT(*) AS total_orders FROM orders_restore;
SELECT MIN(order_date) AS earliest, MAX(order_date) AS latest FROM orders_restore;

-- Compare row counts with original
SELECT 
    (SELECT COUNT(*) FROM orders) AS original_count,
    (SELECT COUNT(*) FROM orders_restore) AS restored_count;
```

**Explanation:** Restoration recreates the database from backup. Key considerations:
1. **Target database** - Can restore over existing or to new database
2. **Foreign key handling** - Dump files typically disable FK checks during restore
3. **Partial restores** - Can extract and restore specific tables
4. **Verification** - Always verify row counts and data integrity after restore

---

### Example 3: Incremental Backup Strategy

**Difficulty:** Intermediate

**Scenario:** Implement a backup tracking system and understand point-in-time recovery concepts.

```sql
-- ============================================================
-- BACKUP TRACKING TABLE (within your database)
-- ============================================================

-- Create a backup tracking table
CREATE TABLE IF NOT EXISTS backup_history (
    backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_type TEXT NOT NULL,  -- 'FULL', 'INCREMENTAL', 'LOG'
    backup_file TEXT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    size_bytes INTEGER,
    status TEXT,  -- 'RUNNING', 'COMPLETED', 'FAILED'
    checksum TEXT,  -- Verify backup integrity
    notes TEXT
);

-- Log a full backup
INSERT INTO backup_history (backup_type, backup_file, status, notes)
VALUES ('FULL', '/backups/full_20240115_020000.sql', 'RUNNING', 'Daily full backup');

-- Update when complete
UPDATE backup_history 
SET status = 'COMPLETED', 
    completed_at = CURRENT_TIMESTAMP,
    size_bytes = 157286400,
    checksum = 'a1b2c3d4e5f6...'
WHERE backup_id = 1;

-- ============================================================
-- TRANSACTION LOG TABLE (for audit and recovery)
-- ============================================================

-- Create a transaction log table for audit
CREATE TABLE IF NOT EXISTS transaction_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT,
    operation TEXT,  -- 'INSERT', 'UPDATE', 'DELETE'
    record_id INTEGER,
    old_values TEXT,  -- JSON of previous values
    new_values TEXT,  -- JSON of new values
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to log all changes (enables point-in-time recovery)
CREATE TRIGGER IF NOT EXISTS trg_orders_audit
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    INSERT INTO transaction_log 
        (table_name, operation, record_id, old_values, new_values)
    VALUES (
        'orders',
        'UPDATE',
        OLD.id,
        json_object('status', OLD.status, 'total', OLD.total_amount),
        json_object('status', NEW.status, 'total', NEW.total_amount)
    );
END;

-- Query the transaction log
SELECT * FROM transaction_log ORDER BY changed_at DESC LIMIT 10;

-- Find all changes after a specific time (for recovery analysis)
SELECT * FROM transaction_log 
WHERE changed_at > '2024-01-15 14:30:00'
ORDER BY changed_at;
```

**Explanation:** A complete backup strategy includes:
1. **Full backups** - Complete database dump (daily/weekly)
2. **Incremental backups** - Changes since last backup (faster, smaller)
3. **Transaction logs** - All changes for point-in-time recovery
4. **Backup verification** - Checksums and test restores
5. **Retention policy** - How long to keep backups (compliance requirement)

Point-in-time recovery allows restoring to any moment by applying transaction logs to a full backup.

## Common Mistakes

### Mistake 1: Not Testing Backup Restores

**Incorrect:**
```bash
# Setting up automated backups but never testing them
0 2 * * * mysqldump -u root -p ecommerce > /backups/daily.sql

# Months later, when disaster strikes...
mysql -u root -p ecommerce < /backups/daily.sql
# Error: Unknown column 'phone' in 'field list'
# The backup was corrupt or incompatible!
```

**Error Message:** Various - corrupt file, missing columns, version incompatibility.

**Why it happens:** Organizations often set up automated backups but never verify they actually work. Backups can fail silently (disk full, permissions issues), become corrupted, or be incompatible with current database versions.

**Corrected:**
```bash
#!/bin/bash
# backup_with_verification.sh

# Create backup with timestamp
BACKUP_FILE="/backups/ecommerce_$(date +%Y%m%d_%H%M%S).sql"
mysqldump -u backup_user -p ecommerce > "$BACKUP_FILE"

# Verify backup file exists and has content
if [ ! -s "$BACKUP_FILE" ]; then
    echo "ERROR: Backup failed - empty file" | mail -s "Backup Failed" admin@company.com
    exit 1
fi

# Create checksum for integrity verification
md5sum "$BACKUP_FILE" > "${BACKUP_FILE}.md5"

# Test restore to staging database
mysql -u root -p -e "DROP DATABASE IF EXISTS ecommerce_test; CREATE DATABASE ecommerce_test;"
mysql -u root -p ecommerce_test < "$BACKUP_FILE"

# Verify restore succeeded
ROW_COUNT=$(mysql -u root -p -N -e "SELECT COUNT(*) FROM ecommerce_test.users;")
if [ "$ROW_COUNT" -eq 0 ]; then
    echo "ERROR: Restore test failed" | mail -s "Restore Test Failed" admin@company.com
    exit 1
fi

# Log success
echo "Backup and restore test completed: $BACKUP_FILE" >> /var/log/backup.log

# Clean up test database
mysql -u root -p -e "DROP DATABASE ecommerce_test;"
```

💡 **Key Takeaway:** A backup you haven't tested is a gamble, not a backup. Schedule regular restore tests to a staging environment. Verify row counts, checksums, and application connectivity. Document the restore process so anyone can do it under pressure.

---

### Mistake 2: Backing Up Without Consistency Locks

**Incorrect:**
```bash
# Copying database files while application is running
cp /var/lib/mysql/ecommerce/* /backups/

# Or using mysqldump without proper locks
mysqldump -u root -p --single-transaction=0 ecommerce > backup.sql

# Result: Backup contains inconsistent data
-- Backup shows order_id=100 in orders table
-- But order_items table only has items up to order_id=99
-- A transaction was in progress during backup!
```

**Why it happens:** Copying database files or dumping data while transactions are active can capture inconsistent states where related tables don't match. This leads to foreign key violations during restore.

**Corrected:**
```bash
# MySQL with InnoDB: Use --single-transaction for consistent snapshot
mysqldump -u backup_user -p \
    --single-transaction \      # Consistent snapshot without locking
    --routines \                # Include stored procedures
    --triggers \                # Include triggers
    ecommerce > ecommerce_backup.sql

# For critical systems: Lock tables briefly during dump
mysqldump -u backup_user -p \
    --lock-all-tables \        # Lock entire database during dump
    ecommerce > ecommerce_locked_backup.sql

# Alternative: Use database-specific tools
# PostgreSQL: pg_dump with concurrent connections
pg_dump -U postgres -d ecommerce -Fc -f ecommerce.backup

# SQLite: Use backup API (guaranteed consistent)
sqlite3 ecommerce.db ".backup /backups/ecommerce_backup.db"
```

💡 **Key Takeaway:** Always ensure backup consistency. For InnoDB/MySQL, use `--single-transaction` for online backups without locking. For MyISAM or mixed engines, use `--lock-all-tables` to ensure consistency. Schedule backups during low-traffic periods to minimize impact.

---

### Mistake 3: Storing Backups in Only One Location

**Incorrect:**
```bash
# All backups on same server as database
mysqldump -u root -p ecommerce > /var/backups/ecommerce.sql

# Server disk fails - both database AND backups are lost!

# Or: Only local backups
# Office fire destroys server room - data is gone
```

**Why it happens:** Storing backups on the same server or in a single physical location violates the 3-2-1 backup rule (3 copies, 2 different media, 1 offsite). Natural disasters, hardware failures, or ransomware can destroy both primary data and backups simultaneously.

**Corrected:**
```bash
#!/bin/bash
# multi_location_backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="ecommerce_${DATE}.sql.gz"

# 1. Create compressed backup
mysqldump -u backup_user -p --single-transaction ecommerce | \
    gzip > "/tmp/${BACKUP_NAME}"

# 2. Local backup (RAID array)
cp "/tmp/${BACKUP_NAME}" "/backups/local/${BACKUP_NAME}"

# 3. Network backup (NAS)
scp "/tmp/${BACKUP_NAME}" "nas-server:/backups/database/"

# 4. Cloud backup (S3)
aws s3 cp "/tmp/${BACKUP_NAME}" "s3://company-backups/database/"

# 5. Offsite backup (different geographic region)
aws s3 cp "/tmp/${BACKUP_NAME}" "s3://company-backups-eu/database/" \
    --storage-class GLACIER  # Cheaper long-term storage

# Verify all copies
LOCAL_SIZE=$(stat -f%z "/backups/local/${BACKUP_NAME}")
S3_SIZE=$(aws s3 ls "s3://company-backups/database/${BACKUP_NAME}" | awk '{print $3}')

if [ "$LOCAL_SIZE" != "$S3_SIZE" ]; then
    echo "ERROR: Backup size mismatch" | mail -s "Backup Verification Failed" admin@company.com
fi

# Cleanup old local backups (keep 7 days)
find /backups/local -name "ecommerce_*.sql.gz" -mtime +7 -delete

# Cleanup old cloud backups (keep 30 days)
aws s3 ls s3://company-backups/database/ | \
    awk '$1 < "'$(date -d '30 days ago' +%Y-%m-%d)'" {print $4}' | \
    xargs -I {} aws s3 rm "s3://company-backups/database/{}"
```

💡 **Key Takeaway:** Follow the **3-2-1 rule**: 3 copies of data, on 2 different media types, with 1 copy offsite. Use a combination of local (fast restore), network (convenient), and cloud (disaster recovery) backups. Automate verification and implement retention policies to manage storage costs. Test restores from each location periodically.

---

*Content generated for SQL-Adapt Learning Platform*
