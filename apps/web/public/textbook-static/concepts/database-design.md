# Database Design

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 30 minutes

## Learning Objectives

- Understand database normalization (1NF, 2NF, 3NF)
- Learn to identify and create proper relationships between tables
- Know how to choose appropriate primary and foreign keys
- Understand when to denormalize for performance

## What is This?

Database design is the process of structuring data into tables, relationships, and constraints according to a database model.

Good design eliminates data redundancy, ensures data integrity through properly defined relationships and constraints, and optimizes tables for query performance. Key concepts include normalization (organizing data to reduce duplication), primary and foreign keys (establishing relationships between tables), and indexing (speeding up data retrieval). You apply database design principles when creating new databases to ensure data consistency, when refactoring existing databases to improve performance, or when planning how different entities in your application relate to each other.

## Examples

### Example 1: Normalizing to Third Normal Form (3NF)

**Difficulty:** Beginner

**Scenario:** Convert a denormalized "orders" table into properly normalized tables.

```sql
-- BEFORE: Denormalized table with redundancy issues
CREATE TABLE orders_denormalized (
    order_id INTEGER PRIMARY KEY,
    order_date DATE,
    -- User info repeated in every order
    user_name TEXT,
    user_email TEXT,
    user_city TEXT,
    -- Product info repeated
    product_name TEXT,
    product_category TEXT,
    product_price DECIMAL(10,2),
    quantity INTEGER
);

-- Problems:
-- 1. If a user moves, we must update ALL their orders
-- 2. Product price changes require updating all historical orders
-- 3. Wasted storage on repeated data
-- 4. Risk of inconsistent data (same user, different email in different orders)

-- AFTER: Normalized design
-- Separate users into their own table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    city TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Separate products into their own table
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    current_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table references users
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order items separate (many-to-many between orders and products)
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL, -- Price at time of order
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insert sample data
INSERT INTO users (name, email, city) VALUES
    ('Alice', 'alice@email.com', 'Seattle'),
    ('Bob', 'bob@email.com', 'Portland');

INSERT INTO products (name, category, current_price) VALUES
    ('Laptop', 'Electronics', 999.99),
    ('Mouse', 'Electronics', 29.99),
    ('Desk Chair', 'Furniture', 249.99);

INSERT INTO orders (user_id, order_date, status) VALUES
    (1, '2024-01-15', 'completed'),
    (1, '2024-02-20', 'completed'),
    (2, '2024-03-10', 'pending');

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 1, 999.99),  -- Alice bought a laptop
    (1, 2, 2, 29.99),   -- Alice bought 2 mice
    (2, 3, 1, 249.99),  -- Alice bought a chair
    (3, 2, 1, 29.99);   -- Bob bought a mouse
```

**Explanation:** This demonstrates 3rd Normal Form (3NF):
- **1NF**: Atomic values (no repeating groups)
- **2NF**: No partial dependencies (non-key columns depend on entire primary key)
- **3NF**: No transitive dependencies (columns depend only on the key, not other columns)

The normalized design stores user and product info once, with foreign keys establishing relationships. The `unit_price` in `order_items` captures the price at purchase time (different from `current_price` in products), preserving historical accuracy.

---

### Example 2: Proper Indexing Strategy

**Difficulty:** Intermediate

**Scenario:** Add indexes to support common query patterns on the normalized schema.

```sql
-- Analyze query patterns first:
-- Q1: Find orders by user (very common)
-- Q2: Find orders by date range
-- Q3: Find products by category
-- Q4: Find order items by order

-- Create indexes for foreign keys (almost always needed)
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Create index for date range queries
CREATE INDEX idx_orders_date ON orders(order_date);

-- Create index for category filtering
CREATE INDEX idx_products_category ON products(category);

-- Create composite index for common filter + sort combination
-- Example: Find orders by user, sorted by date (most recent first)
CREATE INDEX idx_orders_user_date ON orders(user_id, order_date DESC);

-- Unique index for email lookups (faster than scanning)
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Partial/covering index example (SQLite supports this)
-- Index only pending orders for quick dashboard queries
CREATE INDEX idx_orders_pending ON orders(status) WHERE status = 'pending';

-- Test the indexes with EXPLAIN QUERY PLAN
EXPLAIN QUERY PLAN
SELECT o.id, o.order_date, oi.quantity, p.name
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE o.user_id = 1
ORDER BY o.order_date DESC;

-- Should show: USE INDEX idx_orders_user_date, etc.
```

