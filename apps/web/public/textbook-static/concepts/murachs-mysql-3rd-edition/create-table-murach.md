# Creating Tables

## Definition

Analytic functions are special SQL functions that perform calculations across a set of rows related to the current row. They help in ranking, filtering, and summarizing data within partitions.

## Explanation

Analytic functions are essential for complex data analysis tasks where you need to compare values across multiple rows. These functions operate on a window of rows defined by the PARTITION BY clause and sort them using the ORDER BY clause. Key analytic functions include FIRST_VALUE, LAST_VALUE, NTH_VALUE, LEAD, LAG, PERCENT_RANK, and CUME_DIST. They are particularly useful in financial analysis, sales reporting, and any scenario where you need to analyze trends or compare data points over time.

## Examples

### Basic Usage

```sql
-- Get the highest sales for each year
SELECT sales_year, rep_first_name, rep_last_name, sales_total,
FIRST_VALUE(sales_total) OVER (PARTITION BY sales_year ORDER BY sales_total DESC) AS highest_sales
FROM sales_totals JOIN sales_reps ON sales_totals.rep_id = sales_reps.rep_id;
```

This example uses FIRST_VALUE to find the highest sales for each year by comparing sales totals within each partition defined by sales_year.

### Practical Example

```sql
-- Calculate sales change FROM previous year SELECT rep_id, sales_year, sales_total, LAG(sales_total) OVER (PARTITION BY rep_id ORDER BY sales_year) AS last_sales, sales_total - LAG(sales_total) OVER (PARTITION BY rep_id ORDER BY sales_year) AS change FROM sales_totals;
```

This practical example calculates the change in sales from the previous year for each sales representative.

## Common Mistakes

### Forgetting to use PARTITION BY

**Incorrect:**

```sql
-- Incorrect query without partitioning
SELECT rep_id, sales_year, sales_total,
LAG(sales_total) OVER (ORDER BY sales_year) AS last_sales
FROM sales_totals;
```

**Correct:**

```sql
-- Correct query with partitioning
SELECT rep_id, sales_year, sales_total,
LAG(sales_total) OVER (PARTITION BY rep_id ORDER BY sales_year) AS last_sales
FROM sales_totals;
```

**Why this happens:** This mistake occurs when students try to use LAG or other analytic functions without specifying how the data should be partitioned. Always include PARTITION BY to ensure correct results.

---

## Practice

**Question:** Write a query that uses the CUME_DIST function to find the cumulative distribution of sales totals for each year in the Sales_Totals table.

**Solution:** -- Solution using CUME_DIST
SELECT sales_year, rep_id, sales_total,
CUME_DIST() OVER (PARTITION BY sales_year ORDER BY sales_total) AS cume_dist
FROM sales_totals;

---

*Source: Murach's MySQL 3rd Edition*