---
id: relational-model-intro
title: Introduction to Relational Databases
definition: Overview of database systems, relational model basics, and data independence
difficulty: beginner
estimatedReadTime: 10
pageReferences: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p2:c1
  - dbms-ramakrishnan-3rd-edition:p3:c1
  - dbms-ramakrishnan-3rd-edition:p4:c1
  - dbms-ramakrishnan-3rd-edition:p6:c1
  - dbms-ramakrishnan-3rd-edition:p7:c1
  - dbms-ramakrishnan-3rd-edition:p7:c2
  - dbms-ramakrishnan-3rd-edition:p8:c1
  - dbms-ramakrishnan-3rd-edition:p10:c1
  - dbms-ramakrishnan-3rd-edition:p11:c1
  - dbms-ramakrishnan-3rd-edition:p11:c2
  - dbms-ramakrishnan-3rd-edition:p12:c1
  - dbms-ramakrishnan-3rd-edition:p12:c2
  - dbms-ramakrishnan-3rd-edition:p13:c1
relatedConcepts:
tags:
  - dbms
  - relational
  - fundamentals
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Introduction to Relational Databases

## Definition
Overview of database systems, relational model basics, and data independence

## Explanation
It's your choice! New Modular Organization! Relational Model SQLDDL Infonnation Retrieval and XML Data Management ER Model Conceptual Design Appncatirms emphasis: A course that covers the principles of database systems and emphasizes how they are used in developing data-intensive applications.. f,;~tY'W';Yl~t';;:;,~7' A course that has a strong systems emphasis and assumes that students have good programming skills in C and C++. Hybrid course: Modular organization allows you to teach the course with the emphasis you want.......-:= Dependencies ~~~ I v I II IV VIr III

j j j j j j j j j j j j j j j j j j j j j j j j j j j j j j

DATABASE MANAGEMENT SYSTEMS

DATABASE MANAGEMENT SYSTEMS Third Edition Raghu Ramakrishnan University of Wisconsin Madison, Wisconsin, USA • Johannes Gehrke Cornell University Ithaca, New York, USA Boston Burr Ridge, IL Dubuque, IA Madison, WI New York San Francisco St. Louis Bangkok Bogota Caracas Kuala Lumpur Lisbon London Madrid Mexico City Milan Montreal New Delhi Santiago Seoul Singapore Sydney Taipei Toronto

McGraw-Hill Higher Education tz A Lhvision of The McGraw-Hill Companies DATABASE MANAGEMENT SYSTEMS, THIRD EDITION International Edition 2003 Exclusive rights by McGraw-Hill Education (Asia), for manufacture and export. This book cannot be re-exported from the country to which it is sold by McGraw-Hill. The International Edition is not available in North America. Published by McGraw-Hili, a business unit of The McGraw-Hili Companies, Inc., 1221 Avenue of the Americas, New York, NY 10020. Copyright © 2003, 2000, 1998 by The McGraw-Hill Companies, Inc. All rights reserved. No part of this publication may be reproduced or distributed in any form or by any means, or stored in a database or retrieval system, without the prior written consent of The McGraw-Hill Companies, Inc., including, but not limited to, in any network or other electronic storage or transmission, or broadcast for distance learning. Some ancillaries, including electron

## Examples
### Example 1: SELECT Example
```sql
SELECT Command 5.3 UNION, INTERSECT, and EXCEPT 5.4 Nested Queries 5.4.1 Introduction to Nested Queries 5.4.2 Correlated Nested Queries 5.4.3 Set-Comparison Operators 5.4.4 More Examples of Nested Queries 5.5 Aggregate Operators 5.5.1 The GROUP BY and HAVING Clauses 5.5.2 More Examples of Aggregate Queries 5.6 Null Values 5.6.1 Comparisons Using Null Values 5.6.2 Logical Connectives AND, OR, and NOT 5.6.3 Impact 011 SQL Constructs 5.6.4 Outer Joins 5.6.5 Disallowing Null Values 5.7 Complex Integrity Constraints in SQL 5.7.1 Constraints over a Single Table 5.7.2 Domain Constraints and Distinct Types 5.7.3 Assertions: ICs over Several Tables 5.8 Triggers and Active Databases 5.8.1 Examples of Triggers in SQL 5.9 Designing Active Databases 5.9.1 Why Triggers Can Be Hard

Table 5.7.2 Domain Constraints and Distinct Types 5.7.3 Assertions: ICs over Several Tables 5.8 Triggers and Active Databases 5.8.1 Examples of Triggers in SQL 5.9 Designing Active Databases 5.9.1 Why Triggers Can Be Hard to Understand 5.9.2 Constraints versus Triggers 5.9.:3 Other Uses of Triggers 5.10 Review Questions 17:3

x DATABASE J\;
```
Example SELECT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13*
