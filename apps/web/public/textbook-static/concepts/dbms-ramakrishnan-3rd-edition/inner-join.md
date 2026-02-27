# INNER JOIN

## Definition

An INNER JOIN is a type of join operation that combines rows from two tables based on a related column between them, returning only the rows where there is a match.

## Explanation

INNER JOINs are used when you want to retrieve data from two or more tables based on a common attribute. Imagine you have two tables: one for 'Customers' and another for 'Orders'. You can use an INNER JOIN to find out which orders belong to each customer. The join condition is typically specified using the ON keyword, followed by the column names that match in both tables.

## Examples

### Basic Usage

```sql
SELECT Customers.CustomerName, Orders.OrderID
FROM Customers
INNER JOIN Orders ON Customers.CustomerID = Orders.CustomerID;
```

This example retrieves the customer name and order ID for each order made by a customer. Only rows where there is a match in both tables (i.e., a customer has placed an order) are returned.

### Practical Example

```sql
SELECT Employees.EmployeeName, Departments.DepartmentName
FROM Employees
INNER JOIN Departments ON Employees.DepartmentID = Departments.DepartmentID;
```

In a real-world scenario, this query would return the name of each employee along with the name of their department. This helps in understanding the organizational structure and who works where.

## Common Mistakes

### Forgetting to specify the join condition

**Incorrect:**

```sql
SELECT Employees.EmployeeName, Departments.DepartmentName
FROM Employees
INNER JOIN Departments;
```

**Correct:**

```sql
SELECT Employees.EmployeeName, Departments.DepartmentName
FROM Employees
INNER JOIN Departments ON Employees.DepartmentID = Departments.DepartmentID;
```

**Why this happens:** This mistake happens when you try to perform an INNER JOIN without specifying how the tables are related. Always include the ON keyword followed by the join condition.

---

## Practice

**Question:** Given two tables, 'Employees' and 'Departments', where 'Employees' has columns 'EmployeeID' and 'DepartmentID', and 'Departments' has columns 'DepartmentID' and 'DepartmentName', write an INNER JOIN query to retrieve the employee name and department name.

**Solution:** SELECT Employees.EmployeeName, Departments.DepartmentName
FROM Employees
INNER JOIN Departments ON Employees.DepartmentID = Departments.DepartmentID;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*