---
id: group-by
title: GROUP BY Clause
definition: Collapsing rows that share a value into groups and computing one aggregate result per group
difficulty: intermediate
estimatedReadTime: 4
pageReferences: [165, 166, 167, 168, 169, 170]
tags:
  - sql
  - aggregation
  - group-by
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# GROUP BY Clause

## Definition
GROUP BY collects rows that share the same value in the listed columns into one group, so aggregate functions report a separate result for each group.

## Explanation
Aggregate functions such as COUNT, SUM, AVG, MIN, and MAX reduce many rows to a single number. Used alone they treat the whole table as one group, which answers questions like total revenue. GROUP BY splits the rows first, so the same aggregate answers the more useful question of revenue per region.

The clause order is the key to reading these queries: FROM gathers the rows, WHERE discards individual rows, GROUP BY partitions what remains, aggregates are computed per partition, HAVING discards whole groups, and SELECT finally shapes the output. That sequence explains why WHERE cannot reference an aggregate while HAVING can, and it is worth memorising because most GROUP BY confusion traces back to it.

One rule follows directly from what a grouped row means. Each output row stands for an entire group, so every column in SELECT must either appear in GROUP BY or be wrapped in an aggregate. Anything else is ambiguous, since the group may contain many different values for that column. Most databases reject such a query; SQLite, which runs the practice editor here, instead picks a value from an arbitrary row in the group, so a query that appears to work locally can fail elsewhere.

NULL handling is worth noting too. Rows with NULL in a grouping column form their own group rather than being dropped, and COUNT applied to a specific column ignores NULLs while COUNT of everything counts rows regardless.

## Examples
### Total each region's sales
```sql
SELECT region, SUM(amount) AS total_sales
FROM sales
GROUP BY region;
```
One output row per distinct region, with amounts from that region added together.

### Keep only groups that pass a test
```sql
SELECT region, COUNT(*) AS sale_count
FROM sales
GROUP BY region
HAVING COUNT(*) > 1;
```
The count is computed per region, then HAVING drops the regions with only a single sale.

### Filter rows first, then group
```sql
SELECT region, AVG(amount) AS avg_widget_sale
FROM sales
WHERE product = 'Widget'
GROUP BY region;
```
WHERE removes non-Widget rows before grouping, so the average covers Widget sales only.

## Common Mistakes
### Selecting a column that is not grouped or aggregated
❌ Incorrect
```sql
SELECT region, product, SUM(amount) AS total
FROM sales
GROUP BY region;
```
✅ Correct
```sql
SELECT region, product, SUM(amount) AS total
FROM sales
GROUP BY region, product;
```
💡 Why it happens: A group can hold several products, so a bare product column has no single answer. SQLite quietly returns an arbitrary one; most databases reject the query.

### Filtering an aggregate in WHERE
❌ Incorrect
```sql
SELECT region, SUM(amount) AS total
FROM sales
WHERE SUM(amount) > 2000
GROUP BY region;
```
✅ Correct
```sql
SELECT region, SUM(amount) AS total
FROM sales
GROUP BY region
HAVING SUM(amount) > 2000;
```
💡 Why it happens: WHERE runs before grouping, so no sum exists yet. HAVING is the clause that filters groups after their aggregates are computed.

### Counting a column that can be NULL
❌ Incorrect
```sql
SELECT status, COUNT(priority) AS task_count
FROM tasks
GROUP BY status;
```
✅ Correct
```sql
SELECT status, COUNT(*) AS task_count
FROM tasks
GROUP BY status;
```
💡 Why it happens: COUNT of a column skips NULLs, so tasks with no priority go uncounted. COUNT of everything counts rows whatever they contain.
