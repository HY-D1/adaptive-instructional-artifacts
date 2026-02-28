# String Functions

## Definition

String functions are built-in SQL commands used to manipulate and process character data within a database. They help in extracting specific parts of strings, converting their case, removing spaces, and more. Understanding string functions is crucial for data cleaning, formatting, and analysis.

## Explanation

String functions are essential tools in SQL that allow you to work with text data effectively. These functions can be used to perform various operations such as extracting substrings, replacing characters, converting case, trimming spaces, and more. By mastering string functions, you can enhance the quality of your data and make it easier to analyze and manipulate.

## Examples

### Basic Usage

```sql
-- Extract the first 5 characters FROM a string SELECT SUBSTRING(column_name, 1, 5) FROM table_name;
```

This example demonstrates how to use the `SUBSTRING` function to extract the first 5 characters from a column in a table.

### Practical Example

```sql
-- Convert all text in a column to uppercase
SELECT UPPER(column_name) FROM table_name;
```

This practical example shows how to use the `UPPER` function to convert all text in a specific column to uppercase.

## Common Mistakes

### Using incorrect function parameters

**Incorrect:**

```sql
-- Incorrect parameter usage
SELECT SUBSTRING(column_name, 10, -5) FROM table_name;
```

**Correct:**

```sql
-- Correct parameter usage
SELECT SUBSTRING(column_name, 10, 5) FROM table_name;
```

**Why this happens:** This mistake occurs when the parameters for a string function are incorrect. Always ensure that the start position and length are correctly specified.

---

## Practice

**Question:** Write a SQL query to extract the last name from a full name stored in a column named `full_name`.

**Solution:** -- Correct solution
SELECT SUBSTRING(full_name, CHARINDEX(' ', full_name) + 1) AS last_name FROM table_name;

---

*Source: Murach's MySQL 3rd Edition*