# Correlated Subqueries

## Definition
Subqueries that reference columns from the outer query

## Explanation
Database Application Develop'll1,ent 197 } usually ,vritten using a combination of C++ and Java; it is dynamically linked and specific to the data source. This architecture performs signif- icantly better than a JDBC-ODBC bridge. One disadvantage is that the database driver that implements the API needs to be installed on each computer that runs the application. II Type III~~Network Bridges: The driver talks over a network to a middleware server that translates the JDBC requests into DBMS-specific method invocations. In this case, the driver on the client site (Le., the network bridge) is not DBMS-specific. The JDBC driver loaded by the ap~ plication can be quite small, as the only functionality it needs to implement is sending of SQL statements to the middleware server. The middleware server can then use a Type II JDBC driver to connect to the data source. II Type IV-Direct Translation to the Native API via Java Driver: Instead of calling the DBMS API directly, the driver communicates with the DBMS through Java sockets. In this case, the driver on the client side is written in

Java Driver: Instead of calling the DBMS API directly, the driver communicates with the DBMS through Java sockets. In this case, the driver on the client side is written in Java, but it is DBMS-specific. It translates JDBC calls into the native API of the database system. This solution does not require an in- termediate layer, and since the implementation is all Java, its performance is usually quite good. 6.3 JDBC CLASSES AND INTERFACES JDBC is a collection of Java classes and interfaces that enables database access from prograrl1s written in the Java language. It contains methods for con- necting to a remote data source, executing SQL statements, examining sets of results from SQL statements, transaction management, and exception han- dling. The cla.sses and interfaces are part of the java. sql package. Thus, all code fragments in the remainder of this section should include the statement 

## Examples
### Example 1: SELECT Example
```sql
SELECT query. JDBC has its own cursor mechanism in the form of a ResultSet object, which we discuss next. The execute method is more general than executeQuery and executeUpdate;
```
Example SELECT statement from textbook.

### Example 2: INSERT Example
```sql
INSERT staternents, as in Figure 6.3. The method setString is one way

Database Application Develop'ment / / initial quantity is always zero String sql = "INSERT INTO Books VALUES('?, 7, '?, ?, 0, 7)";
```
Example INSERT statement from textbook.

### Example 3: UPDATE Example
```sql
UPDATE and INSERT staternents, as in Figure 6.3. The method setString is one way

Database Application Develop'ment / / initial quantity is always zero String sql = "INSERT INTO Books VALUES('?, 7, '?, ?, 0, 7)";
```
Example UPDATE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 232, 233, 234, 235, 236, 237, 238*
