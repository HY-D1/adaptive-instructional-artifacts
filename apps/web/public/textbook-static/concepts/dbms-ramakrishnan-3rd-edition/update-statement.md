# The UPDATE Statement

## Definition
Modifying existing rows in a table with UPDATE and SET clauses

## Explanation
Relational Algebra and CalcuIu,s 129 4. Identi(y the flights that can be piloted by every pilot whose salary is more than $100,000. 5. Find the names of pilots who can operate planes with a range greater than 3,000 miles but are not certified on any Boeing aircraft. 6. Find the eids of employees who make the highest salary. 7. Find the eids of employees who make the second highest salary. 8. Find the eids of employees who are certified for the largest number of aircraft. 9. Find the eids of employees who are certified for exactly three aircraft. 10. Find the total amount paid to employees as salaries. 11. Is there a sequence of flights from Madison to Timbuktu? Each flight in the sequence is required to depart from the city that is the destination of the previous flight; the first flight must leave Madison, the last flight must reach Timbuktu, and there is no restriction on the number of intermediate flights. Your query must determine whether a sequence of flights from Madison to Timbuktu exists for any input Flights

Timbuktu, and there is no restriction on the number of intermediate flights. Your query must determine whether a sequence of flights from Madison to Timbuktu exists for any input Flights relation instance. Exercise 4.6 What is relational completeness? If a query language is relationally complete, can you write any desired query in that language? Exercise 4.7 What is an unsafe query? Give an example and explain why it is important to disallow such queries. BIBLIOGRAPHIC NOTES Relational algebra was proposed by Codd in [187], and he showed the equivalence of relational algebra and TRC in [189]. Earlier, Kuhns [454] considered the use of logic to pose queries. LaCroix and Pirotte discussed DRC in [459]. Klug generalized the algebra and calculus to include aggregate operations in [439]. Extensions of the algebra and calculus to deal with aggregate functions are also discussed in [578]. Merrett proposed an extended relational algebra with quantifiers such a

## Examples
### Example 1: SELECT Example
```sql
SELECT [DISTINCT] select-list FROM from-list WHERE qualification 1All references to a query can be found in the subject index for the book.

134 I sid I sname·1 rating I age I CHAPTER 9 22 Dustin 7 45.0 29 Brutus 1 33.0 31 Lubber 8 55.5 32 Andy 8 25.5 58 Rusty 10 35.0 64 Horatio 7 35.0 71 Zorba 10 16.0 74 Horatio 9 35.0 85 Art 3 25.5 95 Bob 3 63.5 Figure 5.1 An Instance 53 of Sailors 22 101 10/10/98 22 102 10/10/98 22 103 10/8/98 22 104 10/7/98 31 102 11/10/98 31 103 11/6/98 31 104 11/12/98 64 101 9/5/98 64 102 9/8/98 74 103 9/8/98 Figure 5.2 An Instance R2 of Reserves ~ bname I color ··1 101 Interlake blue 102 Interlake red 103 Clipper green 104 Marine red Figure 5.3 An Instance Bl of Boats Every query must have a SELECT clause, which specifies columns to be retained in the result, and a FROM clause, which specifies a cross-product of tables. The optional WHERE clause specifies selection conditions on the tables mentioned in the FROM clause. Such a query intuitively corresponds to a relational algebra expression involving selections, projections, and cross-products. The close relationship between SQL

selection conditions on the tables mentioned in the FROM clause. Such a query intuitively corresponds to a relational algebra expression involving selections, projections, and cross-products. The close relationship between SQL and relational algebra is the basis for query optimization in a relational DBMS, as we will see in Chapters 12 and 15. Indeed, execution plans for SQL queries are represented using a variation of relational algebra expressions (Section 15.1). Let us consider a simple example. (Q15) Find the' names and ages of all sailors. SELECT DISTINCT S.sname, S.age FROM Sailors S The answer is a set of rows, each of which is a pair (sname, age). If two or more sailors have the same name and age, the answer still contains just one pair

SQL: Q1Le7~ies. Con8tnrint8, TriggeT8 135 ~ with that name and age. This query is equivalent to applying the projection operator of relational algebra. If we omit the keyword DISTINCT, we would get a copy of the row (s,a) for each sailor with name s and age a;
```
Example SELECT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 164, 165, 166, 167, 168, 169, 170*
