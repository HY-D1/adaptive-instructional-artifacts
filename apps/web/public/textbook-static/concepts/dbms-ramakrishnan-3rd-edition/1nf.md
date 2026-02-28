# First Normal Form (1NF)

## Definition

First Normal Form (1NF) is a database design principle that ensures each table has atomic columns and no repeating groups.

## Explanation

1NF is crucial for creating databases that are both efficient and easy to manage. It addresses two main issues: atomic columns and repeating groups.

**Atomic Columns**: Each column in a table should contain only one value, not multiple values or parts of a value. This ensures that each piece of data is independent and can be processed individually.

**No Repeating Groups**: A table should not have any repeating groups of rows. If you find yourself needing to repeat the same set of columns for multiple rows, it's likely time to normalize further.

1NF helps prevent data redundancy and inconsistencies, making it easier to maintain and query the database.

## Examples

### Basic Usage

```sql
-- CREATE a simple TABLE with atomic columns CREATE TABLE Employees ( EmployeeID INT, FirstName VARCHAR(50), LastName VARCHAR(50) );
```

This example shows how to create a table where each column contains only one value, adhering to the atomicity rule.

### Practical Example

```sql
-- INSERT data into the Employees TABLE INSERT INTO Employees (EmployeeID, FirstName, LastName) VALUES (1, 'John', 'Doe'); INSERT INTO Employees (EmployeeID, FirstName, LastName) VALUES (2, 'Jane', 'Smith');
```

This practical example demonstrates inserting data into a properly structured table that follows 1NF.

## Common Mistakes

### Creating tables with repeating groups

**Incorrect:**

```sql
-- Incorrect: Repeating group in a single row CREATE TABLE Employees ( EmployeeID INT, FirstName VARCHAR(50), LastName VARCHAR(50), DepartmentIDs INT[] );
```

**Correct:**

```sql
-- Correct: Separate tables for normalization CREATE TABLE Employees ( EmployeeID INT, FirstName VARCHAR(50), LastName VARCHAR(50) ); CREATE TABLE Departments ( DepartmentID INT, DepartmentName VARCHAR(50) ); CREATE TABLE EmployeeDepartments ( EmployeeID INT, DepartmentID INT );
```

**Why this happens:** This mistake occurs when trying to store multiple values in a single column, which violates the atomicity rule. The correct approach is to normalize the data by creating separate tables and using relationships between them.

---

## Practice

**Question:** Design a table for storing student information that adheres to 1NF. Include columns for student ID, name, age, and grade.

**Solution:** CREATE TABLE Students (
    StudentID INT,
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    Age INT,
    Grade VARCHAR(2)
);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*