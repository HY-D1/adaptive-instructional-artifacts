# The DELETE Statement

## Definition
Removing rows from a table using DELETE with WHERE clause

## Explanation
136 CHAPTER fj convenient shorthand: \eVe can simply write SELECT *. This notation is useful for interactive querying, but it is poor style for queries that are intended to be reused and maintained because the schema of the result is not clear from the query itself; we have to refer to the schema of the underlying Sailors ta.ble. As these two examples illustrate, the SELECT clause is actually used to do pm- jection, whereas selections in the relational algebra sense are expressed using the WHERE clause! This mismatch between the naming of the selection and pro- jection operators in relational algebra and the syntax of SQL is an unfortunate historical accident. We now consider the syntax of a basic SQL query in more detail. • The from-list in the FROM clause is a list of table names. A table name can be followed by a range variable; a range variable is particularly useful when the same table name appears more than once in the from-list. • The select-list is a list of (expressions involving) column names of tables named in

is particularly useful when the same table name appears more than once in the from-list. • The select-list is a list of (expressions involving) column names of tables named in the from-list. Column names can be prefixed by a range variable. • The qualification in the WHERE clause is a boolean combination (i.e., an expression using the logical connectives AND, OR, and NOT) of conditions of the form expression op expression, where op is one of the comparison operators {<, <=, =, <>, >=, >}.2 An expression is a column name, a constant, or an (arithmetic or string) expression. • The DISTINCT keyword is optional. It indicates that the table computed as an answer to this query should not contain duplicates, that is, two copies of the same row. The default is that duplicates are not eliminated. Although the preceding rules describe (informally) the syntax of a basic SQL query, they do not tell us the meaning of a query. The answer to a query is itself a r

## Examples
### Example 1: SELECT Example
```sql
SELECT *. This notation is useful for interactive querying, but it is poor style for queries that are intended to be reused and maintained because the schema of the result is not clear from the query itself;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT clause is actually used to do pm- jection, whereas selections in the relational algebra sense are expressed using the WHERE clause! This mismatch between the naming of the selection and pro- jection operators in relational algebra and the syntax of SQL is an unfortunate historical accident. We now consider the syntax of a basic SQL query in more detail. • The from-list in the FROM clause is a list of table names. A table name can be followed by a range variable;
```
Example SELECT statement from textbook.

### Example 3: DELETE Example
```sql
Delete rows in the cross-product that fail the qualification conditions. 3. Delete all columns that do not appear in the select-list. 4. If DISTINCT is specified, eliminate duplicate rows. 2ExpressiollS with NOT can always be replaced by equivalent expressions without NOT given the set of comparison operators just listed.

SCJL: Queries, ConstTaints, TriggeTs 137 ~ This straightforward conceptual evaluation strategy makes explicit the rows that must be present in the answer to the query. However, it is likely to be quite inefficient. We will consider how a DB:MS actually evaluates queries in later chapters;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 171, 172, 173, 174, 175, 176*
