#!/usr/bin/env node
/**
 * SQL Problem Content Audit Script
 * 
 * Audits all 32 SQL problems against their seeded schema/data to verify expected results.
 * Uses sql.js to execute queries and compare actual vs expected results.
 */

import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

// SQLProblem type definition (minimal for this script)
interface SQLProblem {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  concepts: string[];
  schema: string;
  expectedQuery: string;
  expectedResult?: any[];
  gradingMode?: 'result' | 'exec-only';
  hints?: string[];
}

// Audit result types
interface ProblemAuditResult {
  problemId: string;
  title: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  matchType?: 'exact' | 'row-count-mismatch' | 'value-mismatch' | 'column-mismatch' | 'order-mismatch';
  mismatchCategory?: 
    | 'wrong-expected-numeric-value'
    | 'wrong-ordering-assumption'
    | 'wrong-row-count'
    | 'schema-data-mismatch'
    | 'alias-mismatch'
    | 'missing-expected-result'
    | 'query-execution-error'
    | 'unknown';
  expectedRowCount?: number;
  actualRowCount?: number;
  expectedResult?: any[];
  actualResult?: any[];
  differences?: string[];
  errorMessage?: string;
  queryExecutionTimeMs?: number;
}

interface AuditReport {
  generatedAt: string;
  totalProblems: number;
  passed: number;
  failed: number;
  errors: number;
  summary: {
    byCategory: Record<string, number>;
    byMismatchType: Record<string, number>;
  };
  results: ProblemAuditResult[];
}

// Schema definitions (copied from problems.ts for standalone execution)
const usersPracticeSchema = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT,
  age INTEGER,
  city TEXT
);

INSERT INTO users VALUES (1, 'Alice', 'alice@email.com', 25, 'Seattle');
INSERT INTO users VALUES (2, 'Bob', 'bob@email.com', 30, 'Portland');
INSERT INTO users VALUES (3, 'Charlie', 'charlie@email.com', 22, 'Seattle');
INSERT INTO users VALUES (4, 'Diana', 'diana@email.com', 28, 'San Jose');
INSERT INTO users VALUES (5, 'Evan', 'evan@email.com', 35, 'Portland');`;

const usersOrdersPracticeSchema = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  city TEXT
);

CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  user_id INTEGER,
  product TEXT,
  amount REAL
);

INSERT INTO users VALUES (1, 'Alice', 'Seattle');
INSERT INTO users VALUES (2, 'Bob', 'Portland');
INSERT INTO users VALUES (3, 'Charlie', 'Seattle');
INSERT INTO users VALUES (4, 'Diana', 'San Jose');

INSERT INTO orders VALUES (101, 1, 'Laptop', 999.99);
INSERT INTO orders VALUES (102, 1, 'Mouse', 29.99);
INSERT INTO orders VALUES (103, 2, 'Keyboard', 79.99);
INSERT INTO orders VALUES (104, 2, 'Monitor', 219.99);
INSERT INTO orders VALUES (105, 4, 'Laptop', 1099.00);
INSERT INTO orders VALUES (106, 4, 'Mouse', 24.99);`;

const productsPracticeSchema = `CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category TEXT,
  price REAL
);

INSERT INTO products VALUES (1, 'Laptop', 'Electronics', 999.99);
INSERT INTO products VALUES (2, 'Mouse', 'Electronics', 29.99);
INSERT INTO products VALUES (3, 'Keyboard', 'Electronics', 79.99);
INSERT INTO products VALUES (4, 'Desk', 'Furniture', 299.99);
INSERT INTO products VALUES (5, 'Chair', 'Furniture', 199.99);
INSERT INTO products VALUES (6, 'Lamp', 'Home', 49.99);`;

const employeesDepartmentsSchema = `CREATE TABLE departments (
  dept_id INTEGER PRIMARY KEY,
  dept_name TEXT
);

CREATE TABLE employees (
  emp_id INTEGER PRIMARY KEY,
  emp_name TEXT,
  salary REAL,
  dept_id INTEGER,
  manager_id INTEGER,
  hire_date TEXT
);

INSERT INTO departments VALUES (1, 'Engineering');
INSERT INTO departments VALUES (2, 'Sales');
INSERT INTO departments VALUES (3, 'Marketing');
INSERT INTO departments VALUES (4, 'HR');

INSERT INTO employees VALUES (1, 'Alice', 90000, 1, NULL, '2020-01-15');
INSERT INTO employees VALUES (2, 'Bob', 75000, 1, 1, '2021-03-20');
INSERT INTO employees VALUES (3, 'Carol', 80000, 2, NULL, '2019-06-10');
INSERT INTO employees VALUES (4, 'David', 65000, 2, 3, '2022-01-05');
INSERT INTO employees VALUES (5, 'Eve', 70000, 3, NULL, '2021-09-15');
INSERT INTO employees VALUES (6, 'Frank', 55000, 4, NULL, '2023-02-28');`;

