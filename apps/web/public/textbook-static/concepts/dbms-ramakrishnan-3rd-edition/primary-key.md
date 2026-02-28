# Primary Key Constraint

## Definition

A primary key constraint is a database rule that uniquely identifies each record in a table. It ensures data integrity and allows for efficient querying.

## Explanation

Primary keys are crucial because they help maintain the accuracy of your data by ensuring no duplicate records exist. They also speed up data retrieval operations, as databases can quickly locate a specific record using its primary key. When you define a column or set of columns as a primary key, you're telling the database that these values must be unique and not null.

## Examples

### Basic Usage

```sql
CREATE TABLE Students ( StudentID INT PRIMARY KEY, FirstName VARCHAR(50), LastName VARCHAR(50) );
```

This example creates a table named 'Students' with a primary key column 'StudentID'. Each student must have a unique ID, and this ID cannot be null.

### Practical Example

```sql
CREATE TABLE Orders ( OrderID INT PRIMARY KEY, CustomerID INT, OrderDate DATE );
```

This practical example creates an 'Orders' table with a primary key column 'OrderID'. Each order must have a unique ID, and this ID cannot be null. This ensures that each order can be uniquely identified in the database.

## Common Mistakes

### Using a non-unique value as a primary key

**Incorrect:**

```sql
CREATE TABLE Invalid ( ID INT PRIMARY KEY, Name VARCHAR(50) ); -- Inserting duplicate IDs is allowed;
```

**Correct:**

```sql
CREATE TABLE Valid ( ID INT PRIMARY KEY, Name VARCHAR(50) ); -- Inserting duplicate IDs will cause an error;
```

**Why this happens:** Primary keys must be unique. If you try to insert a duplicate value, the database will throw an error.

### Forgetting to set a primary key

**Incorrect:**

```sql
CREATE TABLE MissingPK ( Name VARCHAR(50), Age INT ); -- No primary key defined;
```

**Correct:**

```sql
CREATE TABLE CorrectPK ( ID INT PRIMARY KEY, Name VARCHAR(50), Age INT ); -- Primary key set to 'ID';
```

**Why this happens:** Primary keys are essential for data integrity. If you don't define a primary key, the database won't enforce uniqueness and may allow duplicate records.

---

## Practice

**Question:** Create a table named 'Books' with columns 'ISBN', 'Title', 'Author', and 'Price'. Set 'ISBN' as the primary key.

**Solution:** CREATE TABLE Books (
  ISBN VARCHAR(13) PRIMARY KEY,
  Title VARCHAR(255),
  Author VARCHAR(100),
  Price DECIMAL(10, 2)
);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*