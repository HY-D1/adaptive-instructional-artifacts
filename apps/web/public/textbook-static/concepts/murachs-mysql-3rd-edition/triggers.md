# Triggers

## Definition

A trigger is a special type of stored procedure that automatically executes when a specific event occurs on a table, such as INSERT, UPDATE, or DELETE. It helps maintain data integrity and enforce business rules directly within the database.

## Explanation

Triggers are incredibly useful for maintaining the consistency and accuracy of your data without having to write complex application logic. They allow you to perform actions automatically whenever certain events happen on a table. For example, if you want to ensure that every time a new record is inserted into an 'orders' table, the total amount is calculated and stored in another column, you can create a trigger for this purpose.

## Examples

### Basic Trigger Example

```sql
-- CREATE a trigger that updates the 'last_modified' column whenever any row in the 'employees' TABLE is updated. CREATE TRIGGER update_last_modified BEFORE UPDATE ON employees FOR EACH ROW BEGIN SET NEW.last_modified = NOW(); END;
```

This example shows how to create a trigger that automatically updates the 'last_modified' column with the current timestamp every time an employee record is updated.

### Practical Example

```sql
-- CREATE a trigger that inserts a new row into an 'audit_log' TABLE whenever a new product is added to the 'products' TABLE. CREATE TRIGGER log_product_addition AFTER INSERT ON products FOR EACH ROW BEGIN INSERT INTO audit_log (action, product_id, action_date) VALUES ('Added', NEW.product_id, NOW()); END;
```

This practical example demonstrates how a trigger can be used to maintain an audit log of all changes made to the 'products' table.

## Common Mistakes

### Forgetting to specify the correct timing (BEFORE, AFTER) for the trigger.

**Incorrect:**

```sql
-- Incorrect trigger creation CREATE TRIGGER incorrect_trigger ON employees FOR EACH ROW BEGIN SET NEW.last_modified = NOW(); END;
```

**Correct:**

```sql
-- Correct trigger creation CREATE TRIGGER update_last_modified AFTER UPDATE ON employees FOR EACH ROW BEGIN SET NEW.last_modified = NOW(); END;
```

**Why this happens:** Triggers must specify when they should be executed (BEFORE or AFTER the event). Forgetting this can lead to unexpected behavior.

---

## Practice

**Question:** Create a trigger that automatically updates the 'total_amount' column in the 'orders' table whenever any row is updated.

**Solution:** -- Solution
CREATE TRIGGER update_total_amount
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
SET NEW.total_amount = NEW.quantity * NEW.price;
END;

---

*Source: Murach's MySQL 3rd Edition*