const tasksSchema = `CREATE TABLE tasks (
  task_id INTEGER PRIMARY KEY,
  task_name TEXT,
  status TEXT,
  priority INTEGER,
  due_date TEXT
);

INSERT INTO tasks VALUES (1, 'Fix login bug', 'completed', 1, '2024-01-15');
INSERT INTO tasks VALUES (2, 'Update documentation', 'pending', 2, '2024-01-20');
INSERT INTO tasks VALUES (3, 'Code review', 'in_progress', 1, '2024-01-18');
INSERT INTO tasks VALUES (4, 'Deploy to prod', 'pending', 3, '2024-01-25');
INSERT INTO tasks VALUES (5, 'Write tests', NULL, NULL, '2024-01-22');`;

const salesSchema = `CREATE TABLE sales (
  sale_id INTEGER PRIMARY KEY,
  region TEXT,
  product TEXT,
  amount REAL,
  sale_date TEXT
);

INSERT INTO sales VALUES (1, 'North', 'Widget', 1000.00, '2024-01-10');
INSERT INTO sales VALUES (2, 'South', 'Gadget', 1500.00, '2024-01-12');
INSERT INTO sales VALUES (3, 'North', 'Gadget', 800.00, '2024-01-15');
INSERT INTO sales VALUES (4, 'East', 'Widget', 1200.00, '2024-01-11');
INSERT INTO sales VALUES (5, 'South', 'Widget', 900.00, '2024-01-14');
INSERT INTO sales VALUES (6, 'West', 'Gadget', 1100.00, '2024-01-16');`;

