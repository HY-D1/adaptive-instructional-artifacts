# Backup and Restore

## Definition
Strategies and commands for backing up and restoring MySQL databases

## Explanation
01)eruiew of Transaction A!anagf'rnent 16.3.2 SerializabHity A serializable schedule over a set S of cormnitted transactions is a schedule whose effect on any consistent database instance is guaranteed to be identical to that of some complete serial schedule over S. That is, the databa..<;e instance that results from executing the given schedule is identical to the database in- stance that results frOlIl executing the transactions in some serial order. 1 As an example, the schedule shown in Figure 16.2 is serializable. Even though the actions of T1 and T2 are interleaved, the result of this schedule is equivalent to running T1 (in its entirety) and then running T2. Intuitively, T1 's read and write of B is not influenced by T2's actions on A, and the net effect is the same if these actiolls are 'swapped' to obtain the serial schedule Tl; T2. Tl T2 R(A) vV(A) R(A) W(A) R(B) vV(B) R(B) W(B) Commit Commit Figure 16.2 A Serializable Schedule Executing transactions serially in different orders may produce different results, but all are presumed to be acceptable: the DBMS makes

vV(B) R(B) W(B) Commit Commit Figure 16.2 A Serializable Schedule Executing transactions serially in different orders may produce different results, but all are presumed to be acceptable: the DBMS makes no guarantees ahout which of them will be the outcome of an interleaved execution. To see this, note that the two example transactions from Figure 16.2 can be interleaved a.s shown in Figure 16.:3. This schedule, also serializable, is equivalent to the serial schedule T2; Tl. If T1 and T2 are submitted concurrently to a DBMS, either of these schedules (among others) could be chosen. The preceding definition of a serializable schedule does not cover the case of schedules containing aborted transactions. We extend the definition of serial- izable schedules to cover aborted transactions in Section 16.3.4. llf a transaction prints a value to the screen, this 'effed' is not directly captured in the data

## Examples
### Example 1: UPDATE Example
```sql
update rather than T2's, but Tl's update is 'lost'. 16.3.4 Schedules Involving Aborted Transactions We now extend our definition of serializability to include aborted trallsactions. 2 Intuitively, all actions of aborted transactions are to be undone, and we can therefore imagine that they were never carried out to begin with. Using this intuition, we extend the definition of a serializable schedule as follows: A se- rializable schedule over a set S of transactions is a schedule whose effect on any consistent database instance is guaranteed to be identical to that of some complete serial schedule over the set of committed transactions in S. This definition of serializability relies on the actions of aborted transactions being undone completely, which may

that of some complete serial schedule over the set of committed transactions in S. This definition of serializability relies on the actions of aborted transactions being undone completely, which may be impossible in some situations. For example, suppose that (1) an account transfer program T1 deducts $100 from account A, then (2) an interest deposit program T2 reads the current values of accounts A and B and adds 6% interest to each, then commits, and then (3) T1 is aborted. The corresponding schedule is shown in Figure 16..5. Tl T2 R(A) W(A) R(A) vV(A) R(B) Hl(B) Commit Abort Figure 16.5 An Unrecoverable Schedule 2 Vie must also consider incomplete transactions for a rigorous discussion of system failures, because transactions that are active when the system fails are neither aborted nor committed. However, system recovery usually begins by aborting all active transactions. and for our informal discussion, considering schedules involving committed and aborted transactions is sufficient.

530 CHAPTER$16 Now, T2 has read a value for A that should never have been there. (Recall that aborted transactions' effects are not supposed to be visible to other trans- actions.) If T2 had not yet committed, we could deal with the situation by cascading the abort of TI and also aborting T2;
```
Example UPDATE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 560, 561, 562, 563, 564, 565, 566*
