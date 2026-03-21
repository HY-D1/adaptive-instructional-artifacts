---
id: update
title: UPDATE Statement
definition: Modifying existing data in tables
difficulty: beginner
estimatedReadTime: 5
pageReferences: [268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p268:c1
  - dbms-ramakrishnan-3rd-edition:p268:c2
  - dbms-ramakrishnan-3rd-edition:p268:c3
  - dbms-ramakrishnan-3rd-edition:p269:c1
  - dbms-ramakrishnan-3rd-edition:p269:c2
  - dbms-ramakrishnan-3rd-edition:p270:c1
  - dbms-ramakrishnan-3rd-edition:p270:c2
  - dbms-ramakrishnan-3rd-edition:p271:c1
  - dbms-ramakrishnan-3rd-edition:p271:c2
  - dbms-ramakrishnan-3rd-edition:p271:c3
  - dbms-ramakrishnan-3rd-edition:p272:c1
  - dbms-ramakrishnan-3rd-edition:p272:c2
  - dbms-ramakrishnan-3rd-edition:p273:c1
  - dbms-ramakrishnan-3rd-edition:p273:c2
  - dbms-ramakrishnan-3rd-edition:p274:c1
  - dbms-ramakrishnan-3rd-edition:p274:c2
  - dbms-ramakrishnan-3rd-edition:p275:c1
  - dbms-ramakrishnan-3rd-edition:p275:c2
  - dbms-ramakrishnan-3rd-edition:p276:c1
  - dbms-ramakrishnan-3rd-edition:p276:c2
  - dbms-ramakrishnan-3rd-edition:p276:c3
  - dbms-ramakrishnan-3rd-edition:p277:c1
  - dbms-ramakrishnan-3rd-edition:p277:c2
  - dbms-ramakrishnan-3rd-edition:p278:c1
  - dbms-ramakrishnan-3rd-edition:p278:c2
  - dbms-ramakrishnan-3rd-edition:p278:c3
  - dbms-ramakrishnan-3rd-edition:p279:c1
  - dbms-ramakrishnan-3rd-edition:p279:c2
  - dbms-ramakrishnan-3rd-edition:p279:c3
  - dbms-ramakrishnan-3rd-edition:p280:c1
  - dbms-ramakrishnan-3rd-edition:p280:c2
  - dbms-ramakrishnan-3rd-edition:p280:c3
relatedConcepts:
tags:
  - sql
  - dml
  - update
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# UPDATE Statement

## Definition
Modifying existing data in tables

## Explanation
Internet Apphcat'ions 2~3 • A regular expression constructed from the preceding four choices. A regular expression is one of the following: - expL exp2, exp3: A list of regular expressions. - exp*: An optional expression (zero or more occurrences). - exp?: An optional expression (zero or one occurrences). - exp+: A mandatory expression (one or more occurrences). - expl I exp2: expl or exp2. Attributes of elements are declared outside the element. For example, consider the following attribute declaration from <! ATTLIST BOOK GENRE (ScienceIFiction) #REQUIRED» This XML DTD fragment specifies the attribute GENRE, which is an attribute of the element BOOK. The attribute can take two values: Science or Fiction. Each BOOK element must be described in its start tag by a GENRE attribute since the attribute is required as indicated by #REQUIRED. Let us look at the general structure of a DTD attribute declaration: <! ATTLIST elementName (attName attType default)+> The keyword ATTLIST indicates the beginning of an attribute declaration. The string elementName is the name of the element with which the following attribute dcfinition is associated. What

ATTLIST elementName (attName attType default)+> The keyword ATTLIST indicates the beginning of an attribute declaration. The string elementName is the name of the element with which the following attribute dcfinition is associated. What follows is the declaration of one or more attributes. Each attribute has a name, as indicated by attName, and a type, as indicated by attType. XML defines several possible types for an attribute. We discuss only string types and enumerated types here. An attribute of type string can take any string as a value. We can declare such an attribute by setting its type field to CDATA. F'or example, we can declare a third attribute of type string of the elernent BOOK a.s follows: <!ATTLIST BOOK edition CDATA "1"> If an attribute has an enumerated type, we list all its possible values in the attribute decl

## Examples
### Example 1: SELECT Example
```sql
SELECT tags;
```
Example SELECT statement from textbook.

### Example 2: UPDATE Example
```sql
update and maintain the business logic, since the application code runs at many client sites. Second, a large amount of trust is required between the server and the clients. As an exam-- pIe, the DBMS

and maintain the business logic, since the application code runs at many client sites. Second, a large amount of trust is required between the server and the clients. As an exam-- pIe, the DBMS of a bank has to trust the (application executing at an) ATM machine to leave the database in a consistent state. (One way to address this problem is through stored procedures, trusted application code that is registered with the DBMS and can be called from SQL statelnents. 'Ve discuss stored procedures in detail in Section 6.5.) A third disadvantage of the thick-client architecture is that it does not scale with the number of clients;
```
Example UPDATE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280*