// Problem definitions (all 32 problems)
const sqlProblems: SQLProblem[] = [
  {
    id: 'problem-1',
    title: 'Select All Users',
    description: 'Write a query to select all columns from the users table.',
    difficulty: 'beginner',
    concepts: ['select-basic'],
    schema: `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT,
  age INTEGER
);

INSERT INTO users VALUES (1, 'Alice', 'alice@email.com', 25);
INSERT INTO users VALUES (2, 'Bob', 'bob@email.com', 30);
INSERT INTO users VALUES (3, 'Charlie', 'charlie@email.com', 22);`,
    expectedQuery: 'SELECT * FROM users;',
    expectedResult: [
      { id: 1, name: 'Alice', email: 'alice@email.com', age: 25 },
      { id: 2, name: 'Bob', email: 'bob@email.com', age: 30 },
      { id: 3, name: 'Charlie', email: 'charlie@email.com', age: 22 }
    ]
  },
  {
    id: 'problem-2',
    title: 'Filter Users by Age',
    description: 'Select all users who are older than 24 years.',
    difficulty: 'beginner',
    concepts: ['select-basic', 'where-clause'],
    schema: `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT,
  age INTEGER
);

INSERT INTO users VALUES (1, 'Alice', 'alice@email.com', 25);
INSERT INTO users VALUES (2, 'Bob', 'bob@email.com', 30);
INSERT INTO users VALUES (3, 'Charlie', 'charlie@email.com', 22);`,
    expectedQuery: 'SELECT * FROM users WHERE age > 24;',
    expectedResult: [
      { id: 1, name: 'Alice', email: 'alice@email.com', age: 25 },
      { id: 2, name: 'Bob', email: 'bob@email.com', age: 30 }
    ]
  },
  {
    id: 'problem-3',
    title: 'Join Users and Orders',
    description: 'Write a query to show user names and their order IDs by joining the users and orders tables.',
    difficulty: 'intermediate',
    concepts: ['select-basic', 'joins'],
    schema: `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT
);

CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  user_id INTEGER,
  product TEXT,
  amount REAL
);

INSERT INTO users VALUES (1, 'Alice', 'alice@email.com');
INSERT INTO users VALUES (2, 'Bob', 'bob@email.com');

INSERT INTO orders VALUES (101, 1, 'Laptop', 999.99);
INSERT INTO orders VALUES (102, 1, 'Mouse', 29.99);
INSERT INTO orders VALUES (103, 2, 'Keyboard', 79.99);`,
    expectedQuery: 'SELECT u.name, o.order_id FROM users u JOIN orders o ON u.id = o.user_id;',
    expectedResult: [
      { name: 'Alice', order_id: 101 },
      { name: 'Alice', order_id: 102 },
      { name: 'Bob', order_id: 103 }
    ]
  },
  {
    id: 'problem-4',
    title: 'Count Orders by User',
    description: 'Count how many orders each user has placed. Show user name and order count.',
    difficulty: 'intermediate',
    concepts: ['joins', 'aggregation'],
    schema: `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT
);

CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  user_id INTEGER,
  product TEXT
);

INSERT INTO users VALUES (1, 'Alice');
INSERT INTO users VALUES (2, 'Bob');
INSERT INTO users VALUES (3, 'Charlie');

INSERT INTO orders VALUES (101, 1, 'Laptop');
INSERT INTO orders VALUES (102, 1, 'Mouse');
INSERT INTO orders VALUES (103, 2, 'Keyboard');`,
    expectedQuery: 'SELECT u.name, COUNT(o.order_id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.name;',
    expectedResult: [
      { name: 'Alice', order_count: 2 },
      { name: 'Bob', order_count: 1 },
      { name: 'Charlie', order_count: 0 }
    ]
  },
  {
    id: 'problem-5',
    title: 'Average Product Price',
    description: 'Calculate the average price for each product category.',
    difficulty: 'intermediate',
    concepts: ['select-basic', 'aggregation'],
    schema: `CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category TEXT,
  price REAL
);

INSERT INTO products VALUES (1, 'Laptop', 'Electronics', 999.99);
INSERT INTO products VALUES (2, 'Mouse', 'Electronics', 29.99);
INSERT INTO products VALUES (3, 'Desk', 'Furniture', 299.99);
INSERT INTO products VALUES (4, 'Chair', 'Furniture', 199.99);`,
    expectedQuery: 'SELECT category, AVG(price) as avg_price FROM products GROUP BY category;',
    expectedResult: [
      { category: 'Electronics', avg_price: 514.99 },
      { category: 'Furniture', avg_price: 249.99 }
    ]
  },
  {
    id: 'problem-6',
    title: 'Order Users by Age',
    description: 'Return user names and ages ordered from oldest to youngest.',
    difficulty: 'beginner',
    concepts: ['select-basic', 'order-by'],
    schema: usersPracticeSchema,
    expectedQuery: 'SELECT name, age FROM users ORDER BY age DESC;',
    expectedResult: [
      { name: 'Evan', age: 35 },
      { name: 'Bob', age: 30 },
      { name: 'Diana', age: 28 },
      { name: 'Alice', age: 25 },
      { name: 'Charlie', age: 22 }
    ]
  },
  {
    id: 'problem-7',
    title: 'List Distinct User Cities',
    description: 'Show each city exactly once from the users table.',
    difficulty: 'beginner',
    concepts: ['select-basic'],
    schema: usersPracticeSchema,
    expectedQuery: 'SELECT DISTINCT city FROM users;',
    expectedResult: [
      { city: 'Seattle' },
      { city: 'Portland' },
      { city: 'San Jose' }
    ]
  },
  {
    id: 'problem-8',
    title: 'Wildcard Selection',
    description: 'Use wildcard selection to return every column from users.',
    difficulty: 'beginner',
    concepts: ['select-basic'],
    schema: usersPracticeSchema,
    expectedQuery: 'SELECT * FROM users;',
    expectedResult: [
      { id: 1, name: 'Alice', email: 'alice@email.com', age: 25, city: 'Seattle' },
      { id: 2, name: 'Bob', email: 'bob@email.com', age: 30, city: 'Portland' },
      { id: 3, name: 'Charlie', email: 'charlie@email.com', age: 22, city: 'Seattle' },
      { id: 4, name: 'Diana', email: 'diana@email.com', age: 28, city: 'San Jose' },
      { id: 5, name: 'Evan', email: 'evan@email.com', age: 35, city: 'Portland' }
    ]
  },
  {
    id: 'problem-9',
    title: 'Explicit Column Selection',
    description: 'Return only name and email from users using explicit columns.',
    difficulty: 'beginner',
    concepts: ['select-basic'],
    schema: usersPracticeSchema,
    expectedQuery: 'SELECT name, email FROM users;',
    expectedResult: [
      { name: 'Alice', email: 'alice@email.com' },
      { name: 'Bob', email: 'bob@email.com' },
      { name: 'Charlie', email: 'charlie@email.com' },
      { name: 'Diana', email: 'diana@email.com' },
      { name: 'Evan', email: 'evan@email.com' }
    ]
  },
  {
    id: 'problem-10',
    title: 'Users With Orders (IN Subquery)',
    description: 'Find user names where the user id appears in the orders table.',
    difficulty: 'intermediate',
    concepts: ['subqueries', 'where-clause'],
    schema: usersOrdersPracticeSchema,
    expectedQuery: 'SELECT name FROM users WHERE id IN (SELECT user_id FROM orders);',
    expectedResult: [
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Diana' }
    ]
  },
  {
    id: 'problem-11',
    title: 'Users With High-Value Orders',
    description: 'Find users that have at least one order over 200 using IN.',
    difficulty: 'intermediate',
    concepts: ['subqueries', 'where-clause'],
    schema: usersOrdersPracticeSchema,
    expectedQuery: 'SELECT name FROM users WHERE id IN (SELECT user_id FROM orders WHERE amount > 200);',
    expectedResult: [
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Diana' }
    ]
  },
  {
    id: 'problem-12',
    title: 'Order Count per User With HAVING',
    description: 'Show user_id values with two or more orders.',
    difficulty: 'intermediate',
    concepts: ['aggregation'],
    schema: usersOrdersPracticeSchema,
    expectedQuery: 'SELECT user_id, COUNT(*) AS order_count FROM orders GROUP BY user_id HAVING COUNT(*) >= 2;',
    expectedResult: [
      { user_id: 1, order_count: 2 },
      { user_id: 2, order_count: 2 },
      { user_id: 4, order_count: 2 }
    ]
  },
  {
    id: 'problem-13',
    title: 'High-Value Categories',
    description: 'Show categories whose average product price is over 200.',
    difficulty: 'intermediate',
    concepts: ['aggregation'],
    schema: productsPracticeSchema,
    expectedQuery: 'SELECT category, AVG(price) AS avg_price FROM products GROUP BY category HAVING AVG(price) > 200;',
    expectedResult: [
      { category: 'Electronics', avg_price: 369.99 },
      { category: 'Furniture', avg_price: 249.99 }
    ]
  },
  {
    id: 'problem-14',
    title: 'Distinct Product Names A-Z',
    description: 'Return distinct product names ordered alphabetically.',
    difficulty: 'beginner',
    concepts: ['select-basic', 'order-by'],
    schema: usersOrdersPracticeSchema,
    expectedQuery: 'SELECT DISTINCT product FROM orders ORDER BY product;',
    expectedResult: [
      { product: 'Keyboard' },
      { product: 'Laptop' },
      { product: 'Monitor' },
      { product: 'Mouse' }
    ]
  },
  {
    id: 'problem-15',
    title: 'Top Three Priced Products',
    description: 'List the top 3 most expensive products by price.',
    difficulty: 'intermediate',
    concepts: ['order-by'],
    schema: productsPracticeSchema,
    expectedQuery: 'SELECT name, price FROM products ORDER BY price DESC LIMIT 3;',
    expectedResult: [
      { name: 'Laptop', price: 999.99 },
      { name: 'Desk', price: 299.99 },
      { name: 'Chair', price: 199.99 }
    ]
  },
  {
    id: 'problem-16',
    title: 'Join and Sort Orders',
    description: 'Join users and orders and show results sorted by amount descending.',
    difficulty: 'intermediate',
    concepts: ['joins', 'order-by'],
    schema: usersOrdersPracticeSchema,
    expectedQuery: 'SELECT u.name, o.product, o.amount FROM users u JOIN orders o ON u.id = o.user_id ORDER BY o.amount DESC;',
    expectedResult: [
      { name: 'Diana', product: 'Laptop', amount: 1099.00 },
      { name: 'Alice', product: 'Laptop', amount: 999.99 },
      { name: 'Bob', product: 'Monitor', amount: 219.99 },
      { name: 'Bob', product: 'Keyboard', amount: 79.99 },
      { name: 'Alice', product: 'Mouse', amount: 29.99 },
      { name: 'Diana', product: 'Mouse', amount: 24.99 }
    ]
  },
  {
    id: 'problem-17',
    title: 'Categories With Multiple Products',
    description: 'Find categories that contain at least two products.',
    difficulty: 'intermediate',
    concepts: ['aggregation'],
    schema: productsPracticeSchema,
    expectedQuery: 'SELECT category, COUNT(*) AS product_count FROM products GROUP BY category HAVING COUNT(*) >= 2;',
    expectedResult: [
      { category: 'Electronics', product_count: 3 },
      { category: 'Furniture', product_count: 2 }
    ]
  },
  {
    id: 'problem-18',
    title: 'Insert New User',
    description: 'Insert a new user with id=6, name=Frank, email=frank@email.com, age=40, city=Austin.',
    difficulty: 'beginner',
    concepts: ['insert'],
    schema: usersPracticeSchema,
    expectedQuery: "INSERT INTO users VALUES (6, 'Frank', 'frank@email.com', 40, 'Austin');",
    expectedResult: []
  },
  {
    id: 'problem-19',
    title: 'Update User Age',
    description: "Update Alice's age to 26.",
    difficulty: 'beginner',
    concepts: ['update', 'where-clause'],
    schema: usersPracticeSchema,
    expectedQuery: "UPDATE users SET age = 26 WHERE name = 'Alice';",
    expectedResult: []
  },
  {
    id: 'problem-20',
    title: 'Delete Users by City',
    description: 'Delete all users from Portland.',
    difficulty: 'beginner',
    concepts: ['delete', 'where-clause'],
    schema: usersPracticeSchema,
    expectedQuery: "DELETE FROM users WHERE city = 'Portland';",
    expectedResult: []
  },
  {
    id: 'problem-21',
    title: 'Salary Grade Classification',
    description: 'Show employee names with salary grade: High (>=80000), Medium (50000-79999), Low (<50000).',
    difficulty: 'intermediate',
    concepts: ['case-expressions', 'select-basic'],
    schema: employeesDepartmentsSchema,
    expectedQuery: "SELECT emp_name, CASE WHEN salary >= 80000 THEN 'High' WHEN salary >= 50000 THEN 'Medium' ELSE 'Low' END AS salary_grade FROM employees;",
    expectedResult: [
      { emp_name: 'Alice', salary_grade: 'High' },
      { emp_name: 'Bob', salary_grade: 'Medium' },
      { emp_name: 'Carol', salary_grade: 'High' },
      { emp_name: 'David', salary_grade: 'Medium' },
      { emp_name: 'Eve', salary_grade: 'Medium' },
      { emp_name: 'Frank', salary_grade: 'Medium' }
    ]
  },
  {
    id: 'problem-22',
    title: 'Departments With Employees (EXISTS)',
    description: 'Find department names that have at least one employee using EXISTS.',
    difficulty: 'intermediate',
    concepts: ['subqueries', 'exists'],
    schema: employeesDepartmentsSchema,
    expectedQuery: 'SELECT dept_name FROM departments d WHERE EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.dept_id);',
    expectedResult: [
      { dept_name: 'Engineering' },
      { dept_name: 'Sales' },
      { dept_name: 'Marketing' },
      { dept_name: 'HR' }
    ]
  },
  {
    id: 'problem-23',
    title: 'Employees Earning Above Department Average',
    description: 'Find employees whose salary is above their department average using a correlated subquery.',
    difficulty: 'advanced',
    concepts: ['subqueries', 'correlated-subqueries'],
    schema: employeesDepartmentsSchema,
    expectedQuery: 'SELECT emp_name, salary FROM employees e WHERE salary > (SELECT AVG(salary) FROM employees WHERE dept_id = e.dept_id);',
    expectedResult: [
      { emp_name: 'Alice', salary: 90000 },
      { emp_name: 'Carol', salary: 80000 }
    ]
  },
  {
    id: 'problem-24',
    title: 'Top 2 Salaries Per Department',
    description: 'Find the top 2 highest paid employees in each department using ROW_NUMBER.',
    difficulty: 'advanced',
    concepts: ['window-functions', 'subqueries'],
    schema: employeesDepartmentsSchema,
    expectedQuery: 'SELECT emp_name, dept_id, salary FROM (SELECT emp_name, dept_id, salary, ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) as rn FROM employees) WHERE rn <= 2;',
    expectedResult: [
      { emp_name: 'Alice', dept_id: 1, salary: 90000 },
      { emp_name: 'Bob', dept_id: 1, salary: 75000 },
      { emp_name: 'Carol', dept_id: 2, salary: 80000 },
      { emp_name: 'David', dept_id: 2, salary: 65000 },
      { emp_name: 'Eve', dept_id: 3, salary: 70000 },
      { emp_name: 'Frank', dept_id: 4, salary: 55000 }
    ]
  },
  {
    id: 'problem-25',
    title: 'Salary Rank Across All Employees',
    description: 'Rank all employees by salary (highest first) using RANK().',
    difficulty: 'intermediate',
    concepts: ['window-functions'],
    schema: employeesDepartmentsSchema,
    expectedQuery: 'SELECT emp_name, salary, RANK() OVER (ORDER BY salary DESC) as salary_rank FROM employees;',
    expectedResult: [
      { emp_name: 'Alice', salary: 90000, salary_rank: 1 },
      { emp_name: 'Carol', salary: 80000, salary_rank: 2 },
      { emp_name: 'Bob', salary: 75000, salary_rank: 3 },
      { emp_name: 'Eve', salary: 70000, salary_rank: 4 },
      { emp_name: 'David', salary: 65000, salary_rank: 5 },
      { emp_name: 'Frank', salary: 55000, salary_rank: 6 }
    ]
  },
  {
    id: 'problem-26',
    title: 'Employee Names Uppercase',
    description: 'Return all employee names in uppercase.',
    difficulty: 'beginner',
    concepts: ['string-functions'],
    schema: employeesDepartmentsSchema,
    expectedQuery: 'SELECT UPPER(emp_name) as name_upper FROM employees;',
    expectedResult: [
      { name_upper: 'ALICE' },
      { name_upper: 'BOB' },
      { name_upper: 'CAROL' },
      { name_upper: 'DAVID' },
      { name_upper: 'EVE' },
      { name_upper: 'FRANK' }
    ]
  },
  {
    id: 'problem-27',
    title: 'Employees Hired in 2021',
    description: 'Find employees hired in the year 2021 using date functions.',
    difficulty: 'intermediate',
    concepts: ['date-functions', 'where-clause'],
    schema: employeesDepartmentsSchema,
    expectedQuery: "SELECT emp_name, hire_date FROM employees WHERE strftime('%Y', hire_date) = '2021';",
    expectedResult: [
      { emp_name: 'Bob', hire_date: '2021-03-20' },
      { emp_name: 'Eve', hire_date: '2021-09-15' }
    ]
  },
  {
    id: 'problem-28',
    title: 'Handle NULL Priorities',
    description: 'Show task names with priority, displaying 0 for NULL priorities using COALESCE.',
    difficulty: 'beginner',
    concepts: ['null-handling', 'coalesce'],
    schema: tasksSchema,
    expectedQuery: 'SELECT task_name, COALESCE(priority, 0) as effective_priority FROM tasks;',
    expectedResult: [
      { task_name: 'Fix login bug', effective_priority: 1 },
      { task_name: 'Update documentation', effective_priority: 2 },
      { task_name: 'Code review', effective_priority: 1 },
      { task_name: 'Deploy to prod', effective_priority: 3 },
      { task_name: 'Write tests', effective_priority: 0 }
    ]
  },
  {
    id: 'problem-29',
    title: 'Paginate Products',
    description: 'Return products 3-5 using LIMIT and OFFSET (skip 2, take 3).',
    difficulty: 'intermediate',
    concepts: ['pagination', 'limit-offset'],
    schema: productsPracticeSchema,
    expectedQuery: 'SELECT * FROM products LIMIT 3 OFFSET 2;',
    expectedResult: [
      { id: 3, name: 'Keyboard', category: 'Electronics', price: 79.99 },
      { id: 4, name: 'Desk', category: 'Furniture', price: 299.99 },
      { id: 5, name: 'Chair', category: 'Furniture', price: 199.99 }
    ]
  },
  {
    id: 'problem-30',
    title: 'All Regions With Sales',
    description: 'Create a unified list of all unique regions from sales using UNION.',
    difficulty: 'beginner',
    concepts: ['union'],
    schema: salesSchema,
    expectedQuery: 'SELECT region FROM sales UNION SELECT region FROM sales;',
    expectedResult: [
      { region: 'East' },
      { region: 'North' },
      { region: 'South' },
      { region: 'West' }
    ]
  },
  {
    id: 'problem-31',
    title: 'Employee Manager Pairs',
    description: 'List employee-manager pairs using a self-join on the employees table.',
    difficulty: 'intermediate',
    concepts: ['self-joins', 'joins'],
    schema: employeesDepartmentsSchema,
    expectedQuery: 'SELECT e.emp_name as employee, m.emp_name as manager FROM employees e LEFT JOIN employees m ON e.manager_id = m.emp_id;',
    expectedResult: [
      { employee: 'Alice', manager: null },
      { employee: 'Bob', manager: 'Alice' },
      { employee: 'Carol', manager: null },
      { employee: 'David', manager: 'Carol' },
      { employee: 'Eve', manager: null },
      { employee: 'Frank', manager: null }
    ]
  },
  {
    id: 'problem-32',
    title: 'Department Salary Statistics',
    description: 'For each department, show: name, employee count, total salary, and average salary.',
    difficulty: 'intermediate',
    concepts: ['joins', 'aggregation'],
    schema: employeesDepartmentsSchema,
    expectedQuery: 'SELECT d.dept_name, COUNT(e.emp_id) as emp_count, SUM(e.salary) as total_salary, AVG(e.salary) as avg_salary FROM departments d LEFT JOIN employees e ON d.dept_id = e.dept_id GROUP BY d.dept_name;',
    expectedResult: [
      { dept_name: 'Engineering', emp_count: 2, total_salary: 165000, avg_salary: 82500 },
      { dept_name: 'HR', emp_count: 1, total_salary: 55000, avg_salary: 55000 },
      { dept_name: 'Marketing', emp_count: 1, total_salary: 70000, avg_salary: 70000 },
      { dept_name: 'Sales', emp_count: 2, total_salary: 145000, avg_salary: 72500 }
    ]
  }
];

