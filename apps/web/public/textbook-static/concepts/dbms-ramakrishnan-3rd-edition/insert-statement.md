# The INSERT Statement

## Definition
Adding new rows to a table using INSERT INTO with VALUES or SELECT

## Explanation
Relational Algebra (nul Calculus 121 ) 1\3B E Boats(B.llid = R.md 1\ B.color ='red'))} This query can be read as follows: "Retrieve all sailor tuples S for which there exist tuples R in Reserves and B in Boats such that S.sid = R.sid, R.bid = B.b'id, and B.coior ='red'." Another way to write this query, which corresponds more closely to this reading, is as follows: {P I 3S E SailoTs 3R E Reserves 3B E Boats (Rsid = S.sid 1\ B.bid = R.bid 1\ B.color ='red' 1\ Psname = S.sname)} (Q7) Find the names of sailors who have reserved at least two boats. {P I 3S E Sailors 3Rl E Reserves 3R2 E Reserves (S.sid = R1.sid 1\ R1.sid = R2.sid 1\ R1.bid =I- R2.bid I\Psname = S.sname)} Contrast this query with the algebra version and see how much simpler the calculus version is. In part, this difference is due to the cumbersome renaming of fields in the algebra version, but the calculus version really is simpler. (Q9) Find the narnes of sailors who have reserved all boats. {P I

to the cumbersome renaming of fields in the algebra version, but the calculus version really is simpler. (Q9) Find the narnes of sailors who have reserved all boats. {P I 3S E Sailors VB E Boats (3R E Reserves(S.sid = R.sid 1\ R.bid = B.bid 1\ Psname = S.sname))} This query was expressed using the division operator in relational algebra. Note how easily it is expressed in the calculus. The calculus query directly reflects how we might express the query in English: "Find sailors S such that for all boats B there is a Reserves tuple showing that sailor S has reserved boat B." (Q14) Find sailors who have reserved all red boats. {S I S E Sailor's 1\ VB E Boats (B.color ='red' :::} (3R E Reserves(S.sid = R.sid 1\ R.bid = B.bid)))} This query can be read as follows: For each candidate (sailor), if a boat is red, the sailor must have reserved it. That is, for a candidate sailor, a boat being red must imply that the sailor has reserved it. Observe that since we can return

the sailor must have reserved it. That is, fo

## Examples
### Example 1
```sql
-- No specific example available in textbook
```
No example available for this concept.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 156, 157, 158, 159, 160, 161, 162, 163*
