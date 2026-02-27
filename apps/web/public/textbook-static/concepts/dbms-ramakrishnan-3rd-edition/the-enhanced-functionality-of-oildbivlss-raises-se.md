# 
The enhanced functionality of OIlDBIvlSs raises several irnp1ernentation chal-

## Definition

In object-relational databases (ORDBMSs), storage and access methods are crucial for efficiently handling large ADT (Abstract Data Type) and structured objects. This ensures that data is stored and accessed quickly, even when it's large or changes over time.

## Explanation

When working with ORDBMSs, we need to think about how to store and access our data effectively. Large ADT and structured objects can be challenging because they take up a lot of space on disk and may change size over time. To solve this, ORDBMSs use special storage and indexing techniques.

For example, consider the 'stars' attribute in a film database. As more actors become famous, their names might need to be added to old films. This requires efficient ways to store and access large attributes that can grow dynamically.

To handle this, ORDBMSs use disk-based pointers to link tuples (rows) with their corresponding objects. They also use flexible disk layout mechanisms to accommodate varying object sizes.

## Examples

### Basic Usage

```sql
-- Create a table with an ADT column
CREATE TABLE films (
    id INT PRIMARY KEY,
    title VARCHAR(100),
    stars BLOB
);
```

This example shows how to create a table that can store large binary objects (BLOBs) in the 'stars' column.

### Practical Example

```sql
-- Insert data into the films table with a large attribute
INSERT INTO films (id, title, stars)
VALUES (1, 'All About Eve', 'Marilyn Monroe, Bette Davis');
-- Query to access the large attribute
SELECT stars FROM films WHERE id = 1;
```

This practical example demonstrates inserting data with a large attribute and querying it efficiently.

## Common Mistakes

### Forgetting to use disk-based pointers for large objects

**Incorrect:**

```sql
-- Incorrectly storing large object in the same tuple
INSERT INTO films (id, title, stars)
VALUES (1, 'All About Eve', 'Marilyn Monroe, Bette Davis');
```

**Correct:**

```sql
-- Correctly using disk-based pointers
CREATE TABLE film_stars (
    film_id INT,
    star_name VARCHAR(100),
    PRIMARY KEY (film_id, star_name)
);
INSERT INTO films (id, title)
VALUES (1, 'All About Eve');
INSERT INTO film_stars (film_id, star_name)
VALUES (1, 'Marilyn Monroe'), (1, 'Bette Davis');
```

**Why this happens:** This mistake happens when students don't understand the need for separate storage locations for large objects. The correct approach is to use disk-based pointers and a separate table to store the large attribute.

---

## Practice

**Question:** How would you design a database schema for a library system that needs to store information about books, authors, and their publications? Consider how to handle large text fields like book descriptions.

**Solution:** Create tables for 'books', 'authors', and 'publications'. Use BLOBs or TEXT types for large text fields like book descriptions. Implement foreign keys to link related tables efficiently.


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*