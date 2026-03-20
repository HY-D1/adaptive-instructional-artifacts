# Outer Join

## Definition

An outer join is a type of SQL join that returns all records from both tables, even if there are no matching rows between them. This is useful for retrieving data from multiple tables where you want to ensure all records from both tables are included in the result set.

## Explanation

Outer joins solve the problem of missing data when using inner joins. An inner join only returns rows where there is a match in both tables, which can lead to incomplete results if some records don't have corresponding entries in the other table. Outer joins include all records from both tables, filling in NULL values for non-matching rows. This ensures that no data is lost and provides a complete picture of the data across multiple tables.

## Examples

### Basic Usage

```sql
-- Basic LEFT JOIN example
SELECT employees.employee_id, departments.department_name
FROM employees
LEFT JOIN departments ON employees.department_id = departments.department_id;
```

This query retrieves all employee records and their corresponding department names. If an employee does not have a department (NULL in the department_id), it will still include that employee's record with NULL for the department name.

### Practical Example

```sql
-- Practical scenario: Finding customers who have never made a purchase
SELECT customers.customer_id, customers.customer_name
FROM customers
LEFT JOIN orders ON customers.customer_id = orders.customer_id
WHERE orders.order_id IS NULL;
```

This query identifies all customers who have not placed any orders. It uses a LEFT JOIN to include all customer records and only those that do not have a matching order (NULL in the order_id) are returned.

## Common Mistakes

### Forgetting to specify columns

**Incorrect:**

```sql
-- Incorrect: No column specified
SELECT * FROM employees LEFT JOIN departments ON employees.department_id = departments.department_id;
```

**Correct:**

```sql
-- Correct: Specify columns explicitly
SELECT employees.employee_id, departments.department_name FROM employees LEFT JOIN departments ON employees.department_id = departments.department_id;
```

**Why this happens:** Always specify the columns you want to retrieve. Using '*' can lead to unexpected results and is generally not recommended.

### Using INNER JOIN instead of OUTER JOIN

**Incorrect:**

```sql
-- Incorrect: Using INNER JOIN
SELECT employees.employee_id, departments.department_name FROM employees INNER JOIN departments ON employees.department_id = departments.department_id;
```

**Correct:**

```sql
-- Correct: Use LEFT JOIN to include all records FROM both tables SELECT employees.employee_id, departments.department_name FROM employees LEFT JOIN departments ON employees.department_id = departments.department_id;
```

**Why this happens:** Outer joins are necessary when you want to ensure all records from both tables are included. Using an inner join will exclude non-matching records.

---

## Practice

**Question:** Write a query that retrieves all products and their corresponding suppliers, including those without suppliers.

**Solution:** -- Solution
SELECT products.product_id, products.product_name, suppliers.supplier_name FROM products LEFT JOIN suppliers ON products.supplier_id = suppliers.supplier_id;

---

*Source: Murach's MySQL 3rd Edition*