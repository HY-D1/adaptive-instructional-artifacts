# Database Security

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 20 minutes

## Learning Objectives

- Understand SQL privilege management with GRANT and REVOKE
- Learn to create and manage database users and roles
- Know how to implement row-level security
- Understand SQL injection prevention techniques

## What is This?

**Database security** is the practice of controlling access to data through authentication (verifying user identity), authorization (granting appropriate permissions), and auditing (tracking data access).

SQL provides `GRANT` and `REVOKE` statements for managing user privileges, allowing you to specify exactly what actions each user can perform on which tables. Good security follows the **principle of least privilege**—users receive only the minimum permissions necessary for their specific role. Key security layers include authentication (verifying identity via passwords or other credentials), authorization (controlling what authenticated users can do), encryption (protecting data during transmission and storage), and auditing (maintaining logs of who accessed or modified what data and when). You implement database security when setting up production databases to protect sensitive information, when creating different access levels for administrators versus regular users, or when complying with regulatory requirements that mandate data protection.

**Note:** The sql.js environment used in this platform runs entirely in the browser with no user management system. The examples below use MySQL/PostgreSQL syntax and are for educational purposes to understand how real database security works.

## Examples

### Example 1: Basic GRANT and REVOKE

**Difficulty:** Beginner

**Scenario:** Set up different access levels for an e-commerce application: admin, customer service, and read-only reporting.

```sql
-- Create users (MySQL/PostgreSQL style)
-- Note: User management varies significantly by database

CREATE USER 'app_admin'@'localhost' IDENTIFIED BY 'secure_admin_pass';
CREATE USER 'app_support'@'localhost' IDENTIFIED BY 'support_pass';
CREATE USER 'app_reporting'@'localhost' IDENTIFIED BY 'report_pass';

-- Grant full privileges to admin on all tables
GRANT ALL PRIVILEGES ON ecommerce.* TO 'app_admin'@'localhost';

-- Grant customer service limited access
-- They can view and update users and orders but not delete
GRANT SELECT, INSERT, UPDATE ON ecommerce.users TO 'app_support'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ecommerce.orders TO 'app_support'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ecommerce.order_items TO 'app_support'@'localhost';

-- Grant read-only access for reporting
GRANT SELECT ON ecommerce.users TO 'app_reporting'@'localhost';
GRANT SELECT ON ecommerce.orders TO 'app_reporting'@'localhost';
GRANT SELECT ON ecommerce.order_items TO 'app_reporting'@'localhost';
GRANT SELECT ON ecommerce.products TO 'app_reporting'@'localhost';

-- Revoke specific privileges if needed
-- Remove INSERT permission from support on users table
REVOKE INSERT ON ecommerce.users FROM 'app_support'@'localhost';

-- Check what privileges a user has
SHOW GRANTS FOR 'app_support'@'localhost';
```

**Explanation:** Privileges control what actions users can perform. Common privileges include:
- `SELECT` - Read data
- `INSERT` - Add new rows
- `UPDATE` - Modify existing rows
- `DELETE` - Remove rows
- `ALL PRIVILEGES` - Everything including schema changes

The `REVOKE` statement removes previously granted permissions. Always verify with `SHOW GRANTS` to confirm the current permission state.

---

### Example 2: Role-Based Access Control (RBAC)

**Difficulty:** Intermediate

**Scenario:** Create reusable roles for different job functions, then assign users to roles.

```sql
-- Create roles (PostgreSQL/MySQL 8.0+ style)
CREATE ROLE 'role_admin';
CREATE ROLE 'role_support_agent';
CREATE ROLE 'role_analyst';
CREATE ROLE 'role_readonly';

-- Grant privileges to roles instead of individual users

-- Admin role: full access
GRANT ALL PRIVILEGES ON ecommerce.* TO 'role_admin';

-- Support agent role: can view and update orders, view users
GRANT SELECT, UPDATE, INSERT ON ecommerce.orders TO 'role_support_agent';
GRANT SELECT, UPDATE, INSERT ON ecommerce.order_items TO 'role_support_agent';
GRANT SELECT ON ecommerce.users TO 'role_support_agent';
GRANT SELECT ON ecommerce.products TO 'role_support_agent';

-- Analyst role: read access to most tables, but not sensitive user data
GRANT SELECT ON ecommerce.orders TO 'role_analyst';
GRANT SELECT ON ecommerce.order_items TO 'role_analyst';
GRANT SELECT ON ecommerce.products TO 'role_analyst';
-- Note: no access to users table (PII protection)

-- Read-only role: can view everything but not modify
GRANT SELECT ON ecommerce.* TO 'role_readonly';

-- Assign roles to users
GRANT 'role_admin' TO 'app_admin'@'localhost';
GRANT 'role_support_agent' TO 'app_support'@'localhost';
GRANT 'role_analyst' TO 'data_analyst'@'localhost';

-- Grant multiple roles to a user
CREATE USER 'supervisor'@'localhost' IDENTIFIED BY 'supervisor_pass';
GRANT 'role_support_agent' TO 'supervisor'@'localhost';
GRANT 'role_analyst' TO 'supervisor'@'localhost';
```

