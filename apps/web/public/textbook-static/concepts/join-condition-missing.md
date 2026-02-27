# JOIN Condition Requirements

## Definition
Every JOIN must specify an ON clause to define how tables relate; missing conditions cause Cartesian products, which multiply every row from the first table by every row from the second table.

## Explanation
When you join two tables without specifying how they relate, MySQL performs a CROSS JOIN (Cartesian product). This means every row from Table A is paired with every row from Table B.

For example:
- Table A has 100 rows
- Table B has 50 rows
- A CROSS JOIN produces 100 × 50 = 5,000 rows

This is almost never what you want! Always specify the join condition using the ON clause to relate the tables properly.

The ON clause defines the relationship between tables, typically matching a foreign key in one table to a primary key in another.

## Examples

### Example 1: Correct INNER JOIN with ON Clause
```sql
SELECT employees.first_name, departments.department_name
FROM employees
INNER JOIN departments ON employees.department_id = departments.id;
```
Returns only matching employee-department pairs. This is the correct way to join tables.

### Example 2: Correct Multi-Table Join
```sql
SELECT 
    e.first_name,
    d.department_name,
    l.city
FROM employees e
JOIN departments d ON e.department_id = d.id
JOIN locations l ON d.location_id = l.id;
```
Each JOIN has its own ON clause defining the relationship between specific tables.

### Example 3: Self-Join with ON Clause
```sql
SELECT e.first_name AS employee, m.first_name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;
```
Even when joining a table to itself, the ON clause is required.

## Common Mistakes

### Mistake 1: Forgetting the ON Clause Entirely
**Incorrect:**
```sql
SELECT * FROM employees JOIN departments;
```

**Correct:**
```sql
SELECT * FROM employees 
JOIN departments ON employees.department_id = departments.id;
```

**Why this happens:** Without ON, MySQL performs a CROSS JOIN. If employees has 100 rows and departments has 10 rows, you'll get 1,000 rows of meaningless combinations instead of 100 properly matched rows.

### Mistake 2: Wrong Column in ON Clause
**Incorrect:**
```sql
SELECT * FROM employees e
JOIN departments d ON e.id = d.id;
```

**Correct:**
```sql
SELECT * FROM employees e
JOIN departments d ON e.department_id = d.id;
```

**Why this happens:** The wrong columns are being matched. e.id is the employee ID, but you want to match e.department_id (foreign key) to d.id (primary key). Always verify you're matching the foreign key to the primary key.

### Mistake 3: Multiple Tables, Missing One ON Clause
**Incorrect:**
```sql
SELECT * FROM employees e
JOIN departments d ON e.department_id = d.id
JOIN locations l;
```

**Correct:**
```sql
SELECT * FROM employees e
JOIN departments d ON e.department_id = d.id
JOIN locations l ON d.location_id = l.id;
```

**Why this happens:** Every JOIN operation needs its own ON clause. The third table (locations) is being cross-joined with the result of the first join, causing an explosion of rows.
