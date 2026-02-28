# Altering Tables

## Definition

Altering tables is the process of changing an existing database table's structure, such as adding new columns, removing existing ones, or modifying column properties.

## Explanation

When designing a database, it's crucial to have well-structured tables that accurately represent your data. However, real-world requirements often change, necessitating alterations to these tables. Altering tables allows you to make these necessary changes without losing the integrity of your existing data. Here’s how it works and when to use it.

## Examples

### Basic Usage

```sql
-- Adding a new column ALTER TABLE Vendors ADD COLUMN vendor_email VARCHAR(255);
```

This example demonstrates how to add a new column 'vendor_email' to the 'Vendors' table. It's useful when you need to store additional contact information for vendors.

### Practical Example

```sql
-- Modifying an existing column ALTER TABLE Invoices MODIFY COLUMN invoice_total DECIMAL(10, 2);
```

This practical example shows how to change the data type of 'invoice_total' in the 'Invoices' table to a more precise decimal format. This is important for financial calculations.

## Common Mistakes

### Using the wrong command

**Incorrect:**

```sql
-- Incorrect command ALTER TABLE Vendors ADD vendor_phone;
```

**Correct:**

```sql
-- Correct command ALTER TABLE Vendors ADD COLUMN vendor_phone VARCHAR(15);
```

**Why this happens:** The mistake here is not specifying the data type for the new column. Always include the correct data type to ensure the column functions properly.

---

## Practice

**Question:** Create a practical question that tests understanding of this concept

**Solution:** Provide a clear solution with explanation

---

*Source: Murach's MySQL 3rd Edition*