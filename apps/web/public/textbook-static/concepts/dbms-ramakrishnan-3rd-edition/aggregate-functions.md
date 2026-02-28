# Aggregate Functions

## Definition

Aggregate functions in SQL allow you to perform calculations on a set of values and return a single value. They are essential for summarizing data and extracting meaningful insights from large datasets.

## Explanation

Aggregate functions are used when you need to compute a single output from multiple rows of data. Common examples include SUM, COUNT, AVG, MAX, and MIN. These functions operate on a column of data and return a result based on the operation applied. For instance, SUM adds up all the values in a column, while COUNT returns the number of non-null entries.

## Examples

### Basic Usage

```sql
-- Calculate the total number of sailors
SELECT COUNT(*) FROM Sailors;
```

This example demonstrates how to use the COUNT function to find out how many rows are in the 'Sailors' table.

### Practical Example

```sql
-- Find the average rating of all sailors
SELECT AVG(rating) FROM Sailors;
```

This practical example shows how to use the AVG function to calculate the average value in a column, providing useful information about the dataset.

## Common Mistakes

### Forgetting parentheses around the column name

**Incorrect:**

```sql
-- Incorrect usage
SELECT SUM rating FROM Sailors;
```

**Correct:**

```sql
-- Correct usage
SELECT SUM(rating) FROM Sailors;
```

**Why this happens:** This mistake happens when students forget to put parentheses around the column name after the function. It results in a syntax error.

---

## Practice

**Question:** Write an SQL query that calculates the total number of boats with a color of 'red' from the 'Boats' table.

**Solution:** -- Correct solution
SELECT COUNT(*) FROM Boats WHERE color = 'red';
-- Explanation: This query counts all rows in the 'Boats' table where the 'color' column is equal to 'red'.


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*