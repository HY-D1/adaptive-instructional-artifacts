# Integrity Constraints

## Definition

Integrity Constraints are rules that ensure data remains accurate, complete, and consistent within a database.

## Explanation

Integrity constraints are crucial for maintaining the reliability and accuracy of your database. They prevent incorrect or harmful data from being entered into your tables. There are several types of integrity constraints, including primary keys, foreign keys, not null constraints, unique constraints, and check constraints. Each type serves a specific purpose in ensuring that your data is valid and consistent.

## Examples

### Creating a Table with Integrity Constraints

```sql
CREATE TABLE Students ( StudentID INT PRIMARY KEY, FirstName VARCHAR(50) NOT NULL, LastName VARCHAR(50) NOT NULL, Email VARCHAR(100) UNIQUE );
```

This example creates a table named 'Students' with primary key, not null, and unique constraints. The StudentID column is the primary key, ensuring each student has a unique identifier. The FirstName and LastName columns cannot be null, and the Email column must contain unique values.

### Inserting Data into a Table with Constraints

```sql
INSERT INTO Students (StudentID, FirstName, LastName, Email) VALUES (1, 'John', 'Doe', 'john.doe@example.com');
```

This example inserts data into the 'Students' table. It demonstrates how constraints are enforced during data insertion. If any constraint is violated, the insert operation will fail.

## Common Mistakes

### Forgetting to define a primary key

**Incorrect:**

```sql
CREATE TABLE Students ( FirstName VARCHAR(50), LastName VARCHAR(50) );
```

**Correct:**

```sql
CREATE TABLE Students ( StudentID INT PRIMARY KEY, FirstName VARCHAR(50), LastName VARCHAR(50) );
```

**Why this happens:** Not defining a primary key can lead to duplicate rows and make it difficult to uniquely identify records. Always ensure each table has a primary key.

### Using an incorrect data type for a column

**Incorrect:**

```sql
CREATE TABLE Students ( StudentID INT, Age CHAR(2) );
```

**Correct:**

```sql
CREATE TABLE Students ( StudentID INT, Age INT );
```

**Why this happens:** Using the wrong data type can lead to errors and inconsistencies. For example, using a CHAR for an age column will not allow numeric operations.

---

## Practice

**Question:** Create a table named 'Orders' with columns for OrderID (primary key), CustomerID (foreign key referencing Customers.CustomerID), ProductName, Quantity, and Price. Ensure that the Quantity cannot be null and must be greater than zero.

**Solution:** CREATE TABLE Orders (
  OrderID INT PRIMARY KEY,
  CustomerID INT,
  ProductName VARCHAR(100),
  Quantity INT NOT NULL CHECK (Quantity > 0),
  Price DECIMAL(10,2)
);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*