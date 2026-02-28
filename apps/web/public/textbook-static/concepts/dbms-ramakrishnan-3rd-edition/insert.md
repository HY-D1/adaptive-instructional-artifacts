# INSERT Statement

## Definition

The INSERT statement is used to add new rows of data into a table in a database. It's essential for populating tables with initial data and updating them as needed.

## Explanation

The INSERT statement solves the problem of adding new records to an existing table. Here’s how it works:
1. **Specify the Table**: You start by naming the table where you want to insert the new row.
2. **List Columns (Optional)**: If you don’t specify all columns, you must provide values for all non-nullable columns and default values for any that can be omitted.
3. **Provide Values**: You then list the values corresponding to each column in the order they appear in the table or by explicitly naming the columns.

You use INSERT when:
- Adding new products to an inventory system.
- Recording user sign-ups on a website.
- Updating employee records with their latest performance data.

Key things to remember:
- Always ensure that all required values are provided, either through column listing or default values.
- Be mindful of data types and constraints when inserting values.
- Use transactions for bulk inserts to maintain data integrity.

## Examples

### Basic Usage

```sql
INSERT INTO books (title, author, published_year) VALUES ('The Character of Physical Law', 'Richard Feynman', 1980);
```

This example inserts a new book into the `books` table with title, author, and publication year.

### Practical Example

```sql
INSERT INTO users (username, email, registration_date) VALUES ('john_doe', 'john@example.com', CURRENT_DATE);
```

This practical example adds a new user to the `users` table with username, email, and the current date as the registration date.

## Common Mistakes

### Forgetting to provide values for non-nullable columns

**Incorrect:**

```sql
INSERT INTO books (title) VALUES ('The Character of Physical Law');
```

**Correct:**

```sql
INSERT INTO books (title, author, published_year) VALUES ('The Character of Physical Law', 'Richard Feynman', 1980);
```

**Why this happens:** This mistake occurs when you try to insert a row without providing values for all non-nullable columns. Always ensure all required values are provided.

---

## Practice

**Question:** Insert a new customer into the `customers` table with the following details: name = 'Jane Smith', email = 'jane@example.com'.

**Solution:** INSERT INTO customers (name, email) VALUES ('Jane Smith', 'jane@example.com');
This solution correctly inserts a new customer into the `customers` table with the specified name and email.


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*