/**
 * Initialize a SQLite database with the given schema
 */
async function initializeDatabase(SQL: any, schema: string): Promise<any> {
  const db = new SQL.Database();
  const statements = schema.split(';').filter(s => s.trim().length > 0);
  
  for (const stmt of statements) {
    try {
      db.run(stmt + ';');
    } catch (e) {
      // Ignore errors from empty statements
    }
  }
  
  return db;
}

/**
 * Execute a query and return results as array of objects
 */
function executeQuery(db: any, query: string): any[] {
  const startTime = performance.now();
  const result = [];
  
  try {
    const stmt = db.prepare(query);
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
  } catch (e) {
    throw e;
  }
  
  return result;
}

/**
 * Normalize numeric values for comparison (handle floating point precision)
 */
function normalizeValue(value: any): any {
  if (typeof value === 'number') {
    // Round to 2 decimal places for comparison
    return Math.round(value * 100) / 100;
  }
  if (value === null || value === undefined) {
    return null;
  }
  return value;
}

/**
 * Compare two result sets
 */
function compareResults(expected: any[], actual: any[]): { match: boolean; differences: string[]; matchType: string } {
  const differences: string[] = [];
  
  // Check row count
  if (expected.length !== actual.length) {
    differences.push(`Row count mismatch: expected ${expected.length}, got ${actual.length}`);
    return { match: false, differences, matchType: 'row-count-mismatch' };
  }
  
  if (expected.length === 0) {
    return { match: true, differences: [], matchType: 'exact' };
  }
  
  // Check column names match
  const expectedCols = Object.keys(expected[0] || {}).sort();
  const actualCols = Object.keys(actual[0] || {}).sort();
  
  if (JSON.stringify(expectedCols) !== JSON.stringify(actualCols)) {
    differences.push(`Column mismatch: expected [${expectedCols.join(', ')}], got [${actualCols.join(', ')}]`);
    return { match: false, differences, matchType: 'column-mismatch' };
  }
  
  // Compare each row
  let hasValueMismatch = false;
  let hasOrderMismatch = false;
  
  for (let i = 0; i < expected.length; i++) {
    const expRow = expected[i];
    const actRow = actual[i];
    
    for (const col of expectedCols) {
      const expVal = normalizeValue(expRow[col]);
      const actVal = normalizeValue(actRow[col]);
      
      if (expVal !== actVal) {
        // Check if this is a numeric precision issue
        if (typeof expVal === 'number' && typeof actVal === 'number') {
          const diff = Math.abs(expVal - actVal);
          if (diff > 0.01) {
            hasValueMismatch = true;
            differences.push(`Row ${i}, column '${col}': expected ${expVal}, got ${actVal} (diff: ${diff.toFixed(4)})`);
          }
        } else {
          differences.push(`Row ${i}, column '${col}': expected ${JSON.stringify(expVal)}, got ${JSON.stringify(actVal)}`);
          if (expVal !== null && actVal !== null && String(expVal).toLowerCase() !== String(actVal).toLowerCase()) {
            hasValueMismatch = true;
          }
        }
      }
    }
  }
  
  // Check if values match but order might be different
  if (hasValueMismatch) {
    // Try to see if it's just an ordering issue
    const expectedSorted = [...expected].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const actualSorted = [...actual].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    
    let sortedMatch = true;
    for (let i = 0; i < expectedSorted.length; i++) {
      for (const col of expectedCols) {
        if (normalizeValue(expectedSorted[i][col]) !== normalizeValue(actualSorted[i][col])) {
          sortedMatch = false;
          break;
        }
      }
      if (!sortedMatch) break;
    }
    
    if (sortedMatch) {
      return { match: false, differences, matchType: 'order-mismatch' };
    }
  }
  
  if (differences.length === 0) {
    return { match: true, differences: [], matchType: 'exact' };
  }
  
  return { match: false, differences, matchType: hasValueMismatch ? 'value-mismatch' : 'unknown' };
}

