# INSERT Statement

## Definition

An outer join is a type of SQL query that retrieves rows from two or more tables based on a related column between them. It returns all records when there is a match in either left or right table, and null values for unmatched rows.

## Explanation

Outer joins are essential when you need to ensure that no data is lost due to missing matches between tables. For example, if you have two tables: one with vendor information and another with their invoices, an outer join will return all vendors, even those without any invoices, filling in null values for the invoice details.

## Examples

### Basic Usage

```sql
SELECT vendor_name, invoice_number, invoice_total FROM vendors LEFT JOIN invoices ON vendors.vendor_id = invoices.vendor_id;
```

This query retrieves all vendors and their corresponding invoices. If a vendor has no invoices, the invoice details will be null.

### Practical Example

```sql
SELECT department_name, last_name, project_number FROM departments LEFT JOIN employees ON departments.department_number = employees.department_number LEFT JOIN projects ON employees.employee_id = projects.employee_id;
```

This query combines three tables to show all departments, their employees, and the projects they are assigned to. Unmatched rows will have null values for missing data.

## Common Mistakes

### Using RIGHT JOIN instead of LEFT JOIN

**Incorrect:**

```sql
SELECT department_name, last_name FROM departments RIGHT JOIN employees ON departments.department_number = employees.department_number;
```

**Correct:**

```sql
SELECT department_name, last_name FROM departments LEFT JOIN employees ON departments.department_number = employees.department_number;
```

**Why this happens:** Students often mistakenly use RIGHT JOIN when they should be using LEFT JOIN to ensure all rows from the left table are included.

---

## Practice

**Question:** Write a query that retrieves all customers and their orders, including those with no orders. Assume you have two tables: 'customers' and 'orders'.

**Solution:** SELECT customer_name, order_id FROM customers LEFT JOIN orders ON customers.customer_id = orders.customer_id; This query will return all customers, even if they don't have any orders, filling in null values for the order details.

---

*Source: Murach's MySQL 3rd Edition*