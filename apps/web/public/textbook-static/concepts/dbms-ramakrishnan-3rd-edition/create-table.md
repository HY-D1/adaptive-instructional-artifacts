# CREATE TABLE

## Definition

A cursor is like a pointer that allows you to iterate through rows returned by a query one at a time, rather than retrieving all rows at once.

## Explanation

Cursors are essential when dealing with queries that return multiple rows because they allow you to process each row individually. This is particularly useful in applications where you need to perform operations on each row or display them one by one. Here’s how it works step-by-step:
1. **Declare a Cursor**: You define the cursor and specify the query that will be executed.
2. **Open the Cursor**: The cursor is opened, which executes the associated query and positions it before the first row of results.
3. **Fetch Rows**: Using the FETCH command, you can read each row into host language variables one by one.
4. **Close the Cursor**: Once all rows are processed, you close the cursor to free up resources.

## Examples

### Basic Usage

```sql
-- Declare a cursor
DECLARE sinfo CURSOR FOR SELECT S.sname, S.age FROM Sailors S WHERE S.rating > :c_minrating;
-- Open the cursor
OPEN sinfo;
-- Fetch rows into host variables
FETCH sinfo INTO :csname, :cage;
```

This example demonstrates how to declare a cursor for a query that returns multiple rows and fetch each row one by one.

### Practical Example

```sql
-- Real-world scenario: Fetching customer details FROM a database DECLARE custinfo CURSOR FOR SELECT C.cust_id, C.cust_name FROM Customers C WHERE C.balance > :c_minbalance; OPEN custinfo; FETCH custinfo INTO :cust_id, :cust_name;
```

This practical example shows how you might use a cursor in an application to fetch customer details based on a balance threshold.

## Common Mistakes

### Forgetting to open the cursor before fetching rows.

**Incorrect:**

```sql
-- Incorrect FETCH sinfo INTO :csname, :cage;
```

**Correct:**

```sql
-- Correct OPEN sinfo; FETCH sinfo INTO :csname, :cage;
```

**Why this happens:** Always remember to open the cursor with OPEN before attempting to fetch rows. Failing to do so will result in an error.

### Not checking SQLCODE or SQLSTATE after a FETCH.

**Incorrect:**

```sql
-- Incorrect FETCH sinfo INTO :csname, :cage;
```

**Correct:**

```sql
-- Correct FETCH sinfo INTO :csname, :cage; IF SQLCODE = 0 THEN -- Continue processing rows END IF;
```

**Why this happens:** It's crucial to check if there are more rows after each fetch. Failing to do so can lead to infinite loops or accessing invalid data.

---

## Practice

**Question:** Write a SQL script that declares a cursor, opens it, and fetches all rows from the Employees table where the department_id is greater than 50.

**Solution:** -- Solution
DECLARE deptinfo CURSOR FOR SELECT emp_id, emp_name FROM Employees WHERE department_id > :c_deptid;
OPEN deptinfo;
FETCH deptinfo INTO :emp_id, :emp_name;
WHILE SQLCODE = 0 DO -- Process each row here
FETCH deptinfo INTO :emp_id, :emp_name;
END WHILE;
CLOSE deptinfo;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*