**Explanation:** Indexes dramatically speed up queries but slow down writes and consume storage. Key principles:
1. **Always index foreign keys** - Joins need them
2. **Index columns in WHERE clauses** - Helps filtering
3. **Index columns in ORDER BY** - Avoids sorting
4. **Consider composite indexes** - For multi-column filters
5. **Use EXPLAIN QUERY PLAN** - Verify indexes are being used

The composite index `idx_orders_user_date` is more efficient than separate indexes because it supports both the WHERE filter and ORDER BY in a single index scan.

---

### Example 3: Handling Many-to-Many Relationships

**Difficulty:** Intermediate

**Scenario:** Model a system where products can have multiple tags, and tags apply to multiple products.

```sql
-- Products table (existing)
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    price DECIMAL(10,2)
);

-- Tags table
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- Junction table (associative entity) for many-to-many
CREATE TABLE product_tags (
    product_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    tagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tagged_by TEXT,
    PRIMARY KEY (product_id, tag_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Insert tags
INSERT INTO tags (name, description) VALUES
    ('bestseller', 'Top selling item'),
    ('sale', 'Currently on sale'),
    ('new', 'New arrival'),
    ('electronics', 'Electronic device'),
    ('furniture', 'Home/office furniture');

-- Insert products
INSERT INTO products (name, category, price) VALUES
    ('Gaming Laptop', 'Electronics', 1499.99),
    ('Standing Desk', 'Furniture', 599.99),
    ('Wireless Mouse', 'Electronics', 49.99);

-- Create many-to-many relationships
INSERT INTO product_tags (product_id, tag_id) VALUES
    (1, 1),  -- Laptop is bestseller
    (1, 4),  -- Laptop is electronics
    (2, 5),  -- Desk is furniture
    (2, 3),  -- Desk is new
    (3, 4),  -- Mouse is electronics
    (3, 2),  -- Mouse is on sale
    (3, 3);  -- Mouse is new

-- Query: Find all products with 'electronics' tag
SELECT p.name, p.price, p.category
FROM products p
JOIN product_tags pt ON p.id = pt.product_id
JOIN tags t ON pt.tag_id = t.id
WHERE t.name = 'electronics';

-- Query: Find all tags for a specific product
SELECT t.name, t.description
FROM tags t
JOIN product_tags pt ON t.id = pt.tag_id
WHERE pt.product_id = 1;

-- Query: Find products with multiple specific tags (electronics AND new)
SELECT p.name, p.price
FROM products p
JOIN product_tags pt ON p.id = pt.product_id
JOIN tags t ON pt.tag_id = t.id
WHERE t.name IN ('electronics', 'new')
GROUP BY p.id
HAVING COUNT(DISTINCT t.name) = 2;

-- Add indexes for the junction table
CREATE INDEX idx_product_tags_tag ON product_tags(tag_id);
CREATE INDEX idx_product_tags_product ON product_tags(product_id);
```

**Explanation:** Many-to-many relationships require a **junction table** (also called associative or linking table). The junction table:
- Has foreign keys to both related tables
- Has its own composite primary key (product_id, tag_id)
- Can have additional attributes (tagged_at, tagged_by)
- Enables efficient querying in both directions

The `ON DELETE CASCADE` ensures that when a product or tag is deleted, the associations are automatically cleaned up. The composite primary key prevents duplicate associations.

## Common Mistakes

### Mistake 1: Not Using Foreign Key Constraints

**Incorrect:**
```sql
-- Tables without foreign key constraints
CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,  -- No FK constraint!
    total DECIMAL(10,2)
);

-- This succeeds even though user 999 doesn't exist
INSERT INTO orders (user_id, total) VALUES (999, 100.00);

-- Query with implicit join returns orphaned order
SELECT o.id, u.name
FROM orders o, users u
WHERE o.user_id = u.id;
-- Missing order 999 from results without any error!
```

**Error Message:** No error is raised—this is the problem! Data integrity issues silently accumulate.

**Why it happens:** Developers sometimes skip foreign keys thinking they're "just for documentation" or worrying about performance. Without FKs, the database allows orphaned records, making queries unreliable and joins produce incorrect results.

