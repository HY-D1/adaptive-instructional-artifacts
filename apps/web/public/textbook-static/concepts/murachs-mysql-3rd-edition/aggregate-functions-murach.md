# Aggregate Functions

## Definition

Aggregate functions are used to perform calculations on a set of values and return a single value. They are essential for summarizing data and performing complex queries.

## Explanation

Aggregate functions solve problems like calculating total sales, average prices, or maximum/minimum values in a dataset. Here’s how they work:
1. **SUM**: Adds up all the values in a column.
2. **AVG**: Calculates the average of a set of values.
3. **MAX** and **MIN**: Find the highest and lowest values, respectively.
4. **COUNT**: Counts the number of rows that match a specified condition.
These functions are used in conjunction with GROUP BY to summarize data at different levels (e.g., by state, by product category).
When to use them? Whenever you need to get a single value from a set of values, such as total revenue for each quarter or average temperature per city.

## Examples

### Basic Usage

```sql
-- Calculate total sales per state
SELECT vendor_state, SUM(invoice_total) AS total_sales FROM vendors v JOIN invoices i ON v.vendor_id = i.vendor_id GROUP BY vendor_state;
```

This example calculates the total sales for each state by summing up the invoice totals and grouping the results by vendor state.

### Practical Example

```sql
-- Find the average price of products in each category
SELECT product_category, AVG(price) AS avg_price FROM products GROUP BY product_category;
```

This practical example calculates the average price of products within each category by grouping the data and using the AVG function.

## Common Mistakes

### Forgetting to use GROUP BY

**Incorrect:**

```sql
-- Incorrect query
SELECT vendor_state, SUM(invoice_total) AS total_sales FROM vendors v JOIN invoices i ON v.vendor_id = i.vendor_id;
```

**Correct:**

```sql
-- Correct query with GROUP BY
SELECT vendor_state, SUM(invoice_total) AS total_sales FROM vendors v JOIN invoices i ON v.vendor_id = i.vendor_id GROUP BY vendor_state;
```

**Why this happens:** This mistake happens when students try to use an aggregate function without grouping the data. Always ensure you include GROUP BY when using aggregate functions.

---

## Practice

**Question:** Calculate the total number of orders per month for each year from a sales table.

**Solution:** SELECT YEAR(order_date) AS order_year, MONTH(order_date) AS order_month, COUNT(*) AS total_orders FROM sales GROUP BY order_year, order_month ORDER BY order_year, order_month;

---

*Source: Murach's MySQL 3rd Edition*