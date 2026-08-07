---
id: 3nf
title: Third Normal Form (3NF)
definition: Already in 2NF, and no non-key column depends on another non-key column
difficulty: intermediate
estimatedReadTime: 3
pageReferences: [335, 336, 337]
tags:
  - database-design
  - normalization
  - 3nf
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Third Normal Form (3NF)

## Definition
A table is in third normal form when it is already in second normal form and every non-key column depends only on the key, never on another non-key column.

## Explanation
Third normal form removes the last of the everyday redundancies, the transitive dependency. The name describes the chain: the key determines one column, and that column in turn determines another, so the second one is only indirectly tied to the key.

The employees table in the practice database shows the shape of the problem if a department name were stored alongside the department id. Each employee is identified by emp_id, emp_id determines dept_id, and dept_id determines the department name. The name therefore travels with the department, not with the employee, and storing it on every employee row repeats it once per person in that department.

The consequences are the familiar trio of anomalies. Renaming a department requires updating every employee who works there, and a partial update leaves two spellings in circulation. Deleting the last employee of a department erases the only record that the department existed. A newly created department cannot be recorded at all until somebody is hired into it, because there is no employee row to hold the name.

Moving the dependent column into a table keyed by what it truly depends on resolves all three at once, which is why the practice schema keeps departments separate and links to it by dept_id. Third normal form is the level most working schemas aim for: it removes the redundancy that causes real bugs, while stricter forms rarely repay the extra complexity.

## Examples
### A table with a transitive dependency
```sql
CREATE TABLE employees (
  emp_id INTEGER PRIMARY KEY,
  emp_name TEXT,
  dept_id INTEGER,
  dept_name TEXT
);
```
The department name depends on dept_id rather than on emp_id, so it repeats for every employee in the department.

### The same data in third normal form
```sql
CREATE TABLE departments (
  dept_id INTEGER PRIMARY KEY,
  dept_name TEXT
);

CREATE TABLE employees (
  emp_id INTEGER PRIMARY KEY,
  emp_name TEXT,
  dept_id INTEGER,
  FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);
```
Each department name is stored once, and employees reference it. This is the layout the practice database uses.

### Reading the combined result
```sql
SELECT employees.emp_name, departments.dept_name
FROM employees
INNER JOIN departments ON departments.dept_id = employees.dept_id;
```
A join restores the denormalized view whenever a report needs it, without storing the name repeatedly.

## Common Mistakes
### Renaming a department one row at a time
❌ Incorrect
```sql
UPDATE employees
SET dept_name = 'Platform Engineering'
WHERE emp_id = 1;
```
✅ Correct
```sql
UPDATE departments
SET dept_name = 'Platform Engineering'
WHERE dept_id = 1;
```
💡 Why it happens: With the name duplicated on every employee row, updating one leaves colleagues in a department that now has two names. One row per department removes the risk.

### Losing a department by deleting its last employee
❌ Incorrect
```sql
DELETE FROM employees WHERE emp_id = 6;
```
✅ Correct
```sql
DELETE FROM employees WHERE emp_id = 6;
SELECT dept_name FROM departments WHERE dept_id = 4;
```
💡 Why it happens: When the name lives only on employee rows, removing the last employee erases the department itself. A separate table keeps it on record regardless of staffing.

### Storing a derived value alongside its source
❌ Incorrect
```sql
CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  unit_price REAL,
  quantity INTEGER,
  total REAL
);
```
✅ Correct
```sql
SELECT order_id, unit_price * quantity AS total
FROM orders;
```
💡 Why it happens: A stored total depends on the other two columns, so any change to either leaves it stale. Compute it when reading instead.