/**
 * Determine mismatch category based on differences
 */
function categorizeMismatch(problem: SQLProblem, comparison: any): string {
  const { differences, matchType } = comparison;
  
  if (matchType === 'row-count-mismatch') {
    return 'wrong-row-count';
  }
  
  if (matchType === 'order-mismatch') {
    return 'wrong-ordering-assumption';
  }
  
  if (matchType === 'column-mismatch') {
    return 'alias-mismatch';
  }
  
  // Check for numeric value issues
  for (const diff of differences) {
    if (diff.includes('diff:')) {
      return 'wrong-expected-numeric-value';
    }
  }
  
  return 'unknown';
}

/**
 * Audit a single problem
 */
async function auditProblem(SQL: any, problem: SQLProblem): Promise<ProblemAuditResult> {
  const startTime = performance.now();
  
  try {
    // Initialize database with schema
    const db = await initializeDatabase(SQL, problem.schema);
    
    // Execute the expected query
    let actualResult: any[];
    try {
      actualResult = executeQuery(db, problem.expectedQuery);
    } catch (e: any) {
      db.close();
      return {
        problemId: problem.id,
        title: problem.title,
        status: 'ERROR',
        errorMessage: `Query execution failed: ${e.message}`,
        mismatchCategory: 'query-execution-error',
        queryExecutionTimeMs: performance.now() - startTime
      };
    }
    
    db.close();
    
    // Check if expected result exists
    if (!problem.expectedResult) {
      return {
        problemId: problem.id,
        title: problem.title,
        status: 'FAIL',
        mismatchCategory: 'missing-expected-result',
        actualRowCount: actualResult.length,
        actualResult: actualResult.slice(0, 10), // Limit output
        queryExecutionTimeMs: performance.now() - startTime
      };
    }
    
    // Compare results
    const comparison = compareResults(problem.expectedResult, actualResult);
    
    if (comparison.match) {
      return {
        problemId: problem.id,
        title: problem.title,
        status: 'PASS',
        matchType: 'exact',
        expectedRowCount: problem.expectedResult.length,
        actualRowCount: actualResult.length,
        queryExecutionTimeMs: performance.now() - startTime
      };
    } else {
      return {
        problemId: problem.id,
        title: problem.title,
        status: 'FAIL',
        matchType: comparison.matchType as any,
        mismatchCategory: categorizeMismatch(problem, comparison),
        expectedRowCount: problem.expectedResult.length,
        actualRowCount: actualResult.length,
        expectedResult: problem.expectedResult,
        actualResult: actualResult,
        differences: comparison.differences,
        queryExecutionTimeMs: performance.now() - startTime
      };
    }
  } catch (e: any) {
    return {
      problemId: problem.id,
      title: problem.title,
      status: 'ERROR',
      errorMessage: e.message,
      queryExecutionTimeMs: performance.now() - startTime
    };
  }
}

