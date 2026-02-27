# Aggregate Functions

## Definition
Aggregate functions like COUNT, SUM, AVG, MAX, and MIN compute summary values across multiple rows, returning a single result for a group of rows.

## Explanation
Aggregate functions perform calculations on a set of values and return a single value. They are commonly used with the GROUP BY clause to summarize data by categories.

Common aggregate functions:
- **COUNT(*)**: Counts all rows
- **COUNT(column)**: Counts non-NULL values in a column
- **SUM(column)**: Adds up all numeric values
- **AVG(column)**: Calculates the average of numeric values
- **MAX(column)**: Returns the highest value
- **MIN(column)**: Returns the lowest value

Aggregate functions ignore NULL values (except COUNT(*)). They collapse multiple rows into a single summary row, which is useful for reporting and analysis.

## Examples

### Example 1: Count All Rows
```sql
SELECT COUNT(*) FROM employees;
```
Returns the total number of employees in the table.

### Example 2: Count with Condition
```sql
SELECT COUNT(*) FROM employees WHERE department = 'Sales';
```
Returns the number of employees in the Sales department.

### Example 3: Sum of Values
```sql
SELECT SUM(salary) AS total_payroll FROM employees;
```
Returns the total salary paid to all employees.

### Example 4: Average Calculation
```sql
SELECT AVG(salary) AS average_salary FROM employees;
```
Returns the average salary across all employees.

### Example 5: Maximum and Minimum
```sql
SELECT MAX(salary) AS highest, MIN(salary) AS lowest FROM employees;
```
Returns the highest and lowest salaries in a single query.

### Example 6: Combine with GROUP BY
```sql
SELECT department, COUNT(*) AS emp_count, AVG(salary) AS avg_salary
FROM employees
GROUP BY department;
```
Returns a summary showing employee count and average salary for each department.

## Common Mistakes

### Mistake 1: Mixing Aggregate and Non-Aggregate Columns
**Incorrect:**
```sql
SELECT department, first_name, COUNT(*) FROM employees;
```

**Correct:**
```sql
SELECT department, COUNT(*) FROM employees GROUP BY department;
```

**Why this happens:** When using aggregate functions, any non-aggregated columns in the SELECT list must appear in the GROUP BY clause. The incorrect query tries to show individual first_names alongside a count, which doesn't make logical sense.

### Mistake 2: Using WHERE to Filter Aggregates
**Incorrect:**
```sql
SELECT department, COUNT(*) 
FROM employees 
WHERE COUNT(*) > 5 
GROUP BY department;
```

**Correct:**
```sql
SELECT department, COUNT(*) 
FROM employees 
GROUP BY department
HAVING COUNT(*) > 5;
```

**Why this happens:** WHERE filters rows BEFORE aggregation, but you can't use aggregate functions in WHERE. Use HAVING to filter groups AFTER aggregation has been performed.

### Mistake 3: NULL Handling Confusion
**Scenario:** Counting employees with phone numbers.

**Incorrect interpretation:**
```sql
SELECT COUNT(*) FROM employees WHERE phone IS NULL;
```
This counts employees WITHOUT phone numbers.

**Correct for counting with phone:**
```sql
SELECT COUNT(phone) FROM employees;
```
This counts employees WITH phone numbers (non-NULL values).

**Why this happens:** COUNT(column) only counts non-NULL values, while COUNT(*) counts all rows. Be mindful of NULL handling when using aggregate functions.
