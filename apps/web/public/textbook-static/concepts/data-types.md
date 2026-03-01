# SQL Data Types

🟢 **Difficulty:** Beginner  
⏱️ **Estimated Time:** 15 minutes

## Learning Objectives

- Understand common SQL data types: INTEGER, TEXT, REAL
- Know when to use each data type for different kinds of data
- Learn how data types affect queries and calculations

## What is This?

**Data types** define what kind of data can be stored in each column of a table.

Choosing the right data type ensures data integrity, saves storage space, and enables proper sorting and calculations. Data types are defined when creating tables, but you need to understand them whenever you're writing queries that involve comparisons, calculations, or filtering. Using the wrong type can cause errors (trying to do math on text) or unexpected results.

## Examples

### Example 1: Understanding INTEGER for Whole Numbers

**Difficulty:** Beginner

**Scenario:** Get the total count of users by counting their IDs.

```sql
SELECT COUNT(id) AS user_count FROM users;
```

**Explanation:** **INTEGER** stores whole numbers like IDs, ages, and counts. You can perform arithmetic on INTEGER columns: addition, subtraction, multiplication, division, and comparisons work as expected.

### Example 2: Understanding TEXT for Strings

**Difficulty:** Beginner

**Scenario:** Find all users whose email domain is 'email.com'.

```sql
SELECT name, email
FROM users
WHERE email LIKE '%@email.com';
```

**Explanation:** **TEXT** stores variable-length character strings like names, emails, and cities. Text values must be enclosed in **single quotes**. You can use pattern matching with LIKE, but you cannot perform arithmetic operations on TEXT.

### Example 3: Understanding REAL for Decimals

**Difficulty:** Intermediate

**Scenario:** Calculate the average order amount.

```sql
SELECT AVG(amount) AS average_order_value
FROM orders;
```

**Explanation:** **REAL** stores floating-point decimal numbers like prices and amounts. It supports precise arithmetic operations. When doing calculations with money or measurements, use REAL instead of INTEGER to preserve decimal precision.

## Common Mistakes

### Mistake 1: Trying to do Math on TEXT Columns

**Incorrect:**
```sql
SELECT name, email + 5 FROM users;
```

**Error Message:** `Error: non-numeric value in mathematical operation`

**Why it happens:** You cannot perform arithmetic operations on TEXT strings. The database doesn't know how to "add 5" to an email address.

**Corrected:**
```sql
SELECT name, age + 5 AS age_in_5_years FROM users;
```

💡 **Key Takeaway:** Only numeric data types (INTEGER, REAL) support arithmetic operations. Keep text in TEXT columns and numbers in numeric columns.

### Mistake 2: Comparing TEXT Values as Numbers

**Incorrect:**
```sql
SELECT * FROM users WHERE age > '25';
```

**Error Message:** `No error, but may return unexpected results`

**Why it happens:** Comparing a number to a text string can cause strange results due to type coercion. In some databases, '100' would be considered less than '25' because text comparison is alphabetical ('1' comes before '2').

**Corrected:**
```sql
SELECT * FROM users WHERE age > 25;
```

💡 **Key Takeaway:** Compare numbers to numbers and text to text. Don't put quotes around numeric values in comparisons.

---

## Practice Challenge

**Select all products with a price greater than 100, and display the price increased by 10% (price * 1.1).**

💡 **Hint:** Use a REAL column (price) for the comparison and calculation. Remember not to use quotes for the numeric comparison.

<details>
<summary>Click to see solution</summary>

```sql
SELECT name, price, price * 1.1 AS increased_price
FROM products
WHERE price > 100;
```

**Explanation:** This query filters products where the REAL price column is greater than 100 (no quotes), then calculates 110% of the price for the result.
</details>

---

*Content generated for SQL-Adapt Learning Platform*
