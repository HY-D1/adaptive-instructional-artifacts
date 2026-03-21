---
id: relational-algebra
title: Relational Algebra
definition: Formal language for manipulating relations using operations like selection, projection, and join
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p75:c1
  - dbms-ramakrishnan-3rd-edition:p75:c2
  - dbms-ramakrishnan-3rd-edition:p76:c1
  - dbms-ramakrishnan-3rd-edition:p76:c2
  - dbms-ramakrishnan-3rd-edition:p77:c1
  - dbms-ramakrishnan-3rd-edition:p77:c2
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
  - dbms-ramakrishnan-3rd-edition:p90:c1
  - dbms-ramakrishnan-3rd-edition:p90:c2
  - dbms-ramakrishnan-3rd-edition:p90:c3
  - dbms-ramakrishnan-3rd-edition:p90:c4
  - dbms-ramakrishnan-3rd-edition:p91:c1
  - dbms-ramakrishnan-3rd-edition:p92:c1
  - dbms-ramakrishnan-3rd-edition:p92:c2
  - dbms-ramakrishnan-3rd-edition:p93:c1
  - dbms-ramakrishnan-3rd-edition:p93:c2
  - dbms-ramakrishnan-3rd-edition:p93:c3
  - dbms-ramakrishnan-3rd-edition:p94:c1
  - dbms-ramakrishnan-3rd-edition:p94:c2
  - dbms-ramakrishnan-3rd-edition:p94:c3
  - dbms-ramakrishnan-3rd-edition:p95:c1
  - dbms-ramakrishnan-3rd-edition:p95:c2
  - dbms-ramakrishnan-3rd-edition:p96:c1
  - dbms-ramakrishnan-3rd-edition:p96:c2
  - dbms-ramakrishnan-3rd-edition:p96:c3
relatedConcepts:
tags:
  - relational
  - algebra
  - theory
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Relational Algebra

## Definition
Formal language for manipulating relations using operations like selection, projection, and join

## Explanation
CHAPTER 2 Monitors /~ I._. _. - - - -.- - - - - - - - - - ~ -~ - - - - - - - - - - - - - - - - - - ~ - - - - - - - -- - - - - - - ~ - - - - - - - - -- - -- -; I I ~: - I Departments Sponsors I I I I I ---------------------------------------- I ------~~~~~------- Aggregation When should we use aggregation? Intuitively, we use it when we need to express a relationship among relationships. But can we not express relationships involving other relationships without using aggregation? In our example, why not make Sponsors a ternary relationship? The answer is that there are really two distinct relationships, Sponsors and Monitors, each possibly with attributes of its own. For instance, the Monitors relationship has an attribute 1tntil that records the date until when the employee is appointed as the sponsorship monitor. Compare this attribute with the attribute since of Sponsors, which is the date when

Monitors relationship has an attribute 1tntil that records the date until when the employee is appointed as the sponsorship monitor. Compare this attribute with the attribute since of Sponsors, which is the date when the sponsorship took effect. The use of aggregation versus a ternary relationship may also be guided by certain integrity constraints, as explained in Section 2.5.4. 2.5 CONCEPTUAL DESIGN WITH THE ER MODEL Developing an ER diagram presents several choices, including the following:.. Should a concept be modeled as an entity or an attribute?.. Should a concept be modeled &'3 an entity or a relationship? II "Vhat arc the relationship sets and their participating entity sets? Should we use binary or ternary relationships? II Should we use aggregation?

Introd'lLct'ion to Database Design \Ve now discuss the issues involved in making these choices. 2.5.1 Entity versus Attribute \Vhile identifying the attributes of an entity set, it is sometimes not clear whether a property should be modeled as an attribute or as an entity set (and related to the first entity set usi

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
*Source: dbms-ramakrishnan-3rd-edition, Pages 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96*
