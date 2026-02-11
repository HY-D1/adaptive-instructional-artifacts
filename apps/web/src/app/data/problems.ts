import { SQLProblem } from '../types';

export const sqlProblems: SQLProblem[] = [
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
    ],
    hints: [
      'Use SELECT to retrieve data',
      'Use * to select all columns',
      'Specify the table name after FROM'
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
  }
];

export function getProblemById(id: string): SQLProblem | undefined {
  return sqlProblems.find(p => p.id === id);
}

export function getProblemsByDifficulty(difficulty: string): SQLProblem[] {
  return sqlProblems.filter(p => p.difficulty === difficulty);
}
