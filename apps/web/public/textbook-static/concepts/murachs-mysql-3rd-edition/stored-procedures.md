# Stored Procedures

## Definition

A stored procedure is a precompiled sequence of SQL statements that are stored in the database and can be executed by name.

## Explanation

Stored procedures are essential for several reasons:
1. **Performance**: They reduce network traffic as they execute on the server side.
2. **Security**: They limit what users can do, enhancing security by restricting access to underlying data.
3. **Reusability**: Procedures can be called multiple times without rewriting code.
4. **Maintenance**: Changes made in a procedure affect all calls to it, simplifying updates.

## Examples

### Basic Usage

```sql
-- Create a simple stored procedure
CREATE PROCEDURE GetEmployeeDetails (@empID INT)
AS
BEGIN
SELECT * FROM Employees WHERE EmployeeID = @empID;
END;
```

This example demonstrates how to create a stored procedure that retrieves details of an employee based on their ID.

### Practical Example

```sql
-- Call the stored procedure EXEC GetEmployeeDetails 101;
```

This practical example shows how to execute the stored procedure created in the previous example.

## Common Mistakes

### Forgetting to declare parameters

**Incorrect:**

```sql
-- Incorrect: Missing parameter declaration
CREATE PROCEDURE GetEmployeeDetails
AS
BEGIN
SELECT * FROM Employees WHERE EmployeeID = @empID;
END;
```

**Correct:**

```sql
-- Correct: Declaring the parameter
CREATE PROCEDURE GetEmployeeDetails (@empID INT)
AS
BEGIN
SELECT * FROM Employees WHERE EmployeeID = @empID;
END;
```

**Why this happens:** This mistake occurs when creating a stored procedure without declaring parameters. Always ensure all necessary parameters are declared.

---

## Practice

**Question:** Create a stored procedure that updates the salary of an employee based on their ID.

**Solution:** -- Solution: Create and execute the stored procedure
CREATE PROCEDURE UpdateEmployeeSalary (@empID INT, @newSalary DECIMAL(10,2))
AS
BEGIN
UPDATE Employees SET Salary = @newSalary WHERE EmployeeID = @empID;
END;
-- Execute the procedure
EXEC UpdateEmployeeSalary 101, 5000.00;

---

*Source: Murach's MySQL 3rd Edition*