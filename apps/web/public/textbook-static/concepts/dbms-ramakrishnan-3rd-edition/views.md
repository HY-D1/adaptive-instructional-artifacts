# SQL Views

## Definition

A SQL view is a virtual table that is based on the result-set of a SQL query. It allows you to simplify complex queries and provide a layer of abstraction between the application and the database.

## Explanation

SQL views are incredibly useful for several reasons:
1. **Simplification**: Complex queries can be encapsulated in a view, making them easier to understand and use throughout your application.
2. **Security**: Views can restrict access to certain data by only showing specific columns or rows, enhancing security.
3. **Consistency**: If the underlying data changes, views automatically update without needing any changes to the application code using them.
4. **Performance**: Some databases optimize queries on views for better performance.
To create a view, you use the `CREATE VIEW` statement followed by the view name and the `AS` keyword, then the SQL query that defines the view.

## Examples

### Basic Usage

```sql
CREATE VIEW employee_details AS
SELECT first_name, last_name, email FROM employees;
```

This example creates a view named `employee_details` that shows only the first name, last name, and email of all employees.

### Practical Example

```sql
CREATE VIEW sales_summary AS
SELECT product_id, SUM(quantity) as total_quantity FROM sales GROUP BY product_id;
```

This practical example creates a view `sales_summary` that shows the total quantity sold for each product.

## Common Mistakes

### Forgetting to use `AS` after `CREATE VIEW`

**Incorrect:**

```sql
CREATE VIEW employee_details SELECT first_name, last_name, email FROM employees;
```

**Correct:**

```sql
CREATE VIEW employee_details AS
SELECT first_name, last_name, email FROM employees;
```

**Why this happens:** The `AS` keyword is crucial to define the view's content. Without it, SQL will throw an error.

### Using `SELECT *` in a view

**Incorrect:**

```sql
CREATE VIEW all_employees AS
SELECT * FROM employees;
```

**Correct:**

```sql
CREATE VIEW employee_details AS
SELECT first_name, last_name, email FROM employees;
```

**Why this happens:** While it's tempting to use `SELECT *`, specifying only the necessary columns makes the view more efficient and easier to understand.

---

## Practice

**Question:** Create a view named `customer_orders` that shows the customer ID, order date, and total amount for each order.

**Solution:** CREATE VIEW customer_orders AS
SELECT c.customer_id, o.order_date, SUM(od.quantity * od.price) as total_amount FROM customers c JOIN orders o ON c.customer_id = o.customer_id JOIN order_details od ON o.order_id = od.order_id GROUP BY c.customer_id, o.order_date;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*