/**
 * Main audit function
 */
async function runAudit(): Promise<void> {
  console.log('Starting SQL Problem Content Audit...\n');
  
  // Initialize sql.js
  const SQL = await initSqlJs({});
  
  const results: ProblemAuditResult[] = [];
  let passed = 0;
  let failed = 0;
  let errors = 0;
  
  // Audit each problem
  for (const problem of sqlProblems) {
    process.stdout.write(`Auditing ${problem.id}: ${problem.title}... `);
    const result = await auditProblem(SQL, problem);
    results.push(result);
    
    if (result.status === 'PASS') {
      passed++;
      console.log('✓ PASS');
    } else if (result.status === 'FAIL') {
      failed++;
      console.log(`✗ FAIL (${result.mismatchCategory})`);
    } else {
      errors++;
      console.log(`✗ ERROR: ${result.errorMessage}`);
    }
  }
  
  // Calculate summary stats
  const byCategory: Record<string, number> = {};
  const byMismatchType: Record<string, number> = {};
  
  for (const r of results) {
    if (r.mismatchCategory) {
      byCategory[r.mismatchCategory] = (byCategory[r.mismatchCategory] || 0) + 1;
    }
    if (r.matchType) {
      byMismatchType[r.matchType] = (byMismatchType[r.matchType] || 0) + 1;
    }
  }
  
  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    totalProblems: sqlProblems.length,
    passed,
    failed,
    errors,
    summary: {
      byCategory,
      byMismatchType
    },
    results
  };
  
  // Write report to file
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  const reportPath = path.join(docsDir, 'PROBLEM_CONTENT_AUDIT.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Problems: ${sqlProblems.length}`);
  console.log(`Passed:         ${passed}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Errors:         ${errors}`);
  console.log(`\nReport written to: ${reportPath}`);
  
  if (failed > 0 || errors > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('FAILED/ERROR DETAILS:');
    console.log('-'.repeat(60));
    for (const r of results) {
      if (r.status !== 'PASS') {
        console.log(`\n${r.problemId}: ${r.title}`);
        console.log(`  Status: ${r.status}`);
        if (r.mismatchCategory) {
          console.log(`  Category: ${r.mismatchCategory}`);
        }
        if (r.errorMessage) {
          console.log(`  Error: ${r.errorMessage}`);
        }
        if (r.differences && r.differences.length > 0) {
          console.log('  Differences:');
          for (const diff of r.differences.slice(0, 5)) {
            console.log(`    - ${diff}`);
          }
          if (r.differences.length > 5) {
            console.log(`    ... and ${r.differences.length - 5} more`);
          }
        }
      }
    }
  }
  
  // Special attention to problem-13
  console.log('\n' + '='.repeat(60));
  console.log('SPECIAL ATTENTION: Problem-13 (High-Value Categories)');
  console.log('='.repeat(60));
  const p13Result = results.find(r => r.problemId === 'problem-13');
  if (p13Result) {
    console.log(`Status: ${p13Result.status}`);
    if (p13Result.status === 'FAIL') {
      console.log(`Expected: ${JSON.stringify(p13Result.expectedResult, null, 2)}`);
      console.log(`Actual:   ${JSON.stringify(p13Result.actualResult, null, 2)}`);
    }
  }
}

// Run the audit
runAudit().catch(console.error);
