# Second Normal Form (2NF)

## Definition

Second Normal Form (2NF) is a database design principle that ensures data integrity by eliminating partial dependencies between columns and ensuring atomicity of each column.

## Explanation

In a relational database, Second Normal Form (2NF) helps prevent data redundancy and inconsistencies. It builds upon the First Normal Form (1NF), which eliminates repeating groups and atomic values. To achieve 2NF, a table must meet two conditions:

1. **Atomicity**: Each column in the table should contain indivisible data. There should be no partial dependencies between columns.

2. **Dependency on the whole key**: All non-key attributes (columns) must depend on the entire primary key of the table, not just a part of it.

For example, consider a table `Employees` with columns `EmployeeID`, `FirstName`, `LastName`, and `Department`. If we have a composite primary key `(EmployeeID, Department)`, then the column `Department` should depend on the entire primary key. If `Department` only depends on `EmployeeID` (partial dependency), this violates 2NF.

Using 2NF ensures that each piece of data is stored in a single place and reduces the risk of inconsistencies when updating or querying the database.

## Examples

### Basic Usage

```sql
-- CREATE a TABLE in 2NF CREATE TABLE Employees ( EmployeeID INT PRIMARY KEY, FirstName VARCHAR(50), LastName VARCHAR(50), Department VARCHAR(50) );
```

This example creates an `Employees` table with columns that meet the 2NF criteria. Each column is atomic, and all non-key attributes depend on the entire primary key.

### Practical Example

```sql
-- INSERT data into a 2NF TABLE INSERT INTO Employees (EmployeeID, FirstName, LastName, Department) VALUES (1, 'John', 'Doe', 'Sales'); -- Query data FROM a 2NF TABLE SELECT EmployeeID, FirstName, LastName, Department FROM Employees WHERE EmployeeID = 1;
```

This example demonstrates inserting and querying data in a `Employees` table that adheres to the 2NF principles. It ensures that each piece of data is stored correctly and can be retrieved efficiently.

## Common Mistakes

### Creating a composite primary key with partial dependency

**Incorrect:**

```sql
-- Incorrect example CREATE TABLE Employees ( EmployeeID INT, FirstName VARCHAR(50), LastName VARCHAR(50), Department VARCHAR(50), PRIMARY KEY (EmployeeID) );
```

**Correct:**

```sql
-- Correct example CREATE TABLE Employees ( EmployeeID INT, FirstName VARCHAR(50), LastName VARCHAR(50), Department VARCHAR(50), PRIMARY KEY (EmployeeID, Department) );
```

**Why this happens:** This mistake occurs when a composite primary key is created with partial dependency. The correct approach is to ensure that all non-key attributes depend on the entire primary key.

---

## Practice

**Question:** Design a table for storing `Orders` in 2NF. Each order has an `OrderID`, `CustomerID`, `ProductID`, and `Quantity`. Ensure atomicity and dependency on the whole key.

**Solution:** Create a table with columns `OrderID`, `CustomerID`, `ProductID`, and `Quantity`. The primary key should be `(OrderID, CustomerID)` to ensure that each order is uniquely identified and that dependencies are met.


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*