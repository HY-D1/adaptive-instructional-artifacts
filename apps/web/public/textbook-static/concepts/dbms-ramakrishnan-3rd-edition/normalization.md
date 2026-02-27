# Database Normalization

## Definition

Database normalization is a process of organizing data to eliminate redundancy and improve data integrity. It involves decomposing tables into smaller, more manageable parts by removing duplicate columns and ensuring that each column contains atomic values.

## Explanation

Normalization solves the problem of data redundancy and inconsistency. When data is normalized, it becomes easier to manage and update. Here’s how it works step-by-step:
1. **First Normal Form (1NF)**: Ensure each table has a primary key and all columns contain atomic values.
2. **Second Normal Form (2NF)**: Eliminate partial dependencies by ensuring that non-key columns are fully dependent on the primary key.
3. **Third Normal Form (3NF)**: Remove transitive dependencies to ensure that only relevant data is stored in each table.
Normalization is crucial because it helps prevent common issues like data anomalies and ensures that data remains consistent across different parts of a database.

## Examples

### Basic Usage

```sql
-- CREATE a TABLE with redundant data CREATE TABLE Employee ( ID INT, Name VARCHAR(50), Department VARCHAR(50), ManagerID INT, DepartmentManagerID INT ); -- Normalize the TABLE by removing redundancy CREATE TABLE Employee ( ID INT PRIMARY KEY, Name VARCHAR(50) ); CREATE TABLE Department ( ID INT PRIMARY KEY, Name VARCHAR(50), ManagerID INT ); CREATE TABLE Manager ( ID INT PRIMARY KEY, Name VARCHAR(50) );
```

This example shows how a table with redundant data is normalized into three separate tables, each with its own primary key and relevant columns.

### Practical Example

```sql
-- INSERT data into the normalized tables INSERT INTO Employee (ID, Name) VALUES (1, 'John Doe'); INSERT INTO Department (ID, Name, ManagerID) VALUES (1, 'Engineering', 2); INSERT INTO Manager (ID, Name) VALUES (2, 'Jane Smith');
```

This practical example demonstrates inserting data into the normalized tables and how it helps in maintaining data integrity and reducing redundancy.

## Common Mistakes

### Not identifying all dependencies correctly

**Incorrect:**

```sql
-- Incorrectly assuming no transitive dependency CREATE TABLE Employee ( ID INT, Name VARCHAR(50), DepartmentID INT, ManagerID INT, DepartmentManagerID INT );
```

**Correct:**

```sql
-- Correctly identifying AND removing transitive dependencies CREATE TABLE Employee ( ID INT PRIMARY KEY, Name VARCHAR(50) ); CREATE TABLE Department ( ID INT PRIMARY KEY, Name VARCHAR(50), ManagerID INT ); CREATE TABLE Manager ( ID INT PRIMARY KEY, Name VARCHAR(50) );
```

**Why this happens:** This mistake occurs when not all dependencies are identified, leading to data anomalies. Correcting it involves ensuring that only relevant data is stored in each table.

---

## Practice

**Question:** Normalize the following table into 3NF:
CREATE TABLE Employee (
    ID INT,
    Name VARCHAR(50),
    DepartmentID INT,
    ManagerID INT,
    DepartmentManagerID INT
);

**Solution:** -- Normalize the table by removing redundancy
CREATE TABLE Employee (
    ID INT PRIMARY KEY,
    Name VARCHAR(50)
);
CREATE TABLE Department (
    ID INT PRIMARY KEY,
    Name VARCHAR(50),
    ManagerID INT
);
CREATE TABLE Manager (
    ID INT PRIMARY KEY,
    Name VARCHAR(50)
);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*