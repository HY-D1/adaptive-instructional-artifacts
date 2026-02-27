# Database Indexes

## Definition

A database index is like a table of contents for your data, allowing you to quickly find specific records without scanning every row.

## Explanation

Imagine you have a library full of books. Without an index (like the card catalog), you'd have to read every book cover to find the one you want. An index helps you jump directly to the section where your book is located, saving time and effort. In databases, indexes work similarly by allowing quick access to data based on certain columns.

## Examples

### Basic Usage

```sql
CREATE INDEX idx_lastname ON employees(last_name);
```

This example creates an index named 'idx_lastname' on the 'last_name' column of the 'employees' table. This allows for faster searches based on last names.

### Practical Example

```sql
SELECT * FROM employees WHERE last_name = 'Smith';
```

With an index on 'last_name', this query will be much faster than without, as the database can quickly locate all records where the last name is 'Smith'.

## Common Mistakes

### Creating indexes on columns with high cardinality

**Incorrect:**

```sql
CREATE INDEX idx_full_name ON employees(first_name, last_name);
```

**Correct:**

```sql
CREATE INDEX idx_last_name ON employees(last_name);
```

**Why this happens:** Indexes should be created on columns that have low cardinality (i.e., few distinct values). Creating an index on 'first_name' and 'last_name' together might not be necessary if 'last_name' is already indexed.

---

## Practice

**Question:** Which of the following statements is true about database indexes?

**Solution:** An index improves search speed by allowing quick access to data based on certain columns. It should be created on columns with low cardinality, and it must balance between performance and storage.


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*