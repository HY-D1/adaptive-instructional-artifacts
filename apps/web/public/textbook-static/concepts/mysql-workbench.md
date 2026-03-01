# Using MySQL Workbench

🟡 **Difficulty:** Intermediate  
⏱️ **Estimated Time:** 20 minutes

## Learning Objectives

- Understand what MySQL Workbench is and when to use it
- Learn how to connect to a database server
- Execute SQL queries and view results
- Use the visual tools for database design

## What is This?

**MySQL Workbench** is a visual database design and administration tool for MySQL databases.

It provides a graphical interface for tasks that would otherwise require command-line commands. You can design database schemas, write and execute SQL queries with syntax highlighting, manage user permissions, and import/export data—all through a point-and-click interface. It's ideal for developers who prefer GUIs over command-line tools and need to visualize relationships between tables.

## Examples

### Example 1: Connecting to a Database Server

**Difficulty:** Beginner

**Scenario:** You need to connect to a MySQL database server to start working with your data.

**Steps:**

1. **Open MySQL Workbench** - Launch the application

2. **Create a New Connection:**
   - Click the `+` icon next to "MySQL Connections"

3. **Configure Connection Settings:**
   ```
   Connection Name: Local Development Server
   Hostname: 127.0.0.1 (or localhost)
   Port: 3306 (default MySQL port)
   Username: root (or your username)
   Password: [Click "Store in Keychain" to save]
   ```

4. **Test Connection:**
   - Click "Test Connection" button
   - If successful: "Successfully made the MySQL connection"

5. **Connect:**
   - Click the connection box on the home screen

**Explanation:** The connection dialog asks for the server's network location (hostname/port) and your authentication credentials. Testing first ensures you can reach the server before saving.

### Example 2: Executing SQL Queries

**Difficulty:** Beginner

**Scenario:** Run a SQL query to see all users in your database.

**Steps:**

1. **Open a Query Tab:**
   - Click the SQL icon in the toolbar

2. **Select a Database:**
   - Look at the "SCHEMAS" panel on the left
   - Double-click your database name

3. **Write Your Query:**
   ```sql
   SELECT id, name, email, age, city 
   FROM users 
   WHERE age > 25
   ORDER BY name;
   ```

4. **Execute the Query:**
   - Click the lightning bolt icon ⚡
   - Results appear in the "Result" tab below

**Explanation:** The query editor provides syntax highlighting, auto-completion, and error highlighting. Results are displayed in a sortable grid.

### Example 3: Visual Schema Design (EER Diagram)

**Difficulty:** Intermediate

**Scenario:** Design a new database schema visually instead of writing CREATE TABLE statements.

**Steps:**

1. **Create New Model:**
   - File → New Model
   - The "Model" tab opens with an empty canvas

2. **Add Tables:**
   - Click the "Table" icon in the left toolbar
   - Click on the canvas where you want the table
   - Double-click to edit columns:
   ```
   Table: users
   - id: INT, PK, AI (Primary Key, Auto Increment)
   - name: VARCHAR(100), NN (Not Null)
   - email: VARCHAR(150), NN, UQ (Unique)
   ```

3. **Create Relationships:**
   - Click the "1:N Non-Identifying Relationship" icon
   - Click the parent table, then the child table
   - Workbench automatically creates the foreign key

4. **Forward Engineer:**
   - Database → Forward Engineer
   - Generates CREATE TABLE SQL statements from your diagram

**Explanation:** EER diagrams let you design databases visually. Tables become boxes, relationships become lines, and you can see the entire schema structure at a glance.

## Common Mistakes

### Mistake 1: Forgetting to Select the Default Schema

**Incorrect Action:**
- Open a query tab
- Type: `SELECT * FROM users;`
- Execute and get error: `Error Code: 1046. No database selected`

**Why it happens:** MySQL Workbench doesn't know which database contains the `users` table unless you select a default schema or use fully qualified names.

**Corrected:**
- Method 1: Select schema from the dropdown in the toolbar
- Method 2: Use fully qualified name:
  ```sql
  SELECT * FROM mydatabase.users;
  ```

💡 **Key Takeaway:** Always check that a database is selected (shown in the dropdown) before running queries.

### Mistake 2: Accidentally Modifying Production Data

**Incorrect Action:**
- Connected to production database
- Write: `DELETE FROM users WHERE age < 18;`
- Accidentally executed partial query: `DELETE FROM users;`
- Lost all user data!

**Why it happens:** The query editor executes the statement where your cursor is. If you accidentally delete part of your query before executing, you can run unintended commands.

**Corrected - Safe Practices:**

1. **Always wrap changes in transactions:**
   ```sql
   START TRANSACTION;
   DELETE FROM users WHERE age < 18;
   -- Check results first!
   SELECT COUNT(*) FROM users WHERE age < 18; -- Should return 0
   COMMIT; -- Only if correct
   -- Or: ROLLBACK; if something went wrong
   ```

2. **Use Safe Updates Mode:**
   - Edit → Preferences → SQL Editor
   - Check "Safe Updates (rejects UPDATEs and DELETEs with no restriction)"

3. **Color-code connections:**
   - Production connections: Red color
   - Development connections: Green color

💡 **Key Takeaway:** Treat production databases with extreme caution. Use transactions for any data modification and enable Safe Updates mode.

---

## Practice Challenge

**Connect to a database and write a query to find all users from Seattle, then export the results to a CSV file.**

💡 **Hint:** Use the query editor to write your SELECT statement, then right-click the results grid and choose "Export Results."

<details>
<summary>Click to see solution steps</summary>

1. Select your database from the SCHEMAS panel
2. Open a new query tab
3. Type and execute:
   ```sql
   SELECT * FROM users WHERE city = 'Seattle';
   ```
4. Right-click the results grid
5. Select "Export Results"
6. Choose CSV format and save location

**Explanation:** This combines query writing with Workbench's data export feature.
</details>

---

*Content generated for SQL-Adapt Learning Platform*
