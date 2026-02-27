# Stored Functions

## Definition

A stored function is a precompiled block of SQL code that performs a specific task and returns a single value. It allows you to encapsulate complex logic and reuse it throughout your database applications.

## Explanation

Stored functions are incredibly useful for performing calculations, data transformations, or any repetitive tasks within the database itself. They help in reducing network traffic by moving computation from the application layer to the database layer. Here’s how they work:

1. **Creating a Stored Function**: You define a stored function using the `CREATE FUNCTION` statement. This involves specifying the function name, parameters (if any), and the SQL code that performs the task.
2. **Calling a Stored Function**: Once created, you can call this function like any other SQL expression within your queries or procedures.
3. **Benefits of Using Functions**: They improve performance by reducing the need to execute complex logic multiple times. They also enhance security by keeping sensitive business logic on the database server.

## Examples

### Basic Usage

```sql
-- CREATE a function to calculate the total price including tax CREATE FUNCTION CalculateTotal(price DECIMAL(10,2), tax_rate DECIMAL(5,2)) RETURNS DECIMAL(10,2) DETERMINISTIC BEGIN DECLARE total DECIMAL(10,2); SET total = price * (1 + tax_rate / 100); RETURN total; END;
```

This example shows how to create a function that calculates the total price including tax. The function takes two parameters: `price` and `tax_rate`, and returns the calculated total.

### Practical Example

```sql
-- Use the function in a query
SELECT product_name, CalculateTotal(price, 10) AS total_price FROM products;
```

This practical example demonstrates how to use the `CalculateTotal` function in a SQL query to get the total price including tax for each product.

## Common Mistakes

### Forgetting to declare the return type

**Incorrect:**

```sql
-- Incorrect: Missing RETURN TYPE CREATE FUNCTION CalculateTotal(price DECIMAL(10,2), tax_rate DECIMAL(5,2)) BEGIN DECLARE total DECIMAL(10,2); SET total = price * (1 + tax_rate / 100); END;
```

**Correct:**

```sql
-- Correct: Declared RETURN TYPE CREATE FUNCTION CalculateTotal(price DECIMAL(10,2), tax_rate DECIMAL(5,2)) RETURNS DECIMAL(10,2) BEGIN DECLARE total DECIMAL(10,2); SET total = price * (1 + tax_rate / 100); RETURN total; END;
```

**Why this happens:** The function must declare its return type using the `RETURNS` keyword. Missing this will cause a syntax error.

---

## Practice

**Question:** Create a stored function that calculates the average salary for each department in the `employees` table.

**Solution:** -- Solution
CREATE FUNCTION AverageSalaryByDepartment(department_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
  DECLARE avg_salary DECIMAL(10,2);
  SELECT AVG(salary) INTO avg_salary FROM employees WHERE department_id = department_id;
  RETURN avg_salary;
END;

---

*Source: Murach's MySQL 3rd Edition*