**Explanation:** Roles simplify privilege management by grouping permissions. Benefits include:
1. **Centralized management** - Change role permissions once, affects all users
2. **Easier onboarding** - Just assign appropriate roles to new users
3. **Principle of least privilege** - Create specific roles for specific job functions
4. **Separation of duties** - Different roles for different responsibilities

When an employee changes roles, revoke old roles and grant new ones rather than managing individual permissions.

---

### Example 3: Column-Level Security and Views

**Difficulty:** Intermediate

**Scenario:** Restrict access to sensitive columns (passwords, SSN, salary) while allowing access to non-sensitive data.

```sql
-- Users table with sensitive data
CREATE TABLE IF NOT EXISTS users_secure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,  -- Sensitive!
    ssn TEXT,                      -- Sensitive!
    salary DECIMAL(10,2),          -- Sensitive!
    department TEXT,
    hire_date DATE,
    is_active BOOLEAN DEFAULT 1
);

-- Create a view that excludes sensitive columns
CREATE VIEW users_public AS
SELECT 
    id,
    username,
    email,
    department,
    hire_date,
    is_active
FROM users_secure;

-- Create a view for HR that includes salary but not passwords
CREATE VIEW users_hr AS
SELECT 
    id,
    username,
    email,
    ssn,
    salary,
    department,
    hire_date,
    is_active
FROM users_secure;

-- Grant access to views instead of base table

-- General users see only public information
GRANT SELECT ON users_public TO 'app_user'@'localhost';

-- HR sees salary and SSN but not passwords
GRANT SELECT, UPDATE ON users_hr TO 'hr_user'@'localhost';

-- IT admins see everything (direct table access)
GRANT SELECT, UPDATE ON users_secure TO 'it_admin'@'localhost';

-- Usage examples:
-- Regular user query (works):
SELECT * FROM users_public WHERE department = 'Sales';

-- Regular user trying to access base table (fails):
-- SELECT password_hash FROM users_secure WHERE id = 1;
-- Error: SELECT command denied to user 'app_user'@'localhost'
```

**Explanation:** Views provide a powerful security mechanism by:
1. **Column filtering** - Hide sensitive columns from users who don't need them
2. **Row filtering** - Use WHERE clauses in views to restrict which rows are visible
3. **Data masking** - Show partial data (e.g., mask SSN: `***-**-1234`)
4. **Simplified access** - Users query views like regular tables

Views can also be made updatable (allowing INSERT/UPDATE/DELETE) if they meet certain criteria, providing a secure interface to underlying data.

## Common Mistakes

### Mistake 1: Granting Excessive Privileges

**Incorrect:**
```sql
-- Giving an application user full database access
GRANT ALL PRIVILEGES ON *.* TO 'app_user'@'%' IDENTIFIED BY 'weakpass';

-- Allowing connections from any host with wildcards
GRANT ALL PRIVILEGES ON production.* TO 'admin'@'%';

-- Application connects as root
-- config: database.user = 'root', database.password = 'rootpass'
```

**Error Message:** No error is raised during setup, but massive security vulnerability is created.

**Why it happens:** Developers often take shortcuts during development and forget to restrict permissions before deployment. Using `ALL PRIVILEGES` and wildcard hosts (`%`) makes setup easier but creates massive security holes.

**Corrected:**
```sql
-- Create application-specific users with minimal privileges
CREATE USER 'webapp_read'@'10.0.1.%' IDENTIFIED BY 'strong_random_password';
CREATE USER 'webapp_write'@'10.0.1.%' IDENTIFIED BY 'different_strong_password';

-- Read-only user for most application queries
GRANT SELECT ON ecommerce.users TO 'webapp_read'@'10.0.1.%';
GRANT SELECT ON ecommerce.products TO 'webapp_read'@'10.0.1.%';
GRANT SELECT ON ecommerce.orders TO 'webapp_read'@'10.0.1.%';

-- Write user for order creation only
GRANT SELECT, INSERT ON ecommerce.orders TO 'webapp_write'@'10.0.1.%';
GRANT SELECT, INSERT ON ecommerce.order_items TO 'webapp_write'@'10.0.1.%';
GRANT SELECT, UPDATE ON ecommerce.products TO 'webapp_write'@'10.0.1.%';
-- Note: no DELETE privileges, no access to admin tables

-- Restrict by host/subnet, not wildcards
-- '10.0.1.%' allows only from application servers in that subnet

-- Separate admin user with specific host
CREATE USER 'dba'@'10.0.1.10' IDENTIFIED BY 'very_strong_password';
GRANT ALL PRIVILEGES ON ecommerce.* TO 'dba'@'10.0.1.10';
```

