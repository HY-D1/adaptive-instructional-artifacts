---
id: selection-projection
title: Selection and Projection
definition: Basic relational algebra operations for filtering rows and selecting columns
difficulty: beginner
estimatedReadTime: 5
pageReferences: [78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p78:c1
  - dbms-ramakrishnan-3rd-edition:p78:c2
  - dbms-ramakrishnan-3rd-edition:p78:c3
  - dbms-ramakrishnan-3rd-edition:p79:c1
  - dbms-ramakrishnan-3rd-edition:p80:c1
  - dbms-ramakrishnan-3rd-edition:p80:c2
  - dbms-ramakrishnan-3rd-edition:p80:c3
  - dbms-ramakrishnan-3rd-edition:p81:c1
  - dbms-ramakrishnan-3rd-edition:p81:c2
  - dbms-ramakrishnan-3rd-edition:p82:c1
  - dbms-ramakrishnan-3rd-edition:p82:c2
  - dbms-ramakrishnan-3rd-edition:p82:c3
  - dbms-ramakrishnan-3rd-edition:p83:c1
  - dbms-ramakrishnan-3rd-edition:p83:c2
  - dbms-ramakrishnan-3rd-edition:p83:c3
  - dbms-ramakrishnan-3rd-edition:p84:c1
  - dbms-ramakrishnan-3rd-edition:p84:c2
  - dbms-ramakrishnan-3rd-edition:p84:c3
  - dbms-ramakrishnan-3rd-edition:p85:c1
  - dbms-ramakrishnan-3rd-edition:p85:c2
  - dbms-ramakrishnan-3rd-edition:p86:c1
  - dbms-ramakrishnan-3rd-edition:p86:c2
  - dbms-ramakrishnan-3rd-edition:p86:c3
  - dbms-ramakrishnan-3rd-edition:p87:c1
  - dbms-ramakrishnan-3rd-edition:p87:c2
  - dbms-ramakrishnan-3rd-edition:p87:c3
  - dbms-ramakrishnan-3rd-edition:p88:c1
  - dbms-ramakrishnan-3rd-edition:p88:c2
  - dbms-ramakrishnan-3rd-edition:p88:c3
  - dbms-ramakrishnan-3rd-edition:p88:c4
  - dbms-ramakrishnan-3rd-edition:p89:c1
  - dbms-ramakrishnan-3rd-edition:p89:c2
  - dbms-ramakrishnan-3rd-edition:p89:c3
  - dbms-ramakrishnan-3rd-edition:p89:c4
relatedConcepts:
tags:
  - relational
  - operations
  - basics
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Selection and Projection

## Definition
Basic relational algebra operations for filtering rows and selecting columns

## Explanation
Introduction to Database Design Given a department, we know the manager, as well &'3 the manager's starting date and budget for that department. This approach is natural if we t'l"ssume that a manager receives a separate discretionary budget for each department that he or she manages. But what if the discretionary budget is a sum that covers all departments managed by that employee? In this case, each Manages2 relationship that involves a given employee will have the same value in the db1Ldget field, leading to redundant storage of the same information. Another problem with this design is that it is misleading; it suggests that the budget is associated with the relationship, when it is actually associated with the manager. We can address these problems by introducing a new entity set called Managers (which can be placed below Employees in an ISA hierarchy, to show that every manager is also an employee). The attributes since and dbudget now describe a manager entity, as intended. As a variation, while every manager has a budget, each manager may have a different starting date

also an employee). The attributes since and dbudget now describe a manager entity, as intended. As a variation, while every manager has a budget, each manager may have a different starting date (as manager) for each department. In this case dbudget is an attribute of Managers, but since is an attribute of the relationship set between managers and departments. The imprecise nature of ER modeling can thus make it difficult to recognize underlying entities, and we might associate attributes with relationships rather than the appropriate entities. In general, such mistakes lead to redundant storage of the same information and can cause many problems. We discuss redundancy and its attendant problems in Chapter 19, and present a technique called normalization to eliminate redundancies from tables. 2.5.3 Binary versus Ternary Relationships Consider the ER diagram shown in an employee can own several 

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
*Source: dbms-ramakrishnan-3rd-edition, Pages 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89*
