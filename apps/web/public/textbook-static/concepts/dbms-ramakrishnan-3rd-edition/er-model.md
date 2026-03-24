---
id: er-model
title: Entity-Relationship Model
definition: Modeling database structure using entities, relationships, and attributes
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p25:c1
  - dbms-ramakrishnan-3rd-edition:p25:c2
  - dbms-ramakrishnan-3rd-edition:p26:c1
  - dbms-ramakrishnan-3rd-edition:p27:c1
  - dbms-ramakrishnan-3rd-edition:p27:c2
  - dbms-ramakrishnan-3rd-edition:p28:c1
  - dbms-ramakrishnan-3rd-edition:p28:c2
  - dbms-ramakrishnan-3rd-edition:p28:c3
  - dbms-ramakrishnan-3rd-edition:p29:c1
  - dbms-ramakrishnan-3rd-edition:p29:c2
  - dbms-ramakrishnan-3rd-edition:p29:c3
  - dbms-ramakrishnan-3rd-edition:p30:c1
  - dbms-ramakrishnan-3rd-edition:p30:c2
  - dbms-ramakrishnan-3rd-edition:p31:c1
  - dbms-ramakrishnan-3rd-edition:p31:c2
  - dbms-ramakrishnan-3rd-edition:p31:c3
  - dbms-ramakrishnan-3rd-edition:p32:c1
  - dbms-ramakrishnan-3rd-edition:p32:c2
  - dbms-ramakrishnan-3rd-edition:p32:c3
  - dbms-ramakrishnan-3rd-edition:p33:c1
  - dbms-ramakrishnan-3rd-edition:p33:c2
  - dbms-ramakrishnan-3rd-edition:p33:c3
  - dbms-ramakrishnan-3rd-edition:p33:c4
  - dbms-ramakrishnan-3rd-edition:p34:c1
  - dbms-ramakrishnan-3rd-edition:p34:c2
  - dbms-ramakrishnan-3rd-edition:p34:c3
  - dbms-ramakrishnan-3rd-edition:p35:c1
  - dbms-ramakrishnan-3rd-edition:p35:c2
  - dbms-ramakrishnan-3rd-edition:p35:c3
  - dbms-ramakrishnan-3rd-edition:p36:c1
  - dbms-ramakrishnan-3rd-edition:p38:c1
  - dbms-ramakrishnan-3rd-edition:p38:c2
  - dbms-ramakrishnan-3rd-edition:p39:c1
  - dbms-ramakrishnan-3rd-edition:p39:c2
  - dbms-ramakrishnan-3rd-edition:p39:c3
relatedConcepts:
tags:
  - modeling
  - er
  - design
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Entity-Relationship Model

## Definition
Modeling database structure using entities, relationships, and attributes

## Explanation
xxii DATABASE l\1ANAGEMENT SYSTEMS 27.2 Introduction to Information Retrieval 27.2.1 Vector Space Model 27.2.2 TFjIDF Weighting of Terms 27.2.3 Ranking Document Similarity 27.2.4:Measuring Success: Precision and Recall 27.3 Indexing for Text Search 27.3.1 Inverted Indexes 27.3.2 Signature Files 27.4 Web Search Engines 27.4.1 Search Engine Architecture 27.4.2 Using Link Information 27.5 Managing Text in a DBMS 27.5.1 Loosely Coupled Inverted Index 27.6 A Data Model for XML 27.6.1 Motivation for Loose Structure 27.6.2 A Graph Model 27.7 XQuery: Querying XML Data 27.7.1 Path Expressions 27.7.2 FLWR Expressions 27.7.3 Ordering of Elements 27.7.4 Grouping and Generation of Collection Values 27.8 Efficient Evaluation of XML Queries 27.8.1 Storing XML in RDBMS 27.8.2 Indexing XML Repositories 27.9 Review Questions SPATIAL DATA MANAGEMENT 28.1 Types of Spatial Data and Queries 28.2 Applications Involving Spatial Data 28.3 Introduction to Spatial Indexes 28.3.1 Overview of Proposed Index Structures 28.4 Indexing Based on Space-Filling Curves 28.4.1 Region Quad Trees and Z-Ordering: Region Data 28.4.2 Spatial Queries Using Z-Ordering 28.5 Grid Files 28..5.1 Adapting Grid Files to Handle Regions 28.6 R Trees: Point and Region Data 28.6~1 Queries