**Corrected:**
```sql
-- Always define foreign keys with proper constraints
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total DECIMAL(10,2),
    FOREIGN KEY (user_id) 
        REFERENCES users(id)
        ON DELETE RESTRICT  -- Prevent deleting users with orders
        ON UPDATE CASCADE   -- Update if user ID changes
);

-- This now fails with a clear error
INSERT INTO orders (user_id, total) VALUES (999, 100.00);
-- Error: FOREIGN KEY constraint failed
```

💡 **Key Takeaway:** Always use foreign key constraints. They ensure referential integrity at the database level, not just application logic. Choose appropriate `ON DELETE` actions: `RESTRICT` (prevent deletion), `CASCADE` (delete related records), or `SET NULL` (keep record but remove reference).

---

### Mistake 2: Using the Wrong Data Type for IDs

**Incorrect:**
```sql
-- Using TEXT for IDs that should be numeric
CREATE TABLE users (
    id TEXT PRIMARY KEY,  -- Using string IDs
    name TEXT
);

INSERT INTO users (id, name) VALUES ('001', 'Alice');
INSERT INTO users (id, name) VALUES ('1', 'Bob');

-- These are different records!
SELECT * FROM users WHERE id = '1';
-- Only returns Bob, not Alice with '001'

-- String comparison issues
SELECT * FROM users WHERE id < '100';
-- String comparison: '001' > '1' (lexicographic)
```

**Why it happens:** Using TEXT/VARCHAR for IDs (especially when importing data with leading zeros) causes subtle bugs. String comparison differs from numeric comparison, and accidentally inserting '001' vs '1' creates duplicate logical identities.

**Corrected:**
```sql
-- Use INTEGER for auto-incrementing IDs
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Numeric ID
    name TEXT NOT NULL
);

-- If you need human-readable codes, use a separate column
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Internal ID
    sku TEXT UNIQUE,  -- Human-readable code with leading zeros
    name TEXT
);

INSERT INTO products (sku, name) VALUES ('PRD-001', 'Laptop');
INSERT INTO products (sku, name) VALUES ('PRD-002', 'Mouse');

-- Now both IDs work correctly
SELECT * FROM products WHERE id = 1;      -- Numeric lookup
SELECT * FROM products WHERE sku = 'PRD-001';  -- Code lookup
```

💡 **Key Takeaway:** Use `INTEGER PRIMARY KEY AUTOINCREMENT` for surrogate keys. If you need formatted identifiers (like SKUs, order numbers with prefixes), store them in separate columns with UNIQUE constraints. Never rely on string comparison for ID matching.

---

### Mistake 3: Not Handling NULL Values Properly

**Incorrect:**
```sql
-- Allowing NULL in critical columns
CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,  -- NULL allowed - but every order needs a user!
    total_amount DECIMAL(10,2),  -- NULL allowed
    status TEXT  -- NULL allowed - what does NULL status mean?
);

-- These problematic inserts succeed
INSERT INTO orders (user_id, total_amount, status) 
VALUES (NULL, 100.00, 'pending');  -- Orphan order

INSERT INTO orders (user_id, total_amount, status) 
VALUES (1, NULL, 'completed');  -- Order with no amount?

-- Calculations break with NULL
SELECT AVG(total_amount) FROM orders;  -- Skips NULLs silently
SELECT SUM(total_amount) FROM orders;  -- Returns NULL if all NULL
```

**Why it happens:** Not specifying `NOT NULL` constraints allows ambiguous data states. NULL means "unknown" but is often confused with "zero" or "empty." Aggregate functions and comparisons behave unexpectedly with NULL values.

**Corrected:**
```sql
-- Define NOT NULL constraints and defaults
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,  -- Every order MUST have a user
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Use CHECK constraints for validation
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    CHECK (price >= 0),  -- No negative prices
    CHECK (stock_quantity >= 0)  -- No negative stock
);

-- Handle nullable columns explicitly in queries
SELECT 
    id,
    COALESCE(total_amount, 0) AS amount_with_default,
    CASE 
        WHEN status IS NULL THEN 'unknown'
        ELSE status
    END AS status_display
FROM orders;
```

💡 **Key Takeaway:** Use `NOT NULL` constraints liberally. Only allow NULL when "unknown" is a valid semantic state. Provide `DEFAULT` values for optional columns. Use `CHECK` constraints to enforce business rules (positive prices, valid status values). Use `COALESCE()` in queries to provide fallback values for nullable columns.

---

*Content generated for SQL-Adapt Learning Platform*
