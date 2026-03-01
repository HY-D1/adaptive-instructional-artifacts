# of CPUs, # transactions per second

## Definition

CPU speed-up and scale-up refer to techniques used to increase the performance of a database system by executing multiple queries concurrently. This allows for faster data processing and retrieval.

## Explanation

When dealing with databases, it's challenging to predict which queries will run simultaneously. Therefore, the focus has shifted towards parallel execution of a single query. A relational query execution plan is represented as a graph of relational algebra operators that can be executed in parallel. If one operator consumes the output of another, we have pipelined parallelism; otherwise, the two operators can operate independently. Operators are said to block if they produce no output until all their inputs are processed. Pipelined parallelism is limited by blocking operators such as sorting or aggregation. Additionally, each individual operator in a query plan can be evaluated in parallel by partitioning the input data and working on each partition concurrently. This approach is called data-partitioned parallel evaluation. Existing sequential code for relational operator evaluation can often be easily adapted for parallel execution. The success of shared-nothing parallel database systems lies in their ability to efficiently partition data and structure algorithms to minimize data movement and maximize processing at individual processors.

## Examples

### Basic Usage

```sql
-- Example of a simple query
SELECT employee_id, first_name, last_name
FROM employees;
```

This example demonstrates a basic SQL query that retrieves employee details. While this doesn't show parallel execution directly, it sets the stage for understanding how queries can be optimized.

### Practical Example

```sql
-- Practical scenario using data-partitioned parallel evaluation
SELECT department_id, AVG(salary) AS avg_salary
FROM employees
GROUP BY department_id;
```

This example shows a practical application where data is partitioned by department and the average salary is calculated in parallel for each partition. This helps in reducing the overall processing time.

## Common Mistakes

### Forgetting to partition data properly

**Incorrect:**

```sql
-- Incorrect partitioning
SELECT department_id, AVG(salary) AS avg_salary
FROM employees;
```

**Correct:**

```sql
-- Correct partitioning
SELECT department_id, AVG(salary) AS avg_salary
FROM employees PARTITION BY department_id;
```

**Why this happens:** Mistakes often occur when students forget to properly partition data. Proper partitioning ensures that each partition can be processed independently, leading to efficient parallel execution.

---

## Practice

**Question:** How would you modify the following query to improve its performance using data-partitioned parallel evaluation?

**Solution:** -- Original query
SELECT product_id, SUM(quantity) AS total_quantity
FROM sales;
-- Modified query for better performance
SELECT product_id, SUM(quantity) AS total_quantity
FROM sales PARTITION BY product_id;


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*