Region Quad Trees and Z-Ordering: Region Data 28.4.2 Spatial Queries Using Z-Ordering 28.5 Grid Files 28..5.1 Adapting Grid Files to Handle Regions 28.6 R Trees: Point and Region Data 28.6~1 Queries 28.6.2 Insert and Delete Operations 28.6.3 Concurrency Control 28.6.4 Generalized Search Trees 28.7 Issues in High-Dimensional Indexing 28.8 Review Questions

Contents FURTHER READING 29.1 Advanced Tl"ansaction Processing 29.1.1 Transaction Processing Monitors 29.1.2 New Transaction Models 29.1.3 Real-Time DBlvISs 29.2 Data Integration 29.3 Mobile Databases 29.4 Main Memory Databases 29.5 Multimedia Databases 29.6 Geographic Information Systems 29.7 Temporal Databases 29.8 Biological Databases 29.9 Information Visualization 29.10 Summary T

## Examples
### Example 1: INSERT Example
```sql
Insert and Delete Operations 28.6.3 Concurrency Control 28.6.4 Generalized Search Trees 28.7 Issues in High-Dimensional Indexing 28.8 Review Questions

Contents FURTHER READING 29.1 Advanced Tl"ansaction Processing 29.1.1 Transaction Processing Monitors 29.1.2 New Transaction Models 29.1.3 Real-Time DBlvISs 29.2 Data Integration 29.3 Mobile Databases 29.4 Main Memory Databases 29.5 Multimedia Databases 29.6 Geographic Information Systems 29.7 Temporal Databases 29.8 Biological Databases 29.9 Information Visualization 29.10 Summary THE MINIBASE SOFTWARE 30.1 What Is Available 30.2 Overview of Minibase Assignments 30.3 Acknowledgments REFERENCES AUTHOR INDEX SUBJECT INDEX xxm 1000 1000 1002 1002 1003 1004 1005 1045 1054

PREFACE The advantage of doing one's praising for oneself is that one can lay it on so thick and exactly in the right places. --Samuel Butler Database management systems are now an indispensable tool for managing information, and a course on the principles and practice of database systems is now an integral part of computer science curricula. This book covers the fundamentals of modern database management systems, in particular relational database systems. We have attempted to present the material in a clear, simple style. A quantitative approach is used throughout with many detailed examples. An extensive set of exercises (for which solutions are available online to instructors) accompanies each chapter and reinforces students' ability to apply the concepts to real problems. The book can be used with the accompanying software and programming assignments in two distinct kinds of introductory courses: 1. Applications Emphasis: A course that covers the principles of database systems, and emphasizes how they are used in developing data-intensive applications. Two new chapters on application development (one on databasebacked applications, and one on Java and Internet application architectures)

of database systems, and emphasizes how they are used in developing data-intensive applications. Two new chapters on application development (one on databasebacked applications, and one on Java and Internet application architectures) have been added to the third edition, and the entire book has been extensively revised and reorganized to support such a course. A running case-study and extensive online materials (e.g., code for SQL queries and Java applications, online databases and solutions) make it easy to teach a hands-on application-centric course. 2. Systems Emphasis: A course that has a strong systems emphasis and assumes that students have good programming skills in C and C++. In this case the accompanying Minibase software can be llsed as the basis for projects in which students are asked to implement various parts of a relational DBMS. Several central modules in the project software (e.g., heap files, buffer manager, B+ trees, hash indexes, various join methods) xxiv

PTeface XKV are described in sufficient detail in the text to enable students to implement them, given the (C++) class interfaces. r..,1any instructors will no doubt teach a course that falls between these two extremes. The restructuring in the third edition offers a very modular organization that facilitates such hybrid courses. The also book contains enough material to support advanced courses in a two-course sequence. Organization of the Third Edition The book is organized into six main parts plus a collection of advanced topics, as shown in (1) Foundations Both (2) Application Development Applications emphasis (3) Storage and Indexing Systems emphasis (4) Query Evaluation Systems emphasis (5) Transaction Management Systems emphasis (6) Database Design and Tuning Applications emphasis (7) Additional Topics Both Organization of Parts in the Third Edition ER model and the relational model. They explain how databases are created and used, and cover the basics of database design and querying, including an in-depth treatment of SQL queries. While an instructor can omit some of this material at their discretion (e.g., relational calculus, some sections on the ER model

basics of database design and querying, including an in-depth treatment of SQL queries. While an instructor can omit some of this material at their discretion (e.g., relational calculus, some sections on the ER model or SQL queries), this material is relevant to every student of database systems, and we recommend that it be covered in as much detail as possible. Each of the remaining five main parts has either an application or a systems empha.sis. Each of the three Systems parts has an overview chapter, designed to provide a self-contained treatment, e.g., Chapter 8 is an overview of storage and indexing. The overview chapters can be used to provide stand-alone coverage of the topic, or as the first chapter in a more detailed treatment. Thus, in an application-oriented course, Chapter 8 might be the only material covered on file organizations and indexing, whereas in a systems-oriented course it would be supplemented by a selection from Chapters 9 through 11. The Database Design and Tuning part contains a discussion of performance tuning and designing for secure access. These application topics are

would be supplemented by a selection from Chapters 9 through 11. The Database Design and Tuning part contains a discussion of performance tuning and designing for secure access. These application topics are best covered after giving students a good grasp of database system architecture, and are therefore placed later in the chapter sequence.

XXVI Suggested Course Outlines DATABASE ~1ANAGEMENT SYSTEMS The book can be used in two kinds of introductory database courses, one with an applications emphasis and one with a systems empha..':iis. The introductory applications-oriented course could cover the:Foundations chapters, then the Application Development chapters, followed by the overview systems chapters, and conclude with the Database Design and Tuning material. Chapter dependencies have been kept to a minimum, enabling instructors to easily fine tune what material to include. The Foundations material, Part I, should be covered first, and within Parts III, IV, and V, the overview chapters should be covered first. The only remaining dependencies between chapters in Parts I to VI are shown as arrows in The chapters in Part I should be covered in sequence. However, the coverage of algebra and calculus can be skipped in order to get to SQL queries sooner (although we believe this material is important and recommend that it should be covered before SQL). The introductory systems-oriented course would cover the Foundations chapters and a selection of Applications and Systems chapters. An important point for

material is important and recommend that it should be covered before SQL). The introductory systems-oriented course would cover the Foundations chapters and a selection of Applications and Systems chapters. An important point for systems-oriented courses is that the timing of programming projects (e.g., using Minibase) makes it desirable to cover some systems topics early. Chapter dependencies have been carefully limited to allow the Systems chapters to be covered as soon as Chapters 1 and 3 have been covered. The remaining Foundations chapters and Applications chapters can be covered subsequently. The book also has ample material to support a multi-course sequence. Obviously, choosing an applications or systems emphasis in the introductory course results in dropping certain material from the course;
```
Example INSERT statement from textbook.

