# Views

## Definition
Creating and using virtual tables based on SELECT queries

## Explanation
Tree~StT7lChtTed IndeTing 345 and the leaf nodes contain the data entries. Since the tree structure grows and shrinks dynamically, it is not feasible to allocate the leaf pages sequentially as in ISAM, where the set of primary leaf pages was static. To retrieve all leaf pages efficiently, we have to link them using page pointers. By organizing them into a doubly linked list, we can easily traverse the sequence of leaf pages (sometimes called the sequence set) in either direction. This structure is illustrated in Figure 10.7.2 Index entries (To direct search) Index file Data entries ("Sequence set") Figure 10.7 Structure of a B+ 'n'ee The following are some of the main characteristics of a B+ tree: • Operations (insert, delete) on the tree keep it balanced. • A minimum occupancy of 50 percent is guaranteed for each node except the root if the deletion algorithm discussed in Section 10.6 is implemented. However, deletion is often implemented by simply locating the data entry and removing it, without adjusting the tree &'3 needed to guarantee the 50 percent occupancy, because files

is implemented. However, deletion is often implemented by simply locating the data entry and removing it, without adjusting the tree &'3 needed to guarantee the 50 percent occupancy, because files typically grow rather than shrink. l1li Searching for a record requires just a traversal from the root to the appro- priate leaf. Vie refer to the length of a path from the root to a leaf any leaf, because the tree is balanced as the height of the tree. For example, a tree with only a leaf level and a single index level, such as the tree shown in Figure 10.9, has height 1, and a tree that h&'3 only the root node has height O. Because of high fan-out, the height of a B+ tree is rarely more than 3 or 4. \Ve will study B+ trees in which every node contains Tn entries, where d :::; nJ, :::; 2d. The value d is a parameter of the B+ tree, called the order of the .._- 2If the tree is created by IYll.lk..

## Examples
### Example 1: INSERT Example
```sql
INSERT The algorithm for insertion takes an entry, finds the leaf node where it belongs, and inserts it there. Pseudocode for the B+ tree insertion algorithm is given in Figure HUG. The basic idea behind the algorithm is that we recursively insert the entry by calling the insert algorithm on the appropriate child node. Usually, this procedure results in going down to the leaf node where the entry belongs, placing the entry there, and returning all the way back to the root node. Occasionally a node is full and it must be split. When the node is split, an entry pointing to the node created by the split must be inserted into its parent;
```
Example INSERT statement from textbook.

### Example 2: INSERT Example
```sql
insert entry 8*, it belongs in

the height of the tree increa..<;
```
Example INSERT statement from textbook.

### Example 3: DELETE Example
```sql
DELETE The algorithm for deletion takes an entry, finds the leaf node where it belongs, and deletes it. Pseudocode for the B+ tree deletion algorithm is given in Figure 10.15. The basic idea behind the algorithm is that we recursively delete the entry by calling the delete algorithm on the appropriate child node. We usually go down to the leaf node where the entry belongs, remove the entry from there, and return all the way back to the root node. Occasionally a node is at minimum occupancy before the deletion, and the deletion causes it to go below the occupancy threshold. When this happens, we must either redistribute entries from an adjacent sibling or merge the node with a sibling to maintain minimum occupancy. If entries are redistributed between two nodes, their parent

happens, we must either redistribute entries from an adjacent sibling or merge the node with a sibling to maintain minimum occupancy. If entries are redistributed between two nodes, their parent node must be updated to reflect this;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 380, 381, 382, 383, 384, 385, 386, 387, 388, 389*