💡 **Key Takeaway:** Never use `ALL PRIVILEGES` or wildcard hosts (`%`) in production. Create separate users for different access patterns (read vs. write), restrict by host/subnet, and use strong passwords. Applications should never connect as root or admin users.

---

### Mistake 2: SQL Injection from Poor Application Code

**Incorrect (Application Code):**
```sql
-- This is application code (Python/JavaScript) constructing SQL unsafely:

-- VULNERABLE Python code:
-- user_input = request.get('username')  # User enters: ' OR '1'='1' --
-- query = f"SELECT * FROM users WHERE username = '{user_input}'"
-- Result: SELECT * FROM users WHERE username = '' OR '1'='1' --'

-- VULNERABLE Node.js code:
-- const userId = req.params.id;  // User enters: 1; DROP TABLE users; --
-- const query = `SELECT * FROM orders WHERE user_id = ${userId}`;
-- Result: SELECT * FROM orders WHERE user_id = 1; DROP TABLE users; --
```

**Error Message:** No SQL error—the attack succeeds silently! Data is stolen, modified, or deleted.

**Why it happens:** String concatenation of user input into SQL queries allows attackers to inject malicious SQL. Even "escaping" quotes is error-prone. Parameterized queries are the only safe approach.

**Corrected:**
```sql
-- SAFE Python with parameterized query (psycopg2/mysql-connector):
-- user_input = request.get('username')
-- cursor.execute(
--     "SELECT * FROM users WHERE username = %s",
--     (user_input,)  # Parameters passed separately
-- )

-- SAFE Node.js with parameterized query:
-- const userId = req.params.id;
-- const query = 'SELECT * FROM orders WHERE user_id = ?';
-- db.query(query, [userId], (err, results) => { ... });

-- SAFE parameterized INSERT
INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?);
-- Parameters: [1, 99.99, 'pending']

-- Database treats parameters as VALUES, never as SQL commands
-- Even if user sends: "'; DROP TABLE users; --"
-- It's stored as a string value, never executed
```

💡 **Key Takeaway:** Always use parameterized queries/prepared statements. Never concatenate user input into SQL strings. Database drivers automatically escape parameters, treating them as data values rather than executable code. This is the most critical security practice for database applications.

---

### Mistake 3: Storing Passwords in Plain Text

**Incorrect:**
```sql
-- Storing passwords without hashing
CREATE TABLE users_insecure (
    id INTEGER PRIMARY KEY,
    username TEXT,
    password TEXT  -- Storing plain text passwords!
);

INSERT INTO users_insecure (username, password) VALUES ('alice', 'MySecret123!');

-- Anyone with database access can see all passwords:
SELECT username, password FROM users_insecure;
-- alice | MySecret123!
-- bob   | Password456!
```

**Why it happens:** Developers may not understand password security or prioritize convenience over security. Plain text storage violates security principles and compliance requirements (GDPR, HIPAA, PCI-DSS).

**Corrected:**
```sql
-- Store only password hashes
CREATE TABLE users_secure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,  -- Store hash, not password
    salt TEXT,                     -- Random salt per user
    failed_logins INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login TIMESTAMP
);

-- Application handles hashing (pseudocode):
-- password_hash = bcrypt.hashpw(user_password, bcrypt.gensalt())
-- INSERT INTO users_secure (username, password_hash) VALUES (?, ?)

-- Verify login (pseudocode):
-- stored_hash = SELECT password_hash FROM users_secure WHERE username = ?
-- if bcrypt.checkpw(input_password, stored_hash):
--     login_success()
-- else:
--     increment_failed_logins()

-- Additional security columns
ALTER TABLE users_secure ADD COLUMN password_changed_at TIMESTAMP;
ALTER TABLE users_secure ADD COLUMN must_change_password BOOLEAN DEFAULT 0;

-- Enforce password expiration via application logic
SELECT username FROM users_secure 
WHERE password_changed_at < DATE('now', '-90 days');
```

💡 **Key Takeaway:** Never store passwords in plain text or reversible encryption. Use strong hashing algorithms (bcrypt, Argon2, PBKDF2) with unique salts per user. Implement account lockout after failed attempts and password expiration policies. Consider adding MFA (multi-factor authentication) for sensitive accounts.

---

*Content generated for SQL-Adapt Learning Platform*