### Example 2: DELETE Example
```sql
Delete Operations 28.6.3 Concurrency Control 28.6.4 Generalized Search Trees 28.7 Issues in High-Dimensional Indexing 28.8 Review Questions

Contents FURTHER READING 29.1 Advanced Tl"ansaction Processing 29.1.1 Transaction Processing Monitors 29.1.2 New Transaction Models 29.1.3 Real-Time DBlvISs 29.2 Data Integration 29.3 Mobile Databases 29.4 Main Memory Databases 29.5 Multimedia Databases 29.6 Geographic Information Systems 29.7 Temporal Databases 29.8 Biological Databases 29.9 Information Visualization 29.10 Summary THE MINIBASE SOFTWARE 30.1 What Is Available 30.2 Overview of Minibase Assignments 30.3 Acknowledgments REFERENCES AUTHOR INDEX SUBJECT INDEX xxm 1000 1000 1002 1002 1003 1004 1005 1045 1054

PREFACE The advantage of doing one's praising for oneself is that one can lay it on so thick and exactly in the right places. --Samuel Butler Database management systems are now an indispensable tool for managing information, and a course on the principles and practice of database systems is now an integral part of computer science curricula. This book covers the fundamentals of modern database management systems, in particular relational database systems. We have attempted to present the material in a clear, simple style. A quantitative approach is used throughout with many detailed examples. An extensive set of exercises (for which solutions are available online to instructors) accompanies each chapter and reinforces students' ability to apply the concepts to real problems. The book can be used with the accompanying software and programming assignments in two distinct kinds of introductory courses: 1. Applications Emphasis: A course that covers the principles of database systems, and emphasizes how they are used in developing data-intensive applications. Two new chapters on application development (one on databasebacked applications, and one on Java and Internet application architectures)

of database systems, and emphasizes how they are used in developing data-intensive applications. Two new chapters on application development (one on databasebacked applications, and one on Java and Internet application architectures) have been added to the third edition, and the entire book has been extensively revised and reorganized to support such a course. A running case-study and extensive online materials (e.g., code for SQL queries and Java applications, online databases and solutions) make it easy to teach a hands-on application-centric course. 2. Systems Emphasis: A course that has a strong systems emphasis and assumes that students have good programming skills in C and C++. In this case the accompanying Minibase software can be llsed as the basis for projects in which students are asked to implement various parts of a relational DBMS. Several central modules in the project software (e.g., heap files, buffer manager, B+ trees, hash indexes, various join methods) xxiv

PTeface XKV are described in sufficient detail in the text to enable students to implement them, given the (C++) class interfaces. r..,1any instructors will no doubt teach a course that falls between these two extremes. The restructuring in the third edition offers a very modular organization that facilitates such hybrid courses. The also book contains enough material to support advanced courses in a two-course sequence. Organization of the Third Edition The book is organized into six main parts plus a collection of advanced topics, as shown in (1) Foundations Both (2) Application Development Applications emphasis (3) Storage and Indexing Systems emphasis (4) Query Evaluation Systems emphasis (5) Transaction Management Systems emphasis (6) Database Design and Tuning Applications emphasis (7) Additional Topics Both Organization of Parts in the Third Edition ER model and the relational model. They explain how databases are created and used, and cover the basics of database design and querying, including an in-depth treatment of SQL queries. While an instructor can omit some of this material at their discretion (e.g., relational calculus, some sections on the ER model

basics of database design and querying, including an in-depth treatment of SQL queries. While an instructor can omit some of this material at their discretion (e.g., relational calculus, some sections on the ER model or SQL queries), this material is relevant to every student of database systems, and we recommend that it be covered in as much detail as possible. Each of the remaining five main parts has either an application or a systems empha.sis. Each of the three Systems parts has an overview chapter, designed to provide a self-contained treatment, e.g., Chapter 8 is an overview of storage and indexing. The overview chapters can be used to provide stand-alone coverage of the topic, or as the first chapter in a more detailed treatment. Thus, in an application-oriented course, Chapter 8 might be the only material covered on file organizations and indexing, whereas in a systems-oriented course it would be supplemented by a selection from Chapters 9 through 11. The Database Design and Tuning part contains a discussion of performance tuning and designing for secure access. These application topics are

would be supplemented by a selection from Chapters 9 through 11. The Database Design and Tuning part contains a discussion of performance tuning and designing for secure access. These application topics are best covered after giving students a good grasp of database system architecture, and are therefore placed later in the chapter sequence.

XXVI Suggested Course Outlines DATABASE ~1ANAGEMENT SYSTEMS The book can be used in two kinds of introductory database courses, one with an applications emphasis and one with a systems empha..':iis. The introductory applications-oriented course could cover the:Foundations chapters, then the Application Development chapters, followed by the overview systems chapters, and conclude with the Database Design and Tuning material. Chapter dependencies have been kept to a minimum, enabling instructors to easily fine tune what material to include. The Foundations material, Part I, should be covered first, and within Parts III, IV, and V, the overview chapters should be covered first. The only remaining dependencies between chapters in Parts I to VI are shown as arrows in The chapters in Part I should be covered in sequence. However, the coverage of algebra and calculus can be skipped in order to get to SQL queries sooner (although we believe this material is important and recommend that it should be covered before SQL). The introductory systems-oriented course would cover the Foundations chapters and a selection of Applications and Systems chapters. An important point for

material is important and recommend that it should be covered before SQL). The introductory systems-oriented course would cover the Foundations chapters and a selection of Applications and Systems chapters. An important point for systems-oriented courses is that the timing of programming projects (e.g., using Minibase) makes it desirable to cover some systems topics early. Chapter dependencies have been carefully limited to allow the Systems chapters to be covered as soon as Chapters 1 and 3 have been covered. The remaining Foundations chapters and Applications chapters can be covered subsequently. The book also has ample material to support a multi-course sequence. Obviously, choosing an applications or systems emphasis in the introductory course results in dropping certain material from the course;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39*
