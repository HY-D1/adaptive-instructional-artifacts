# The ORDER BY Clause

## Definition
Sorting result sets by one or more columns in ascending or descending order

## Explanation
The Relational A10dd ----------------~- Updatable Views in SQL:1999 The Hew SQL standard has expanded the class of view definitions that are updatable~ taking primary . key constraints into account. In contra..')t·to SQL-92~ a· view definition that contains more than OIle table in the FROM clause may be updatable under the new definition. Intuitively~ we can update afield of a. view if it is obtained from exactly one of the underlying tables, and the primary key of that table is included in the fields of the view. SQL:1999 distinguishes between views whose rows can be modified (updat- able views) and views into which new rows can be inserted (insertable- into views): Views defined using the SQL constructs UNION, INTERSECT, and EXCEPT (which we discuss in Chapter 5) cannot be inserted into, even if they are updatable. Intuitively, updatability ensures that an updated tuple in the view can be traced to exactly one tuple in one of the tables used to define the view. The updatability property, however, may still not enable us to decide into which table to insert a new

one tuple in one of the tables used to define the view. The updatability property, however, may still not enable us to decide into which table to insert a new tuple. An important observation is that an INSERT or UPDATE may change the un- derlying base table so that the resulting (i.e., inserted or modified) row is not in the view! For example, if we try to insert a row (51234, 2.8) into the view, this row can be (padded with null values in the other fields of Students and then) added to the underlying Students table, but it will not appear in the GoodStudents view because it does not satisfy the view condition gpa > 3.0. The SQL default action is to allow this insertion, but we can disallow it by adding the clause WITH CHECK OPTION to the definition of the view. In this case, only rows that will actually appear in the view are permissible insertions. We caution the reader, that when a view is defined in t

## Examples
### Example 1: SELECT Example
```sql
SELECT S.sname, S.login, C.cname, C.jyear FROM Students S, Clubs C WHERE S.sname = C.mname AND S.gpa> 3 Consider the instances of Students and Clubs shown in Figures 3.19 and 3.20. When evaluated using the instances C

Students S, Clubs C WHERE S.sname = C.mname AND S.gpa> 3 Consider the instances of Students and Clubs shown in Figures 3.19 and 3.20. When evaluated using the instances C and S3, ActiveStudents contains the rows shown in Figure 3.21. Now suppose that we want to delete the row (Smith, smith@ee, Hiking, 1997) from ActiveStudents. How are we to do this? ActiveStudents rows are not stored explicitly but computed as needed from the Students and Clubs tables using the view definition. So we must change either Students or Clubs (or both) in such a way that evaluating the view definition on the modified instance does not produce the row (Snrith, 8Tnith@ec, Hiking, 1997.) This ta.sk can be ctccomplished in one of two ways: by either deleting the row (53688.. Sm'ith, 8Tn'ith(iJ)ee, 18, ,g.2) from Students or deleting the row (Hiking, 1.997, 8m/ith) clvVe remark that Clubs has a poorly designed schema (chosen for the sake of our discussion of view updates), since it identifies students by name, which is not a candidate key for Students.

The Relational tv!odel 9J from Clubs. But neither solution is satisfactory. Removing the Students row has the effect of also deleting the row (8m:ith, smith@ee, Rowing, 1998) from the view ActiveStudents. Removing the Clubs row h&'3 the effect of also deleting the row (Smith, smith@math, Hiking, 1991) from the view ActiveStudents. Neither side effect is desirable. In fact, the only reasonable solution is to d'isallow such updates on views. Views involving more than one base table can, in principle, be safely updated. The B-Students view we introduced at the beginning of this section is an ex- ample of such a view. Consider the instance of B-Students shown in Figure 3.18 (with, of course, the corresponding instances of Students and Enrolled as in Figure 3.4). To insert a tuple, say (Dave, 50000, Reggae203) B-Students, we can simply insert a tuple (Reggae203, B, 50000) into Enrolled since there is al- ready a tuple for sid 50000 in Students. To insert (John, 55000, Reggae203), on the other hand, we have to insert (Reggae203, B, 55000) into Enrolled and also insert (55000, John, null,

tuple for sid 50000 in Students. To insert (John, 55000, Reggae203), on the other hand, we have to insert (Reggae203, B, 55000) into Enrolled and also insert (55000, John, null, null, null) into Students. Observe how null values are used in fields of the inserted tuple whose value is not available. Fortunately, the view schema contains the primary key fields of both underlying base tables;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT O.cid, O.qty, O.ordeLdate, O.ship_date FROM Orders 0 The plan is to allow employees to see this table, but not Orders;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
insert a new

one tuple in one of the tables used to define the view. The updatability property, however, may still not enable us to decide into which table to insert a new tuple. An important observation is that an INSERT or UPDATE may change the un- derlying base table so that the resulting (i.e., inserted or modified) row is not in the view! For example, if we try to insert a row (51234, 2.8) into the view, this row can be (padded with null values in the other fields of Students and then) added to the underlying Students table, but it will not appear in the GoodStudents view because it does not satisfy the view condition gpa > 3.0. The SQL default action is to allow this insertion, but we can disallow it by adding the clause WITH CHECK OPTION to the definition of the view. In this case, only rows that will actually appear in the view are permissible insertions. We caution the reader, that when a view is defined in terms of another view, the interaction between these view definitions

will actually appear in the view are permissible insertions. We caution the reader, that when a view is defined in terms of another view, the interaction between these view definitions with respect to updates and the CHECK OPTION clause can be complex;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 124, 125, 126, 127, 128, 129*
