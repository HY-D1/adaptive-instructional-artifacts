# WHERE Clause and Filtering

## Definition

The WHERE clause is used to filter records in a database table based on specified conditions. It helps in retrieving only those rows that meet certain criteria.

## Explanation

The WHERE clause is essential for filtering data efficiently. Imagine you have a large library with thousands of books, and you want to find all the books about science fiction. The WHERE clause allows you to specify this condition (genre = 'Science Fiction') so that only those books are returned. This makes your search more efficient and relevant.

## Examples

### Basic Usage

```sql
-- SELECT all students who are 18 years old SELECT name FROM Students WHERE age = 18;
```

This example shows how to use the WHERE clause to filter records where the age is exactly 18.

### Practical Example

```sql
-- Find all policies that cost more than $500
SELECT policyid, cost FROM Policies WHERE cost > 500;
```

This practical example demonstrates filtering records based on a numerical condition to find expensive policies.

## Common Mistakes

### Using the wrong operator

**Incorrect:**

```sql
-- Incorrectly using = instead of LIKE
SELECT name FROM Students WHERE name = 'John%';
```

**Correct:**

```sql
-- Correctly using LIKE for pattern matching
SELECT name FROM Students WHERE name LIKE 'John%';
```

**Why this happens:** This mistake occurs when the wrong operator is used. The correct operator should be LIKE for pattern matching.

---

## Practice

**Question:** Create a query to find all employees who have been with the company for more than 5 years, given that their hire date is stored in the 'hire_date' column.

**Solution:** -- Correct solution
SELECT name FROM Employees WHERE hire_date <= DATE_SUB(CURDATE(), INTERVAL 5 YEAR);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*