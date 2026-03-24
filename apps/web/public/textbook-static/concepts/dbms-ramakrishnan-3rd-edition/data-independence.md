---
id: data-independence
title: Data Independence
definition: Logical and physical data independence - how DBMS separates data from applications
difficulty: beginner
estimatedReadTime: 5
pageReferences: [15, 16, 17, 18, 19, 20, 21, 22]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p15:c1
  - dbms-ramakrishnan-3rd-edition:p16:c1
  - dbms-ramakrishnan-3rd-edition:p17:c1
  - dbms-ramakrishnan-3rd-edition:p17:c2
  - dbms-ramakrishnan-3rd-edition:p18:c1
  - dbms-ramakrishnan-3rd-edition:p18:c2
  - dbms-ramakrishnan-3rd-edition:p19:c1
  - dbms-ramakrishnan-3rd-edition:p20:c1
  - dbms-ramakrishnan-3rd-edition:p20:c2
  - dbms-ramakrishnan-3rd-edition:p21:c1
  - dbms-ramakrishnan-3rd-edition:p21:c2
  - dbms-ramakrishnan-3rd-edition:p22:c1
relatedConcepts:
tags:
  - dbms
  - architecture
  - fundamentals
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# Data Independence

## Definition
Logical and physical data independence - how DBMS separates data from applications

## Explanation
Xll DATABASE ~/IANAGE1'vIENT SYSTEMS 9.3 Disk Space Management 9.3.1 Keeping Track of Free Blocks 9.3.2 Using as File Systems to il/ranage Disk Space 9.4 Buffer Manager 9.4.1 Buffer Replacement Policies 9.4.2 Buffer Management in DBMS versus OS 9.5 Files of Records 9.5.1 Implementing Heap Files 9.6 Page Formats 9.6.1 Fixed-Length Records 9.6.2 Variable-Length Records 9.7 Record Formats 9.7.1 Fixed-Length Records 9.7.2 Variable-Length Records 9.8 Review Questions TREE-STRUCTURED INDEXING 10.1 Intuition For Tree Indexes 10.2 Indexed Sequential Access Method (ISAM) 10.2.1 Overflow Pages, Locking Considerations 10.3 B+ Trees: A Dynamic Index Structure 10.3.1 Format of a Node 10.4 Search 10.5 Insert 10.6 Delete 10.7 Duplicates 10.8 B+ Trees in Practice 10.8.1 Key Compression 10.8.2 Bulk-Loading a B+ Tl'ee 10.8.3 The Order Concept 10.8.4 The Effect of Inserts and Deletes on Rids 10.9 Review Questions HASH-BASED INDEXING 11.1 Static Hashing 11.1.1 Notation and Conventions 11.2 Extendible HCkshing 11.3 Line~r Hashing 11.4 Extendible vs. Linear Ha"lhing n.5 Review Questions Part IV QUERY EVALUATION:316

Contents OVERVIEW of QUERY EVALUATION 12.1 The System Catalog 12.1.1 Information in the Catalog 12.2 Introduction to Operator Evaluation 12.2.1 Three Common Techniques 12.2.2 Access Paths 12.3 Algorithms for Relational Operations 12.3.1 Selection 12.3.2 Projection 12.3.3 Join 12.3.4 Other Operations 12.4 Introduction to Query Optimization 12.4.1 Query Evaluation Plans 12.4.2 Multi-operator Queries: Pipelined Evaluation 12.4.3 The Iterator Interface 12.5 Alternative Plans: A Motivating Example 12.5.1 Pushing Selections 12.5.2 Using Indexes 12.6 What a Typical Optimizer Does 12.6.1 Alternative Plans Considered 12.6.2 Estimating the Cost of a Plan 12.7 Review Questions EXTERNAL SORTING 13.1 When Does a DBMS Sort Data? 13.2 A Simple Two-Way Merge Sort 13.3 External Merge Sort 13.3.1 Minimizing the Number of Runs 13.4 Minimizing I/O Cost versus Number of I/Os 13.4.1 Blocked I/O 13

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
*Source: dbms-ramakrishnan-3rd-edition, Pages 15, 16, 17, 18, 19, 20, 21, 22*
