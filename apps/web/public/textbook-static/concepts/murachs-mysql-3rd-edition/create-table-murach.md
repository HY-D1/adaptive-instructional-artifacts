---
id: create-table-murach
title: Creating Tables
definition: Defining a new table with CREATE TABLE, naming its columns, data types, and constraints
difficulty: beginner
estimatedReadTime: 4
pageReferences: [280, 281, 282, 283, 284]
tags:
  - sql
  - ddl
  - create-table
  - mysql
sourceDocId: murachs-mysql-3rd-edition
---

# Creating Tables

## Definition
CREATE TABLE defines a new table by naming each column, the type of value it stores, and the constraints the database should enforce on it.

## Explanation
A table definition is a contract. Every column declares what it may contain, and the database rejects anything that violates the declaration, so bad data is stopped on the way in rather than discovered later in a report.

Each column needs a name and a data type. Whole numbers use INT, decimal values use DECIMAL with a stated precision and scale, short text uses VARCHAR with a maximum length, longer text uses TEXT, and dates and timestamps have their own types. Choosing precisely matters: money stored in a floating-point type accumulates small rounding errors, which is why DECIMAL exists.

Constraints capture the rules a column must obey. NOT NULL demands a value, UNIQUE forbids duplicates, DEFAULT supplies a value when none is given, PRIMARY KEY identifies the row, and FOREIGN KEY ties the value to a row in another table. A CHECK constraint expresses anything else, such as insisting a price is not negative. Declaring these in the schema is more reliable than enforcing them in application code, because the database applies them to every writer.

Note one difference between this textbook and the practice editor. Murach teaches MySQL, where an auto-numbering key is written AUTO_INCREMENT. The practice editor runs SQLite, which spells the same idea differently: an INTEGER PRIMARY KEY column fills itself in automatically, and the optional keyword is AUTOINCREMENT with no underscore. SQLite also accepts VARCHAR without enforcing the length. When an example here does not run in the editor, a dialect difference is usually the reason.

## Examples
### Define a table with types and constraints
```sql
CREATE TABLE products (
  product_id   INT            NOT NULL AUTO_INCREMENT,
  product_name VARCHAR(100)   NOT NULL,
  category     VARCHAR(50),
  price        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  PRIMARY KEY (product_id)
);
```
Prices use DECIMAL so amounts stay exact, and the key numbers itself as rows are inserted.

### Link a table to another
```sql
CREATE TABLE order_items (
  item_id    INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  quantity   INT NOT NULL DEFAULT 1,
  PRIMARY KEY (item_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);
```
The foreign key guarantees every item refers to a product that exists.

### The same table in the practice editor's dialect
```sql
CREATE TABLE products (
  product_id   INTEGER PRIMARY KEY,
  product_name TEXT NOT NULL,
  category     TEXT,
  price        REAL NOT NULL DEFAULT 0.0
);
```
SQLite auto-numbers an INTEGER PRIMARY KEY without AUTO_INCREMENT, and uses REAL where MySQL uses DECIMAL.

## Common Mistakes
### Storing money in a floating-point type
❌ Incorrect
```sql
CREATE TABLE products (
  product_id INT PRIMARY KEY,
  price      FLOAT
);
```
✅ Correct
```sql
CREATE TABLE products (
  product_id INT PRIMARY KEY,
  price      DECIMAL(10,2)
);
```
💡 Why it happens: Floating-point types cannot represent every decimal exactly, so totals drift by fractions of a cent. DECIMAL stores the value precisely.

### Allowing NULL where a value is required
❌ Incorrect
```sql
CREATE TABLE products (
  product_id   INT PRIMARY KEY,
  product_name VARCHAR(100)
);
```
✅ Correct
```sql
CREATE TABLE products (
  product_id   INT PRIMARY KEY,
  product_name VARCHAR(100) NOT NULL
);
```
💡 Why it happens: Columns permit NULL unless told otherwise, so a nameless product can be inserted. Add NOT NULL to anything the application always expects.

### Carrying MySQL auto-increment syntax into the practice editor
❌ Incorrect
```sql
CREATE TABLE products (
  product_id INTEGER PRIMARY KEY AUTO_INCREMENT,
  product_name TEXT
);
```
✅ Correct
```sql
CREATE TABLE products (
  product_id INTEGER PRIMARY KEY,
  product_name TEXT
);
```
💡 Why it happens: AUTO_INCREMENT is MySQL syntax. SQLite numbers an INTEGER PRIMARY KEY automatically and spells the optional keyword AUTOINCREMENT.
