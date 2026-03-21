---
id: cardinality
title: Cardinality Constraints
definition: Specifying how many instances of one entity relate to instances of another
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p45:c1
  - dbms-ramakrishnan-3rd-edition:p45:c2
  - dbms-ramakrishnan-3rd-edition:p45:c3
  - dbms-ramakrishnan-3rd-edition:p46:c1
  - dbms-ramakrishnan-3rd-edition:p46:c2
  - dbms-ramakrishnan-3rd-edition:p47:c1
  - dbms-ramakrishnan-3rd-edition:p47:c2
  - dbms-ramakrishnan-3rd-edition:p47:c3
  - dbms-ramakrishnan-3rd-edition:p48:c1
  - dbms-ramakrishnan-3rd-edition:p48:c2
  - dbms-ramakrishnan-3rd-edition:p49:c1
  - dbms-ramakrishnan-3rd-edition:p49:c2
  - dbms-ramakrishnan-3rd-edition:p49:c3
  - dbms-ramakrishnan-3rd-edition:p50:c1
  - dbms-ramakrishnan-3rd-edition:p50:c2
  - dbms-ramakrishnan-3rd-edition:p50:c3
  - dbms-ramakrishnan-3rd-edition:p51:c1
  - dbms-ramakrishnan-3rd-edition:p51:c2
  - dbms-ramakrishnan-3rd-edition:p51:c3
  - dbms-ramakrishnan-3rd-edition:p52:c1
  - dbms-ramakrishnan-3rd-edition:p52:c2
  - dbms-ramakrishnan-3rd-edition:p52:c3
  - dbms-ramakrishnan-3rd-edition:p53:c1
  - dbms-ramakrishnan-3rd-edition:p53:c2
  - dbms-ramakrishnan-3rd-edition:p53:c3
  - dbms-ramakrishnan-3rd-edition:p53:c4
  - dbms-ramakrishnan-3rd-edition:p54:c1
  - dbms-ramakrishnan-3rd-edition:p54:c2
  - dbms-ramakrishnan-3rd-edition:p54:c3
  - dbms-ramakrishnan-3rd-edition:p55:c1
  - dbms-ramakrishnan-3rd-edition:p55:c2
  - dbms-ramakrishnan-3rd-edition:p56:c1
  - dbms-ramakrishnan-3rd-edition:p56:c2
  - dbms-ramakrishnan-3rd-edition:p56:c3
  - dbms-ramakrishnan-3rd-edition:p57:c1
  - dbms-ramakrishnan-3rd-edition:p57:c2
  - dbms-ramakrishnan-3rd-edition:p57:c3
  - dbms-ramakrishnan-3rd-edition:p58:c1
  - dbms-ramakrishnan-3rd-edition:p58:c2
  - dbms-ramakrishnan-3rd-edition:p58:c3
relatedConcepts:
tags:
  - modeling
  - constraints
  - relationships
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Cardinality Constraints

## Definition
Specifying how many instances of one entity relate to instances of another

## Explanation
CHAPTER:l such a situation, the abstract view of the datet presented by the DBlVIS does not match the application's needs and actually gets in the way. As an example, relational databa.'3es do not support flexible analysis of text data (although vendors are now extending their products in this direction). If specialized performance or data manipulation requirements are central to an application, the application may choose not to use a DBMS, especially if the added benefits of a DBMS (e.g., flexible querying, security, concurrent access, and crash recovery) are not required. In most situations calling for large-scale data management, however, DBlVISs have become an indispensable tool. 1.5 DESCRIBING AND STORING DATA IN A DBMS The user of a DBMS is ultimately concerned with some real-world enterprise, and the data to be stored describes various aspects of this enterprise. For example, there are students, faculty, and courses in a university, and the data in a university database describes these entities and their relationships. A data model is a collection of high-level data description constructs that hide many low-level storage details. A DBMS

university, and the data in a university database describes these entities and their relationships. A data model is a collection of high-level data description constructs that hide many low-level storage details. A DBMS allows a user to define the data to be stored in terms of a data model. Most database management systems today are based on the relational data model, which we focus on in this book. While the data model of the DBMS hides many details, it is nonetheless closer to how the DBMS stores data than to how a user thinks about the underlying enterprise. A semantic data model is a more abstract, high-level data model that makes it easier for a user to come up with a good initial description of the data in an enterprise. These models contain a wide variety of constructs that help describe a real application scenario. A 

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
*Source: dbms-ramakrishnan-3rd-edition, Pages 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58*
