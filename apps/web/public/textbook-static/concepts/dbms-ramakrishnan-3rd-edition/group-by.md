# GROUP BY Clause

## Definition

The GROUP BY clause is used to group rows that have the same values in specified columns into aggregated data. It's essential for performing calculations on groups of data and summarizing information.

## Explanation

Imagine you're managing a library and want to know how many books are checked out by each member. The GROUP BY clause helps you organize the data so you can easily count the number of books per member. You group the rows based on the member's ID, then apply an aggregate function like COUNT() to find out how many books each member has borrowed.

## Examples

### Basic Usage

```sql
SELECT department, COUNT(employee_id) AS employee_count
FROM employees
GROUP BY department;
```

This example groups employees by their department and counts how many employees are in each department.

### Practical Example

```sql
SELECT customer_id, SUM(amount) AS total_spent
FROM orders
WHERE order_date BETWEEN '2023-01-01' AND '2023-12-31'
GROUP BY customer_id;
```

This practical example calculates the total amount spent by each customer in a given year.

## Common Mistakes

### Forgetting to include the aggregate function

**Incorrect:**

```sql
SELECT department, employee_id
FROM employees
GROUP BY department;
```

**Correct:**

```sql
SELECT department, COUNT(employee_id) AS employee_count
FROM employees
GROUP BY department;
```

**Why this happens:** The GROUP BY clause alone doesn't perform any calculations. You must use an aggregate function like COUNT() to get meaningful results.

---

## Practice

**Question:** Create a query that groups orders by customer and calculates the total amount spent by each customer in the last quarter of 2023.

**Solution:** SELECT customer_id, SUM(amount) AS total_spent
FROM orders
WHERE order_date BETWEEN '2023-10-01' AND '2023-12-31'
GROUP BY customer_id;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*