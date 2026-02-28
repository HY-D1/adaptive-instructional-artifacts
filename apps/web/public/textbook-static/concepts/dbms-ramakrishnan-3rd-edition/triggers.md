# Triggers and Events

## Definition
Automating SQL execution on data changes and scheduled events

## Explanation
Evaluating Relational OperatOTS 465 8) into k partitions, we need at least k output buffers and one input buffer. Therefore, given B buffer pages, the maximum number of partitions is k = B - 1. Assuming that partitions are equal in size, this means that the size of each R partition is t!l (a'3 usual, Ai is the number of pages of R). The number of pages in the (in-memory) hash table built during the probing phase for a partition is thus ~'~'i, where f is a fudge factor used to capture the (small) increase in size between the partition and a hash table for the partition. During the probing phase, in addition to the hash table for the R partition, we require a buffer page for scanning the 8 partition and an output buffer. Therefore, we require B > -k'~~ + 2. We need approximately B > Jf . AI for the hash join algorithm to perform well. Since the partitions of R are likely to be close in size but not identical, the largest partition is somewhat larger

AI for the hash join algorithm to perform well. Since the partitions of R are likely to be close in size but not identical, the largest partition is somewhat larger than t!l' and the number of buffer pages required is a little more than B > Jf . AI. There is also the risk that, if the hash function h does not partition R uniformly, the hash table for one or more R partitions may not fit in memory during the probing phase. This situation can significantly degrade performance. As we observed in the context of hash-based projection, one way to handle this partition overflow problem is to recursively apply the hash join technique to the join of the overflowing R partition with the corresponding 8 partition. That is, we first divide the Rand 8 partitions into subpartitions. Then, we join the subpartitions pairwise. All subpartitions of R probably fit into memory; if not, we apply the hash join technique recursively. Utilizing Extra Memory: Hybrid Hash Join The minimum amount of memory required for ha.'3h join is B > Jf

into m

## Examples
### Example 1: SELECT Example
```sql
SELECT AVG(S.age) FROM Sailors S Figure 14.14 Simple Aggregation Query CHAPTER 14 The basic algorithm for aggregate operators consists of scanning the entire Sailors relation and maintaining some running information about the scanned tuples;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
select a subset of useful tuples is not ap- plicable for aggregation. However, under certain conditions, we can evaluate aggregate operations efficiently by using the data entries in an index instead of the data records: • If the search key for the index includes all the attributes needed for the aggregation query, we can apply the techniques described earlier in this section to the set of data entries in

key for the index includes all the attributes needed for the aggregation query, we can apply the techniques described earlier in this section to the set of data entries in the index, rather than to the collection of data records and thereby avoid fetching data records. • If the GROUP BY clause attribute list forms a prefix of the index search key and the index is a tree index, we can retrieve data entries (and data records, if necessary) in the order required for the grouping operation and thereby avoid a sorting step. A given index may support one or both of these techniques;
```
Example SELECT statement from textbook.

### Example 3: UPDATE Example
```sql
update the running information. 'When the h&'3h table is cOlnplete, the entry for a grouping value can be used to compute the answer tuple for the corresponding group in the obvious way. If the hash table fits in

Evaluating Relational OpemtoTs 471 memory, which is likely because each entry is quite small and there is only one entry per grouping value, the cost of the hashing approach is O(.iV1), where 1V! is the size of the relation. If the relation is so large that the hash table does not fit in memory, we can partition the relation using a hash function h on gTOuping-value. Since all tuples with a given grouping value are in the same partition, we can then process each partition independently by building an in-memory hash table for the tuples in it. 14.6.1 Implementing Aggregation by Using an Index The technique of using an index to select a subset of useful tuples is not ap- plicable for aggregation. However, under certain conditions, we can evaluate aggregate operations efficiently by using the data entries in an index instead of the data records: • If the search key for the index includes all the attributes needed for the aggregation query, we can apply the techniques described earlier in this section to the set of data entries in

key for the index includes all the attributes needed for the aggregation query, we can apply the techniques described earlier in this section to the set of data entries in the index, rather than to the collection of data records and thereby avoid fetching data records. • If the GROUP BY clause attribute list forms a prefix of the index search key and the index is a tree index, we can retrieve data entries (and data records, if necessary) in the order required for the grouping operation and thereby avoid a sorting step. A given index may support one or both of these techniques;
```
Example UPDATE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 500, 501, 502, 503, 504, 505, 506, 507, 508*
