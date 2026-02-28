# Events

## Definition

Events are special types of triggers that automatically execute when a specific event occurs within a database. They help automate tasks and maintain data integrity without requiring manual intervention.

## Explanation

Events are crucial for automating routine tasks in databases, such as backups, archiving old data, or sending notifications. Here’s how they work and when to use them:

1. **What problem do events solve?** Events help automate repetitive tasks that would otherwise require manual intervention, saving time and reducing errors.

2. **How do they work?** An event is defined with a schedule (like daily, weekly) and a SQL statement or stored procedure to execute. When the scheduled time arrives, the database runs the specified task automatically.

3. **When to use them?** Use events for tasks that need to run at regular intervals, such as cleaning up old data, sending periodic reports, or performing backups.

4. **Key things to remember:** Always test your event before deploying it in a production environment. Ensure the SQL statement is correct and won’t cause unintended side effects.

## Examples

### Basic Usage

```sql
-- Create a simple event to delete old records daily
CREATE EVENT delete_old_records
ON SCHEDULE EVERY 1 DAY
DO DELETE FROM old_data WHERE date < DATE_SUB(CURDATE(), INTERVAL 30 DAY);
```

This example creates an event that deletes records from the `old_data` table every day, keeping only the last 30 days of data.

### Practical Example

```sql
-- Schedule a weekly report generation CREATE EVENT generate_weekly_report ON SCHEDULE EVERY 1 WEEK STARTS '2024-01-01' DO CALL generate_report();
```

This practical example schedules a stored procedure `generate_report` to run every week starting from January 1, 2024.

## Common Mistakes

### Forgetting to test the event before deployment.

**Incorrect:**

```sql
-- Incorrectly scheduled event without testing
CREATE EVENT delete_old_records
ON SCHEDULE EVERY 1 DAY
DO DELETE FROM old_data WHERE date < DATE_SUB(CURDATE(), INTERVAL 30 DAY);
```

**Correct:**

```sql
-- Correctly scheduled and tested event
CREATE EVENT delete_old_records
ON SCHEDULE EVERY 1 DAY
DO BEGIN
    -- Test the SQL statement first
    SELECT * FROM old_data WHERE date < DATE_SUB(CURDATE(), INTERVAL 30 DAY);
    DELETE FROM old_data WHERE date < DATE_SUB(CURDATE(), INTERVAL 30 DAY);
END;
```

**Why this happens:** Always test your event with a small subset of data before deploying it to ensure it works as expected.

---

## Practice

**Question:** Create an event that runs every Monday at 8 AM to update the status of all orders in the `orders` table to 'Processed'.

**Solution:** -- Solution
CREATE EVENT process_orders_daily
ON SCHEDULE EVERY 1 WEEK DAYOFWEEK = 2 STARTS '2024-01-07'
DO UPDATE orders SET status = 'Processed';
-- Explanation: This event updates the status of all orders to 'Processed' every Monday at 8 AM.

---

*Source: Murach's MySQL 3rd Edition*