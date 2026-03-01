# Relational Algebra

## Definition

Relational Algebra is a formal system for manipulating relations using operations like selection, projection, union, and join. It helps database designers understand how to construct queries that retrieve specific data from databases.

## Explanation

Relational Algebra provides a powerful yet simple way to express complex database queries. It uses a set of operations on relations (tables) to derive new relations. The key operations include:

1. **Selection**: Filters rows based on conditions.
2. **Projection**: Selects specific columns from the table.
3. **Union**: Combines two or more tables, removing duplicates.
4. **Join**: Combines rows from two tables based on related columns.

These operations are crucial for database design as they help in creating efficient and accurate queries. Understanding Relational Algebra helps in designing databases that can handle complex data retrieval tasks effectively.

## Examples

### Basic Usage

```sql
-- SELECT all employees FROM the 'Employees' TABLE SELECT * FROM Employees;
```

This example demonstrates how to select all columns from the 'Employees' table. It's a basic usage of projection.

### Practical Example

```sql
-- Find all departments that have at least one employee with a salary greater than 5000
SELECT D.department_name FROM Departments AS D JOIN Employees AS E ON D.department_id = E.department_id WHERE E.salary > 5000;
```

This practical example shows how to use join and where clauses to find departments based on employee salaries. It demonstrates the power of relational algebra in complex query construction.

## Common Mistakes

### Forgetting to include a WHERE clause

**Incorrect:**

```sql
-- SELECT all employees FROM 'Employees' SELECT * FROM Employees;
```

**Correct:**

```sql
-- Correctly SELECT all employees with a salary greater than 5000 SELECT * FROM Employees WHERE salary > 5000;
```

**Why this happens:** This mistake happens when trying to filter data without specifying conditions. Always include a WHERE clause if you need to filter rows based on specific criteria.

---

## Practice

**Question:** Create a query that selects all employees who work in the 'Sales' department and have a salary greater than 4000.

**Solution:** -- Correct solution
SELECT E.employee_name FROM Employees AS E JOIN Departments AS D ON E.department_id = D.department_id WHERE D.department_name = 'Sales' AND E.salary > 4000;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*