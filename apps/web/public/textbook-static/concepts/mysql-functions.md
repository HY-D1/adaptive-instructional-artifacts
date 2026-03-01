# SQL Functions

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 20 minutes

## Learning Objectives

- Use string functions like CONCAT, SUBSTRING, and LENGTH to manipulate text data
- Apply date functions to work with timestamps
- Use numeric functions like ROUND, FLOOR, and CEIL for calculations
- Combine multiple functions in a single query

## What is This?

SQL functions are built-in tools that perform operations on data directly within your queries to transform, format, or calculate values.

They allow you to manipulate data without needing application code, operating directly on column values during query execution. Functions are categorized into **string functions** (like CONCAT, SUBSTRING for text manipulation), **numeric functions** (like ROUND, FLOOR for calculations), **date/time functions** (for formatting and extracting date parts), and **aggregate functions** (like AVG, SUM for summarizing multiple rows). You use functions when formatting data for display (such as formatting dates or currency), extracting portions of data (like getting first names from full names), calculating derived values (like rounding numbers or computing averages), or cleaning and standardizing data (converting to uppercase, trimming spaces). 

**Note:** Different databases have different function names. This guide uses **SQLite-compatible syntax** (used by sql.js in this learning environment). MySQL, PostgreSQL, and SQL Server have similar but sometimes differently-named functions.

## Examples

### Example 1: CONCAT - Combining Text

**Difficulty:** Beginner

**Scenario:** You want to display a user's full name by combining their name and email in a friendly format.

```sql
SELECT name || ' (' || email || ')' AS user_info
FROM users;
```

**Explanation:** The `||` operator joins strings together in SQLite. Here we combine the user's name with their email in parentheses. In MySQL, you'd use `CONCAT(name, ' (', email, ')')` instead.

---

### Example 2: Formatting Dates with strftime

**Difficulty:** Intermediate

**Scenario:** You need to extract parts of dates or format them for display.

```sql
SELECT 
    order_id,
    order_date,
    strftime('%Y-%m-%d', order_date) AS formatted_date,
    strftime('%m', order_date) AS month_only,
    strftime('%Y', order_date) AS year_only
FROM orders;
```

**Explanation:** SQLite uses `strftime()` for date formatting (MySQL uses `DATE_FORMAT()`). Common format codes:
- `%Y` = 4-digit year (2024)
- `%m` = month 01-12
- `%d` = day 01-31
- `%H` = hour 00-23
- `%M` = minute 00-59

---

### Example 3: ROUND and Calculations

**Difficulty:** Intermediate

**Scenario:** You want to calculate the average order value, rounded to 2 decimal places for currency display.

```sql
SELECT 
    ROUND(AVG(total_amount), 2) AS avg_order_value,
    COUNT(*) AS total_orders,
    ROUND(SUM(total_amount), 2) AS total_revenue
FROM orders;
```

**Explanation:** The `ROUND()` function takes a number and the number of decimal places. Here we use it with `AVG()` and `SUM()` to ensure currency values display properly (e.g., $123.45 instead of $123.456789). The second argument `2` specifies rounding to 2 decimal places.

---

### Example 4: String Functions - SUBSTR and UPPER/LOWER

**Difficulty:** Intermediate

**Scenario:** Create a formatted display that extracts the first initial and formats names consistently.

```sql
SELECT 
    name,
    UPPER(SUBSTR(name, 1, 1)) || LOWER(SUBSTR(name, 2)) AS formatted_name,
    SUBSTR(email, 1, INSTR(email, '@') - 1) AS username,
    LENGTH(name) AS name_length
FROM users;
```

**Explanation:** This query demonstrates string manipulation:
- `SUBSTR(name, 1, 1)` extracts the first character
- `UPPER()` converts to uppercase
- `SUBSTR(name, 2)` gets everything from position 2 onward
- `LOWER()` converts to lowercase
- `INSTR()` finds the position of a character (@)
- `LENGTH()` counts characters

This creates properly capitalized names like "Alice" from any case input.

---

### Example 5: Nested Functions - Complex Formatting

**Difficulty:** Advanced

**Scenario:** Create a shipping label format with order details and formatted price.

