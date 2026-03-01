# Normalization

🟡 **Difficulty:** Intermediate
⏱️ **Estimated Time:** 25 minutes

## Learning Objectives

- Understand the purpose of database normalization
- Identify the three normal forms (1NF, 2NF, 3NF)
- Recognize common normalization violations
- Apply normalization principles to table design

## Prerequisites

Before learning this concept, you should understand:

- [create-table](./create-table.md)
- [primary-key](./primary-key.md)
- [foreign-key](./foreign-key.md)

## What is This?

Normalization is the process of organizing database tables to reduce data redundancy and improve data integrity.

It involves splitting large tables into smaller, well-structured ones and defining relationships between them using primary and foreign keys. The process follows progressive rules called normal forms: **1NF (First Normal Form)** ensures each cell contains a single value with no repeating groups; **2NF (Second Normal Form)** builds on 1NF by requiring all non-key attributes to depend on the entire primary key (not just part of it); **3NF (Third Normal Form)** adds the requirement that non-key attributes depend only on the key, not on other non-key columns. You normalize databases when designing new schemas to prevent data anomalies, when existing tables suffer from update anomalies (where changing one piece of data requires changes in multiple places), or when you notice the same data being stored repeatedly across rows.

## Examples

### Example 1: Converting to 1NF (Eliminate Repeating Groups)

**Difficulty:** Beginner

**Scenario:** A denormalized orders table with multiple products in one row

**Before (Not 1NF):**
| order_id | customer | product1 | product2 | product3 |
|----------|----------|----------|----------|----------|
| 1 | Alice | Laptop | Mouse | NULL |
| 2 | Bob | Phone | NULL | NULL |

**After (1NF - separate rows):**
```sql
-- Orders table
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    customer VARCHAR(50)
);

-- Order items table (one row per product)
CREATE TABLE order_items (
    item_id INT PRIMARY KEY,
    order_id INT,
    product_name VARCHAR(50),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);
```

**Explanation:** Instead of repeating product columns, we create a separate table where each product gets its own row.

### Example 2: Converting to 2NF (Eliminate Partial Dependencies)

**Difficulty:** Intermediate

**Scenario:** An order_items table where product info is repeated

**Before (Not 2NF):**
| order_id | product_id | product_name | product_price | quantity |
|----------|------------|--------------|---------------|----------|
| 1 | 101 | Laptop | 999.99 | 2 |
| 2 | 101 | Laptop | 999.99 | 1 |

**After (2NF - separate products table):**
```sql
-- Products table (product info depends only on product_id)
CREATE TABLE products (
    product_id INT PRIMARY KEY,
    product_name VARCHAR(100),
    product_price DECIMAL(10,2)
);

-- Order items (only stores the relationship)
CREATE TABLE order_items (
    order_id INT,
    product_id INT,
    quantity INT,
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);
```

**Explanation:** Product name and price depend only on product_id, not the full key (order_id + product_id). We move them to a separate table.

### Example 3: Converting to 3NF (Eliminate Transitive Dependencies)

**Difficulty:** Intermediate

**Scenario:** A users table where city info depends on zip code

**Before (Not 3NF):**
| user_id | name | zip_code | city | state |
|---------|------|----------|------|-------|
| 1 | Alice | 98101 | Seattle | WA |
| 2 | Bob | 98101 | Seattle | WA |

**After (3NF - separate cities table):**
```sql
-- Cities table (city/state depends on zip_code)
CREATE TABLE cities (
    zip_code VARCHAR(10) PRIMARY KEY,
    city VARCHAR(50),
    state VARCHAR(2)
);

-- Users table (only references zip_code)
CREATE TABLE users (
    user_id INT PRIMARY KEY,
    name VARCHAR(50),
    zip_code VARCHAR(10),
    FOREIGN KEY (zip_code) REFERENCES cities(zip_code)
);
```

**Explanation:** City and state depend on zip_code (not directly on user_id). This is a transitive dependency we eliminate by creating a separate cities table.

## Common Mistakes

### Mistake 1: Storing calculated values

**Incorrect Design:**
```sql
CREATE TABLE order_items (
    product_id INT,
    quantity INT,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2)  -- Calculated: quantity * unit_price
);
```

**Why it happens:** Storing calculated values seems convenient but creates data integrity issues. If quantity changes, you must remember to update total_price.

**Corrected Design:**
```sql
CREATE TABLE order_items (
    product_id INT,
    quantity INT,
    unit_price DECIMAL(10,2)
    -- Calculate total_price in queries: SELECT quantity * unit_price AS total_price
);
```

💡 **Key Takeaway:** Don't store values that can be calculated from other columns

### Mistake 2: Storing multi-valued attributes in one column

**Incorrect Design:**
```sql
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    phone_numbers VARCHAR(200)  -- "555-1234, 555-5678"
);
```

**Why it happens:** It's tempting to store multiple values in one column, but this makes searching and updating difficult.

**Corrected Design:**
```sql
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(50)
);

CREATE TABLE user_phones (
    user_id INT,
    phone_number VARCHAR(20),
    PRIMARY KEY (user_id, phone_number),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

💡 **Key Takeaway:** Use separate tables for multi-valued attributes (1NF)

## Practice Challenge

**Normalize this table to 3NF:**

| emp_id | emp_name | dept_name | dept_location | project_name |
|--------|----------|-----------|---------------|--------------|
| 1 | Alice | Engineering | Building A | Project X |
| 1 | Alice | Engineering | Building A | Project Y |
| 2 | Bob | Sales | Building B | Project X |

💡 **Hint:** Identify what depends on emp_id, what depends on dept_name, and what needs its own table.

<details>
<summary>Click to see solution</summary>

```sql
-- Departments table
CREATE TABLE departments (
    dept_name VARCHAR(50) PRIMARY KEY,
    dept_location VARCHAR(50)
);

-- Employees table
CREATE TABLE employees (
    emp_id INT PRIMARY KEY,
    emp_name VARCHAR(50),
    dept_name VARCHAR(50),
    FOREIGN KEY (dept_name) REFERENCES departments(dept_name)
);

-- Projects table
CREATE TABLE projects (
    project_name VARCHAR(50) PRIMARY KEY
);

-- Employee-Project junction table (many-to-many)
CREATE TABLE employee_projects (
    emp_id INT,
    project_name VARCHAR(50),
    PRIMARY KEY (emp_id, project_name),
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id),
    FOREIGN KEY (project_name) REFERENCES projects(project_name)
);
```

**Explanation:** 
- Departments get their own table (dept_location depends on dept_name)
- Projects get their own table (independent entity)
- Employee-Project relationship gets a junction table (many-to-many)
</details>

---

*Content generated for SQL-Adapt Learning Platform*
