---
id: correlated-subquery
title: Correlated Subqueries
definition: Subqueries that reference columns from the outer query
difficulty: advanced
estimatedReadTime: 5
pageReferences: [205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p205:c1
  - dbms-ramakrishnan-3rd-edition:p205:c2
  - dbms-ramakrishnan-3rd-edition:p205:c3
  - dbms-ramakrishnan-3rd-edition:p206:c1
  - dbms-ramakrishnan-3rd-edition:p206:c2
  - dbms-ramakrishnan-3rd-edition:p207:c1
  - dbms-ramakrishnan-3rd-edition:p207:c2
  - dbms-ramakrishnan-3rd-edition:p207:c3
  - dbms-ramakrishnan-3rd-edition:p208:c1
  - dbms-ramakrishnan-3rd-edition:p208:c2
  - dbms-ramakrishnan-3rd-edition:p208:c3
  - dbms-ramakrishnan-3rd-edition:p209:c1
  - dbms-ramakrishnan-3rd-edition:p209:c2
  - dbms-ramakrishnan-3rd-edition:p209:c3
  - dbms-ramakrishnan-3rd-edition:p210:c1
  - dbms-ramakrishnan-3rd-edition:p210:c2
  - dbms-ramakrishnan-3rd-edition:p210:c3
  - dbms-ramakrishnan-3rd-edition:p211:c1
  - dbms-ramakrishnan-3rd-edition:p211:c2
  - dbms-ramakrishnan-3rd-edition:p211:c3
  - dbms-ramakrishnan-3rd-edition:p211:c4
  - dbms-ramakrishnan-3rd-edition:p212:c1
  - dbms-ramakrishnan-3rd-edition:p212:c2
  - dbms-ramakrishnan-3rd-edition:p212:c3
  - dbms-ramakrishnan-3rd-edition:p213:c1
  - dbms-ramakrishnan-3rd-edition:p213:c2
  - dbms-ramakrishnan-3rd-edition:p213:c3
  - dbms-ramakrishnan-3rd-edition:p214:c1
  - dbms-ramakrishnan-3rd-edition:p214:c2
  - dbms-ramakrishnan-3rd-edition:p214:c3
  - dbms-ramakrishnan-3rd-edition:p215:c1
  - dbms-ramakrishnan-3rd-edition:p215:c2
  - dbms-ramakrishnan-3rd-edition:p215:c3
  - dbms-ramakrishnan-3rd-edition:p216:c1
  - dbms-ramakrishnan-3rd-edition:p218:c1
relatedConcepts:
tags:
  - sql
  - subqueries
  - correlated
  - advanced
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Correlated Subqueries

## Definition
Subqueries that reference columns from the outer query

## Explanation
CHAPTER 5 CREATE TRIGGER iniLeount BEFORE INSERT ON Students 1* Event *1 DECLARE count INTEGER: BEGIN 1* Action *I count:= 0: END CREATE TRIGGER incLcount AFTER INSERT ON Students 1* Event *1 WHEN (new.age < 18) 1* Condition; 'new' is just-inserted tuple *1 FOR EACH ROW BEGIN 1* Action; a procedure in Oracle's PL/SQL syntax *1 count:= count + 1; END Examples Illustrating Triggers ing event should be defined to occur for each modified record; the FOR EACH ROW clause is used to do this. Such a trigger is called a row-level trigger. On the other hand, the iniLcount trigger is executed just once per INSERT statement, regardless of the number of records inserted, because we have omitted the FOR EACH ROW phrase. Such a trigger is called a statement-level trigger. In tuple were modified, the keywords old and new could be used to refer to the values before and after the modification. SQL:1999 also allows the action part of a trigger to refer to the set of changed records, rather than just one changed record at a time. For

the values before and after the modification. SQL:1999 also allows the action part of a trigger to refer to the set of changed records, rather than just one changed record at a time. For example, it would be useful to be able to refer to the set of inserted Students records in a trigger that executes once after the INSERT statement; we could count the number of inserted records with age < 18 through an SQL query over this set. Such a trigger is shown in aJternative to the triggers shown in The definition in the similarities and differences with respect to the syntax used in a typical current DBMS. The keyword clause NEW TABLE enables us to give a table name (InsertedTuples) to the set of newly inserted tuples. The FOR EACH statement clause specifies a statement-level trigger and can be omitted because it is the default. This definition does not have a WHEN clause; if such a clause is included, it follows the FOR EACH statement clause, just before the acti

## Examples
### Example 1: SELECT Example
```sql
SELECT 'Students', 'Insert', COUNT * FROM InsertedTuples I WHERE 1.age < 18 Set-Oriented Trigger 5.9 DESIGNING ACTIVE DATABASES Triggers offer a powerful mechanism for dealing with changes to a database, but they must be used with caution. The effect of a collection of triggers can be very complex, and maintaining an active database can become very difficult. Often, a judicious use of integrity constraints can replace the use of triggers. 5.9.1 Why Triggers Can Be Hard to Understand In an active database system, when the DBMS is about to execute a statement that modifies

integrity constraints can replace the use of triggers. 5.9.1 Why Triggers Can Be Hard to Understand In an active database system, when the DBMS is about to execute a statement that modifies the databa.se, it checks whether some trigger is activated by the statement. If so, the DBMS processes the trigger by evaluating its condition part, and then (if the condition evaluates to true) executing its action part. If a statement activates more than one trigger, the DBMS typically processes all of them, in senne arbitrary order. An important point is that the execution of the action part of a trigger could in turn activate another trigger. In particular, the execution of the action part of a trigger could a,gain activate the sarne trigger;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT * FROM Sailors S WHERE S.rating > ANY (SELECT FROM \-/HERE SELECT S.sname FROM Sailors S WHERE NOT EXISTS ( SELECT * FROM Sailors S2 WHERE S2.age < 21 AND S.rating <= S2.rating) 4. Consider the instance of Sailors shown

ANY (SELECT FROM \-/HERE SELECT S.sname FROM Sailors S WHERE NOT EXISTS ( SELECT * FROM Sailors S2 WHERE S2.age < 21 AND S.rating <= S2.rating) 4. Consider the instance of Sailors shown in to consist of the first two tuples, instance S2 to be the last two tuples, and S to be the given instance.

CHAPTER'5 Show the left outer join of S with itself, with the join condition being 8'id=sid. (b) Show the right outer join of S,vith itself, with the join condition being s'id=sid. (c) Show the full outer join of S with itself, with the join condition being S'id=sid. (d) Show the left outer join of Sl with S2, with the join condition being sid=sid. (e) Show the right outer join of Sl with S2, with the join condition being sid=sid. (f) Show the full outer join of 81 with S2, with the join condition being sid=sid. Exercise 5.6 Answer the following questions: 1. Explain the term 'impedance mismatch in the context of embedding SQL commands in a host language such as C. 2. How can the value of a host language variable be passed to an embedded SQL command? 3. Explain the WHENEVER command's use in error and exception handling. 4. Explain the need for cursors. 5. Give an example of a situation that calls for the use of embedded SQL;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
INSERT ON Students 1* Event *1 DECLARE count INTEGER: BEGIN 1* Action *I count:= 0: END CREATE TRIGGER incLcount AFTER INSERT ON Students 1* Event *1 WHEN (new.age < 18) 1* Condition;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219*
