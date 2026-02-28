# Date and Time Functions

## Definition

Date and Time Functions are built-in SQL functions that allow you to manipulate and extract information from date and time data types.

## Explanation

These functions are essential for performing operations on dates and times in your database. They help you filter, sort, and analyze data based on specific time-related criteria. For example, you might want to find all records from a particular month or year, calculate the age of users, or determine if an event has passed. By using date and time functions, you can make your queries more powerful and flexible.

## Examples

### Extracting Year from a Date

```sql
SELECT EXTRACT(YEAR FROM order_date) AS year FROM orders;
```

This example demonstrates how to extract the year from an 'order_date' column in the 'orders' table. The result will be a list of years.

### Adding Days to a Date

```sql
SELECT DATE_ADD(order_date, INTERVAL 7 DAY) AS next_week FROM orders;
```

This example shows how to add 7 days to each 'order_date' in the 'orders' table. The result will be a list of dates one week after each original order date.

## Common Mistakes

### Using incorrect function names

**Incorrect:**

```sql
SELECT EXTRACT(YEAR FROM order_date) AS year FROM orders;
```

**Correct:**

```sql
SELECT YEAR(order_date) AS year FROM orders;
```

**Why this happens:** The correct function name is 'YEAR', not 'EXTRACT' with the argument 'YEAR'. Always refer to the SQL documentation for the right function names.

---

## Practice

**Question:** Write a query that selects all records from the 'employees' table where the employee's hire date was in the year 2015.

**Solution:** SELECT * FROM employees WHERE YEAR(hire_date) = 2015;

---

*Source: Murach's MySQL 3rd Edition*