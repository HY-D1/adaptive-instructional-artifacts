---
id: foreign-key
title: Foreign Keys
definition: A column that references another table's primary key, keeping related rows consistent
difficulty: intermediate
estimatedReadTime: 4
pageReferences: [75, 76, 77, 78, 79]
tags:
  - sql
  - keys
  - constraints
  - relationships
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Foreign Keys

## Definition
A foreign key is a column whose values must match a primary key in another table. It records a relationship between rows and stops that relationship from pointing at something that does not exist.

## Explanation
Splitting data across tables only works if the links between them stay trustworthy. In the practice database, orders.user_id is meant to identify the person who placed each order. Declaring it a foreign key turns that intention into a rule the database enforces: an insert naming a user who does not exist is rejected instead of quietly creating an order belonging to nobody. This property is called referential integrity, and its value is that broken links become impossible rather than merely unlikely.

The constraint also governs deletion, which is where the interesting choices live. By default the database refuses to delete a row that other rows still reference, protecting you from orphaning them. ON DELETE CASCADE instead removes the dependent rows automatically, which suits data that has no meaning without its parent, such as the line items of a deleted order. ON DELETE SET NULL keeps the dependent rows but clears the link, which suits optional relationships, such as an employee whose department is dissolved. Cascade is powerful and worth using deliberately, because one statement can remove far more than it appears to.

One practical note for the practice editor: SQLite only enforces foreign keys when the connection has switched them on, so a constraint that would be rejected on a server database may be accepted here. Treat the declaration as documentation of intent that most production databases will enforce strictly.

## Examples
### Declare the relationship
```sql
CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  product TEXT,
  amount REAL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```
Every order must name a user that exists in the users table.

### Remove dependent rows automatically
```sql
CREATE TABLE order_items (
  item_id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);
```
Deleting an order deletes its items too, because an item has no meaning on its own.

### Follow the link in a query
```sql
SELECT users.name, orders.product
FROM orders
INNER JOIN users ON orders.user_id = users.id;
```
The foreign key is what makes this join meaningful: each user_id is guaranteed to match a real user.

## Common Mistakes
### Inserting a reference to a row that does not exist
❌ Incorrect
```sql
INSERT INTO orders (order_id, user_id, product, amount)
VALUES (107, 99, 'Desk', 299.99);
```
✅ Correct
```sql
INSERT INTO orders (order_id, user_id, product, amount)
VALUES (107, 3, 'Desk', 299.99);
```
💡 Why it happens: There is no user with id 99, so the order would reference nothing. Insert the parent row first, or reference one that already exists.

### Deleting a parent while children still reference it
❌ Incorrect
```sql
DELETE FROM users WHERE id = 1;
```
✅ Correct
```sql
DELETE FROM orders WHERE user_id = 1;
DELETE FROM users WHERE id = 1;
```
💡 Why it happens: Alice still has orders pointing at her, so the delete is refused unless the constraint declares CASCADE. Remove the dependent rows first, or design the cascade deliberately.

### Pointing a foreign key at a non-unique column
❌ Incorrect
```sql
CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  user_name TEXT REFERENCES users(name)
);
```
✅ Correct
```sql
CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id)
);
```
💡 Why it happens: A foreign key must reference a column guaranteed unique. Two users can share a name, so the reference would be ambiguous.
