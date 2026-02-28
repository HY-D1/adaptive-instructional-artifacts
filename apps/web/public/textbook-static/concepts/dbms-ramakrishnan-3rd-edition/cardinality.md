# Cardinality Constraints

## Definition

Cardinality constraints are rules that define the number of relationships between entities in a database schema. They ensure data integrity and consistency by specifying how many instances of one entity can be associated with another.

## Explanation

In a relational database, cardinality constraints help maintain the accuracy and reliability of the data. These constraints specify the maximum and minimum number of related records that can exist between two tables. For example, in a university database, a student can enroll in multiple courses (many-to-many relationship), but each course can only have one instructor (one-to-one or one-to-many relationship). Understanding cardinality is crucial for designing efficient and effective databases.

## Examples

### Basic Usage

```sql
-- Define a TABLE with a one-to-many relationship CREATE TABLE Students ( sid INT PRIMARY KEY, name VARCHAR(100) ); CREATE TABLE Enrolled ( sid INT, cid INT, grade CHAR(2), PRIMARY KEY (sid, cid), FOREIGN KEY (sid) REFERENCES Students(sid) );
```

This example demonstrates how to define a one-to-many relationship between students and courses. Each student can be enrolled in multiple courses, but each course has only one student.

### Practical Example

```sql
-- Query to find all students enrolled in a specific course
SELECT s.sid, s.name
FROM Students s
JOIN Enrolled e ON s.sid = e.sid
WHERE e.cid = 'CS101';
```

This practical example shows how to use the one-to-many relationship to query data. It retrieves all students enrolled in a specific course.

## Common Mistakes

### Forgetting to define foreign keys for relationships.

**Incorrect:**

```sql
-- Incorrect: No foreign key defined CREATE TABLE Enrolled ( sid INT, cid INT, grade CHAR(2) );
```

**Correct:**

```sql
-- Correct: Foreign key defined CREATE TABLE Enrolled ( sid INT, cid INT, grade CHAR(2), PRIMARY KEY (sid, cid), FOREIGN KEY (sid) REFERENCES Students(sid) );
```

**Why this happens:** Defining foreign keys ensures referential integrity and helps maintain the accuracy of the database.

---

## Practice

**Question:** Design a database schema for a library system. Define tables for Books, Authors, and Borrowers with appropriate cardinality constraints.

**Solution:** -- Solution: Define tables with correct cardinality constraints
CREATE TABLE Authors (
  aid INT PRIMARY KEY,
  name VARCHAR(100)
);

CREATE TABLE Books (
  bid INT PRIMARY KEY,
  title VARCHAR(255),
  author_id INT,
  FOREIGN KEY (author_id) REFERENCES Authors(aid)
);

CREATE TABLE Borrowers (
  bid INT PRIMARY KEY,
  name VARCHAR(100)
);

CREATE TABLE Borrows (
  bid INT,
  book_id INT,
  borrower_id INT,
  borrow_date DATE,
  return_date DATE,
  PRIMARY KEY (bid, book_id),
  FOREIGN KEY (book_id) REFERENCES Books(bid),
  FOREIGN KEY (borrower_id) REFERENCES Borrowers(bid)
);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*