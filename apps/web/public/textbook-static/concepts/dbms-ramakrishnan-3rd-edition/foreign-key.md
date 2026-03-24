---
id: foreign-key
title: Foreign Key Constraint
definition: Maintaining referential integrity between related tables
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p240:c1
  - dbms-ramakrishnan-3rd-edition:p241:c1
  - dbms-ramakrishnan-3rd-edition:p241:c2
  - dbms-ramakrishnan-3rd-edition:p242:c1
  - dbms-ramakrishnan-3rd-edition:p242:c2
  - dbms-ramakrishnan-3rd-edition:p243:c1
  - dbms-ramakrishnan-3rd-edition:p243:c2
  - dbms-ramakrishnan-3rd-edition:p243:c3
  - dbms-ramakrishnan-3rd-edition:p244:c1
  - dbms-ramakrishnan-3rd-edition:p244:c2
  - dbms-ramakrishnan-3rd-edition:p244:c3
  - dbms-ramakrishnan-3rd-edition:p245:c1
  - dbms-ramakrishnan-3rd-edition:p245:c2
  - dbms-ramakrishnan-3rd-edition:p246:c1
  - dbms-ramakrishnan-3rd-edition:p246:c2
  - dbms-ramakrishnan-3rd-edition:p247:c1
  - dbms-ramakrishnan-3rd-edition:p247:c2
  - dbms-ramakrishnan-3rd-edition:p248:c1
  - dbms-ramakrishnan-3rd-edition:p248:c2
  - dbms-ramakrishnan-3rd-edition:p249:c1
  - dbms-ramakrishnan-3rd-edition:p249:c2
  - dbms-ramakrishnan-3rd-edition:p250:c1
  - dbms-ramakrishnan-3rd-edition:p250:c2
  - dbms-ramakrishnan-3rd-edition:p251:c1
  - dbms-ramakrishnan-3rd-edition:p251:c2
  - dbms-ramakrishnan-3rd-edition:p252:c1
  - dbms-ramakrishnan-3rd-edition:p252:c2
  - dbms-ramakrishnan-3rd-edition:p253:c1
  - dbms-ramakrishnan-3rd-edition:p253:c2
  - dbms-ramakrishnan-3rd-edition:p253:c3
  - dbms-ramakrishnan-3rd-edition:p254:c1
  - dbms-ramakrishnan-3rd-edition:p254:c2
relatedConcepts:
tags:
  - sql
  - foreign-key
  - referential-integrity
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Foreign Key Constraint

## Definition
Maintaining referential integrity between related tables

## Explanation
Database Appl'imtion Developrnent System.out.println("Name:" + md.getDriverNameO + "; version:" + mcl.getDriverVersion()); ~ The DatabaseMetaData object has many more methods (in JDBC 2.0, exactly 134); we list some methods here: • public ResultSet getCatalogs 0 throws SqLException. This function returns a ResultSet that can be used to iterate over all the catalog relations. The functions getIndexInfo 0 and getTables 0 work analogously. • pUblic int getMaxConnections 0 throws SqLException. This function returns the ma.ximum number of connections possible. We will conclude our discussion of JDBC with an example code fragment that examines all database metadata shown in DatabaseMetaData dmd = con.getMetaDataO; ResultSet tablesRS = dmd.getTables(null,null,null,null); string tableName; while(tablesRS.next()) { tableNarne = tablesRS.getString("TABLE_NAME"); / / print out the attributes of this table System.out.println("The attributes of table" + tableName + " are:"); ResultSet columnsRS = dmd.getColums(null,null,tableName, null); while (columnsRS.next()) { System.out.print(colummsRS.getString(" COLUMN_NAME") +" "); } / / print out the primary keys of this table System.out.println("The keys of table" + tableName + " are:"); ResultSet keysRS = dmd.getPrimaryKeys(null,null,tableName); while (keysRS. next()) { 'System.out.print(keysRS.getStringC'COLUMN_NAME") +" "); } } Obtaining Infon-nation about it Data Source

CHAPTER.:6 6.4 SQLJ SQLJ (short for 'SQL-Java') was developed by the SQLJ Group, a group of database vendors and Sun. SQLJ was developed to complement the dynamic way of creating queries in JDBC with a static model. It is therefore very close to Embedded SQL. Unlike JDBC, having semi-static SQL queries allows the compiler to perform SQL syntax checks, strong type checks of the compatibility of the host variables with the respective SQL attributes, and consistency of the query with the database schema-tables, attributes, views, and stored procedures--all at compilat

## Examples
### Example 1: SELECT Example
```sql
SELECT title, price INTO:title,:price FROM Books WHERE author =:author };
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT title, price INTO:title,:price FROM Books WHERE author =:author };
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
INSERT INTO Orders VALUES(7, 7, 7, 7, 7, 7)";
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254*
