# Correlated Subqueries

## Definition

Such a trigger is shown in 
aJternative to the triggers shown in 
The definition in 
the similarities and differences with respect to the syntax used in a typical
current DBMS.

## Explanation

CHAPTER 5
CREATE TRIGGER iniLeount BEFORE INSERT ON Students
1* Event *1
DECLARE
count INTEGER:
BEGIN
1* Action *I
count := 0:
END
CREATE TRIGGER incLcount AFTER INSERT ON Students
1* Event *1
WHEN (new.age < 18)
1* Condition; 'new' is just-inserted tuple *1
FOR EACH ROW
BEGIN
1* Action; a procedure in Oracle's PL/SQL syntax *1
count := count + 1;
END
Examples Illustrating Triggers
ing event should be defined to occur for each modified record; the FOR EACH
ROW clause is used to do this.

Such a trigger is called a row-level trigger. On
the other hand, the iniLcount trigger is executed just once per INSERT state-
ment, regardless of the number of records inserted, because we have omitted
the FOR EACH ROW phrase. Such a trigger is called a statement-level trigger. In 
tuple were modified, the keywords old and new could be used to refer to the
values before and after the modification.

SQL:1999 also allows the action part
of a trigger to refer to the set of changed records, rather than just one changed
record at a time. For example, it would be useful to be able to refer to the set
of inserted Students records in a trigger that executes once after the INSERT
statement; we could count the number of inserted records with age < 18 through
an SQL query over this set. Such a trigger is shown in 
aJternative to the triggers shown in 
The definition in 
the similarities and differences with respect to the syntax used in a typical
current DBMS.

## Examples

### SQL Example 1

```sql
CREATE TRIGGER iniLeount BEFORE INSERT ON Students 1* Event *1 DECLARE count INTEGER: BEGIN 1* Action *I count := 0: END CREATE TRIGGER incLcount AFTER INSERT ON Students 1* Event *1 WHEN (new.age < 18) 1* Condition;
```

Example SQL query

### SQL Example 2

```sql
with age < 18 through an SQL query over this set. Such a trigger is shown in aJternative to the triggers shown in The definition in the similarities and differences with respect to the syntax used in a typical current DBMS. The keyword clause NEW TABLE enables us to give a table name (InsertedTuples) to the set of newly inserted tuples. The FOR EACH STATEMENT clause specifies a statement-level trigger and can be omitted because it is the default. This definition does not have a WHEN clause;
```

Example SQL query

### SQL Example 3

```sql
with this example, we may want to perform some additional actions when an order is received. For example, if the purchase is being charged to a credit line issued by the company, we may want to check whether the total cost of the purch&'3e is within the current credit limit. We can use a trigger to do the check;
```

Example SQL query

### SQL Example 4

```sql
with purchases that exceed a credit limit. For instance, we may allow purchases that exceed the limit by no more than 10% if the customer has dealt with the company for at least a year, and add the customer to a table of candidates for credit limit increases. 5.9.3 Other Uses of Triggers .l\'Iany potential uses of triggers go beyond integrity maintenance. Triggers can alert users to unusual events (&'3 reflected in updates to the databa..<;
```

Example SQL query

### SQL Example 5

```sql
create tables for each exercise for use with Oracle, IBM DB2, Microsoft SQL Server, and MySQL. Student(snum: integer, sname: string, major: string, level: string, age: integer) Class( name: string, meets_at: time, room: string, fid: integer) Enrolled(snum: integer, cname: string) Faculty (fid: integer, fnarne: string, deptid: integer) The meaning of these relations is straightforward;
```

Example SQL query

### SQL Example 6

```sql
with cruising range longer than 1000 miles. 13. Print the names of employees who are certified only on aircrafts with cruising range longer than 1000 miles, but on at least two such aircrafts. 14. Print the names of employees who are certified only on aircrafts with cruising range longer than 1000 miles and who are certified on some Boeing aircraft. one department;
```

Example SQL query

### SQL Example 7

```sql
with budgets larger than $1 million, but at least one department with budget less than $5 million. 1. Write SQL queries to compute the average rating, using AVGj the sum of the ratings, using SUM;
```

Example SQL query

### SQL Example 8

```sql
with the join condition being sid=sid. (f) Show the full outer join of 81 with S2, with the join condition being sid=sid. 1. Explain the term 'impedance mismatch in the context of embedding SQL commands in a host language such as C. 2. How can the value of a host language variable be passed to an embedded SQL command? 3. Explain the WHENEVER command's use in error and exception handling. 4. Explain the need for cursors. 5. Give an example of a situation that calls for the use of embedded SQL;
```

Example SQL query

### SQL Example 9

```sql
with respect to cursors: 'tlpdatability, sens,itivity, and scml- lability. 11. Define a cursor on the Sailors relation that is updatable, scrollable, and returns answers sorted by age. Which fields of Sailors can such a cursor not update? Why? 12. Give an example of a situation that calls for dynamic 8QL;
```

Example SQL query

### SQL Example 10

```sql
create these relations, including appropriate ver- sions of all primary and foreign key integrity constraints. 2. Express each of the following integrity constraints in SQL unless it is implied by the primary and foreign key constraint;
```

Example SQL query

### SQL Example 11

```sql
with deptid=SS is greater than the number of ivlath majors. (n) There lIlUst be at least one CS major if there are any students whatsoever. (0) Faculty members from different departments cannot teach in the same room. Contrast triggers with other integrity constraints supported by SQL. An employee can work in more than one department;
```

Example SQL query

## Common Mistakes

### Not understanding the concept fully

**Incorrect:**

```sql
-- Incorrect usage
```

**Correct:**

```sql
-- Correct usage (see textbook)
```

**Why this happens:** Review the textbook explanation carefully

---

## Practice

**Question:** Practice using Correlated Subqueries in your own SQL queries

**Solution:** Try writing queries and compare with textbook examples


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*