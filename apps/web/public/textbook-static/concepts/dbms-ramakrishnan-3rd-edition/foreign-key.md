# Foreign Key Constraint

## Definition

A foreign key constraint is a rule that enforces referential integrity between two tables in a database. It ensures that all values in a column (or set of columns) of one table match the values in another table's primary key or unique column.

## Explanation

Foreign key constraints are crucial for maintaining data consistency and ensuring that relationships between tables are correctly maintained. Here’s how they work step-by-step:
1. **Declaration**: You define a foreign key constraint on a column (or set of columns) in one table, specifying which column(s) in another table it should reference.
2. **Enforcement**: The database system enforces this constraint to ensure that only valid values are inserted or updated in the foreign key column. If an attempt is made to insert a value that does not exist in the referenced table's primary key, the operation will fail.
3. **Usage**: Foreign keys are used when you have a one-to-many relationship between two tables. For example, if you have a 'Students' table and a 'Grades' table, each grade record would reference the student ID from the Students table.

## Examples

### Basic Usage

```sql
-- CREATE a foreign key constraint ALTER TABLE Grades ADD CONSTRAINT fk_student FOREIGN KEY (student_id) REFERENCES Students(student_id);
```

This example shows how to add a foreign key constraint to the 'Grades' table, ensuring that each grade record has a valid student ID that exists in the 'Students' table.

### Practical Example

```sql
-- INSERT data with a foreign key INSERT INTO Grades (student_id, subject, grade) VALUES (101, 'Math', 95);
```

This practical example demonstrates inserting a new grade record into the 'Grades' table. The student ID must exist in the 'Students' table for this operation to succeed.

## Common Mistakes

### Using an invalid foreign key value

**Incorrect:**

```sql
-- Attempting to INSERT an invalid foreign key INSERT INTO Grades (student_id, subject, grade) VALUES (999, 'Math', 85); -- This student ID does NOT exist in the Students TABLE;
```

**Correct:**

```sql
-- Correct way to INSERT a valid foreign key INSERT INTO Grades (student_id, subject, grade) VALUES (101, 'Math', 85); -- Assuming 101 is a valid student ID;
```

**Why this happens:** A common mistake is trying to insert data with a foreign key value that does not exist in the referenced table. Always ensure the foreign key value exists before inserting or updating.

---

## Practice

**Question:** Create a practical question that tests understanding of this concept

**Solution:** Provide a clear solution with explanation


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*