```sql
SELECT 
    o.id AS order_id,
    UPPER(SUBSTR(u.name, 1, 1)) || LOWER(SUBSTR(u.name, 2)) 
        || ' - Order #' || o.id
        || ' ($' || ROUND(o.total_amount, 2) || ')' AS shipping_label
FROM orders o
JOIN users u ON o.user_id = u.id;
```

**Explanation:** This query chains multiple functions:
1. Extract and uppercase the first letter
2. Extract and lowercase the rest of the name
3. Concatenate with order ID and formatted amount
4. Creates labels like "Alice - Order #42 ($150.00)"

## Common Mistakes

### Mistake 1: Using Database-Specific Functions

**Incorrect (MySQL syntax in SQLite):**
```sql
-- MySQL DATE_FORMAT doesn't work in SQLite
SELECT DATE_FORMAT(order_date, '%Y-%m-%d') FROM orders;
```

**Error Message:** `Error: no such function: DATE_FORMAT`

**Why it happens:** Different databases use different function names. MySQL has `DATE_FORMAT()`, SQLite has `strftime()`, PostgreSQL has `TO_CHAR()`, and SQL Server has `FORMAT()`.

**Corrected (SQLite):**
```sql
-- SQLite uses strftime instead
SELECT strftime('%Y-%m-%d', order_date) FROM orders;
```

**Quick Reference:**
| Task | SQLite | MySQL | PostgreSQL |
|------|--------|-------|------------|
| Format date | `strftime('%Y-%m-%d', date)` | `DATE_FORMAT(date, '%Y-%m-%d')` | `TO_CHAR(date, 'YYYY-MM-DD')` |
| Concatenate | `||` or `CONCAT()` | `CONCAT()` | `||` or `CONCAT()` |
| Substring | `SUBSTR(str, start, len)` | `SUBSTRING(str, start, len)` | `SUBSTRING(str FROM start FOR len)` |

💡 **Key Takeaway:** Check which database you're using. When learning, focus on the concepts (formatting dates, concatenating strings) rather than memorizing exact function names.

---

### Mistake 2: Forgetting Function Parentheses

**Incorrect:**
```sql
SELECT UPPER name FROM users;
```

**Error Message:** `Error: near 'name': syntax error`

**Why it happens:** Function calls always require parentheses `()` even if there are no arguments. The SQL parser sees `UPPER` as a column name and gets confused.

**Corrected:**
```sql
SELECT UPPER(name) FROM users;
```

💡 **Key Takeaway:** Always include parentheses when calling functions, and put column names inside them.

---

### Mistake 3: Using Aggregate and Non-Aggregate Functions Together Incorrectly

**Incorrect:**
```sql
SELECT 
    name, 
    ROUND(AVG(total_amount), 2) 
FROM users 
JOIN orders ON users.id = orders.user_id;
```

**Error Message:** `Error: misuse of aggregate: AVG()`

**Why it happens:** When using aggregate functions like `AVG()`, `SUM()`, or `COUNT()`, all non-aggregated columns in the SELECT list must appear in a GROUP BY clause. The query tries to show individual names with an average that spans all rows.

**Corrected:**
```sql
SELECT 
    name, 
    ROUND(AVG(total_amount), 2) AS avg_spent 
FROM users 
JOIN orders ON users.id = orders.user_id
GROUP BY users.id, name;
```

💡 **Key Takeaway:** When mixing aggregate functions (AVG, SUM, COUNT, etc.) with regular columns, always include a GROUP BY clause that lists all non-aggregated columns.

---

### Mistake 4: Expecting Functions to Modify Stored Data

**Incorrect Understanding:**
```sql
-- This doesn't actually change the stored data!
SELECT UPPER(name) FROM users;

-- The table still has the original case
SELECT name FROM users;  -- Still shows "alice", not "ALICE"
```

**Why it happens:** Functions in SELECT only affect the displayed output, not the underlying data. To permanently change data, use UPDATE.

**Corrected:**
```sql
-- To actually change the stored data:
UPDATE users SET name = UPPER(name);

-- Now the table stores uppercase names
```

💡 **Key Takeaway:** Functions in SELECT are for display only. Use UPDATE with functions to permanently modify stored data.

---

*Content generated for SQL-Adapt Learning Platform*
