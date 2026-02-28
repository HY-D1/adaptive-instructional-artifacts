# Joining Tables

## Definition

Joining tables is a method used in database management to combine rows from two or more tables based on a related column between them. It's essential for retrieving data that spans multiple tables and allows for complex queries.

## Explanation

Imagine you have two tables: one with customer information (Customers) and another with their order details (Orders). If you want to find all orders made by a specific customer, you'd need to join these tables based on the customer's ID. This concept is crucial because it enables you to access comprehensive data that might be distributed across different tables in your database.

## Examples

### Basic INNER JOIN

```sql
-- Selecting customer names and their order IDs
SELECT Customers.customer_name, Orders.order_id
FROM Customers
INNER JOIN Orders ON Customers.customer_id = Orders.customer_id;
```

This example demonstrates how to join two tables using an INNER JOIN. It retrieves the names of customers who have placed orders.

### Practical Example: Finding All Orders by a Specific Customer

```sql
-- Selecting all orders for customer 'John Doe' SELECT * FROM Orders WHERE customer_id = (SELECT customer_id FROM Customers WHERE customer_name = 'John Doe');
```

This practical example shows how to combine a join with a subquery to find all orders made by a specific customer.

## Common Mistakes

### Using the wrong type of join

**Incorrect:**

```sql
-- Incorrectly using LEFT JOIN instead of INNER JOIN
SELECT * FROM Customers
LEFT JOIN Orders ON Customers.customer_id = Orders.customer_id;
```

**Correct:**

```sql
-- Correct usage of INNER JOIN
SELECT * FROM Customers
INNER JOIN Orders ON Customers.customer_id = Orders.customer_id;
```

**Why this happens:** This mistake occurs when the type of join used does not match the desired outcome. Always choose the appropriate join type based on your query requirements.

---

## Practice

**Question:** Create a query that retrieves all employees who have worked on projects in the 'Technology' department.

**Solution:** SELECT Employees.employee_name FROM Employees
INNER JOIN Employee_Projects ON Employees.employee_id = Employee_Projects.employee_id
INNER JOIN Projects ON Employee_Projects.project_id = Projects.project_id
WHERE Projects.department = 'Technology';

---

*Source: Murach's MySQL 3rd Edition*