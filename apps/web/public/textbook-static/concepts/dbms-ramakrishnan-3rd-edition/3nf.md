# Third Normal Form (3NF)

## Definition

Third Normal Form (3NF) is a database design principle that ensures data is stored in a way that minimizes redundancy and dependency issues, making it easier to manage and query.

## Explanation

In databases, data can be organized into tables, and each table can have relationships with other tables. When designing these tables, we want to ensure that the data is as simple and straightforward as possible. This is where Third Normal Form comes in. A database is said to be in 3NF if it meets three conditions:
1. It is in First Normal Form (1NF), meaning each column contains atomic values and there are no repeating groups.
2. It is in Second Normal Form (2NF), meaning all non-key columns are fully dependent on the primary key.
3. It avoids partial dependencies, which means that if a table has a composite primary key, every non-key column must be dependent on the entire primary key, not just part of it.
By following these rules, we ensure that our database is organized in a way that makes it easier to understand and manage.

## Examples

### Basic Usage

```sql
-- CREATE a TABLE in 3NF CREATE TABLE Students ( StudentID INT PRIMARY KEY, FirstName VARCHAR(50), LastName VARCHAR(50) );
```

This example demonstrates creating a simple table for students with a primary key and two non-key columns. This structure avoids partial dependencies.

### Practical Example

```sql
-- INSERT data into the Students TABLE INSERT INTO Students (StudentID, FirstName, LastName) VALUES (1, 'John', 'Doe'); -- Query data FROM the Students TABLE SELECT * FROM Students;
```

This practical example shows inserting a record into the Students table and then querying it. This demonstrates how 3NF helps in managing data efficiently.

## Common Mistakes

### Creating tables with composite primary keys without ensuring full dependency

**Incorrect:**

```sql
-- Incorrect example of a composite primary key CREATE TABLE Students ( StudentID INT, CourseID INT, PRIMARY KEY (StudentID) );
```

**Correct:**

```sql
-- Correct example of a composite primary key CREATE TABLE Students ( StudentID INT, CourseID INT, PRIMARY KEY (StudentID, CourseID) );
```

**Why this happens:** This mistake occurs when a table has a composite primary key but only one part of the key is used in non-key columns. To avoid this, ensure that all non-key columns depend on the entire primary key.

---

## Practice

**Question:** Design a table for storing information about books in a library. Ensure it follows the rules of Third Normal Form.

**Solution:** CREATE TABLE Books (
    BookID INT PRIMARY KEY,
    Title VARCHAR(100),
    Author VARCHAR(50)
);
CREATE TABLE Library (
    LibraryID INT PRIMARY KEY,
    Address VARCHAR(200)
);
CREATE TABLE BookCopies (
    CopyID INT PRIMARY KEY,
    BookID INT,
    LibraryID INT,
    FOREIGN KEY (BookID) REFERENCES Books(BookID),
    FOREIGN KEY (LibraryID) REFERENCES Library(LibraryID)
);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*