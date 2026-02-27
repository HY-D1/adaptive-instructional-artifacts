# SELECT Statement

## Definition

A SELECT statement is used to retrieve data from a database table. It allows you to specify which columns and rows of data you want to see.

## Explanation

The SELECT statement is one of the most fundamental tools in SQL for querying databases. It enables users to extract specific information from tables based on certain conditions. Here’s how it works:
1. **Specify Columns**: You list the column names you want to retrieve, separated by commas.
2. **FROM Table**: This specifies the table from which to fetch the data.
3. **WHERE Condition (Optional)**: This filters the rows that are returned based on a condition.
4. **ORDER BY Clause (Optional)**: This sorts the results in ascending or descending order based on one or more columns.
You use SELECT statements whenever you need to view, analyze, or manipulate data stored in your database.

## Examples

### Basic Usage

```sql
SELECT vendor_name, vendor_address1, vendor_state FROM vendors;
```

This example retrieves the names and addresses of all vendors in the database.

### Practical Example

```sql
SELECT vendor_name, vendor_phone FROM vendors WHERE vendor_state = 'CA';
```

This practical example fetches the names and phone numbers of vendors located in California.

## Common Mistakes

### Forgetting to specify columns

**Incorrect:**

```sql
SELECT FROM vendors;
```

**Correct:**

```sql
SELECT vendor_name FROM vendors;
```

**Why this happens:** Always include column names after SELECT. If you omit them, the query will return all columns.

### Using incorrect syntax for WHERE clause

**Incorrect:**

```sql
SELECT vendor_name FROM vendors WHERE vendor_state = 'CA';
```

**Correct:**

```sql
SELECT vendor_name FROM vendors WHERE vendor_state = 'CA';
```

**Why this happens:** Ensure that the condition in the WHERE clause is correctly formatted. SQL is case-sensitive, so make sure keywords and column names match exactly.

### Not ordering results

**Incorrect:**

```sql
SELECT vendor_name FROM vendors;
```

**Correct:**

```sql
SELECT vendor_name FROM vendors ORDER BY vendor_state;
```

**Why this happens:** Ordering your results can help you analyze data more effectively. Always consider sorting if the order of results matters.

---

## Practice

**Question:** Write a SELECT statement to retrieve the names and email addresses of all customers from the 'customers' table who are located in New York City.

**Solution:** SELECT customer_name, email FROM customers WHERE city = 'New York';
This query will return the names and emails of all customers living in New York City.

---

*Source: Murach's MySQL 3rd Edition*