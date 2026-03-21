---
id: relational-databases-murach
title: Relational Databases
definition: Tables, rows, columns, keys, and relationships in relational databases
difficulty: beginner
estimatedReadTime: 5
pageReferences: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39]
chunkIds:
  - murachs-mysql-3rd-edition:p21:c1
  - murachs-mysql-3rd-edition:p23:c1
  - murachs-mysql-3rd-edition:p23:c2
  - murachs-mysql-3rd-edition:p24:c1
  - murachs-mysql-3rd-edition:p24:c2
  - murachs-mysql-3rd-edition:p25:c1
  - murachs-mysql-3rd-edition:p25:c2
  - murachs-mysql-3rd-edition:p26:c1
  - murachs-mysql-3rd-edition:p26:c2
  - murachs-mysql-3rd-edition:p27:c1
  - murachs-mysql-3rd-edition:p27:c2
  - murachs-mysql-3rd-edition:p28:c1
  - murachs-mysql-3rd-edition:p28:c2
  - murachs-mysql-3rd-edition:p28:c3
  - murachs-mysql-3rd-edition:p29:c1
  - murachs-mysql-3rd-edition:p29:c2
  - murachs-mysql-3rd-edition:p30:c1
  - murachs-mysql-3rd-edition:p30:c2
  - murachs-mysql-3rd-edition:p30:c3
  - murachs-mysql-3rd-edition:p30:c4
  - murachs-mysql-3rd-edition:p31:c1
  - murachs-mysql-3rd-edition:p31:c2
  - murachs-mysql-3rd-edition:p31:c3
  - murachs-mysql-3rd-edition:p32:c1
  - murachs-mysql-3rd-edition:p32:c2
  - murachs-mysql-3rd-edition:p33:c1
  - murachs-mysql-3rd-edition:p33:c2
  - murachs-mysql-3rd-edition:p33:c3
  - murachs-mysql-3rd-edition:p34:c1
  - murachs-mysql-3rd-edition:p34:c2
  - murachs-mysql-3rd-edition:p35:c1
  - murachs-mysql-3rd-edition:p35:c2
  - murachs-mysql-3rd-edition:p36:c1
  - murachs-mysql-3rd-edition:p36:c2
  - murachs-mysql-3rd-edition:p36:c3
  - murachs-mysql-3rd-edition:p37:c1
  - murachs-mysql-3rd-edition:p38:c1
  - murachs-mysql-3rd-edition:p38:c2
  - murachs-mysql-3rd-edition:p38:c3
  - murachs-mysql-3rd-edition:p39:c1
  - murachs-mysql-3rd-edition:p39:c2
  - murachs-mysql-3rd-edition:p39:c3
relatedConcepts:
tags:
  - mysql
  - relational
  - design
sourceDocId: murachs-mysql-3rd-edition
---

# Relational Databases

## Definition
Tables, rows, columns, keys, and relationships in relational databases

## Explanation
An introduction to MySQL Before you begin to learn how to write SQL statements that work with MySQL, you need to understand some concepts and terms related to SQL and relational databases. That's what you'll learn in chapter 1. In addition, you'll need to learn about some of the tools you can use to work with a MySQL database. That's what you'll learn in chapter 2. After that, you'll be ready to learn about the most important SQL statements. In chapter 3, you'll learn how to use the SELECT statement to retrieve data from a single table. In chapter 4, you'll learn how to use the SELECT statement to retrieve data from two or more tables. And in chapter 5, you'll learn how to use the INSERT, UPDATE, and DELETE statements to add, update, and delete rows. At that point, you'll have all of the background and skills that you need to work with the rest of this book.

An introduction to relational databases This chapter presents the concepts and term.~ that you should understand before }rou begin learning how to \Vork \Vith a SQL database such as 1'1ySQL. Although thi chapter doesn't present the coding details. it doe pre. ent an o~ en ie"'' of the most importa.11t type ot SQL staten1ents that are presented in this book. An introduction to client/server systems ~ ~ 4 n1e l1ardware co1nponeru of a cl1entlser,er sy!den1...................................... 4 rhe. ot l\vare con1ponents at a client/. er,,er S)' ten1........................................ 6 01.he1 cl ie r1t/.ser, er architec1 ut es..................................................................... & An intr,oductlon to the relational database model............ 10 Ho\\' a table is 01gan1zed........................................ -..................................... 10 Ho'\\' r:ible~ are re lated.................................. --................... -.............................................. 12 Ho\.v column!! are uelined.............................................................................. 14 

## Examples
### Example 1: SELECT Example
```sql
SELECT statement to retrieve data from a single table. In chapter 4, you'll learn how to use the SELECT statement to retrieve data from two or more tables. And in chapter 5, you'll learn how to use the INSERT, UPDATE, and DELETE statements to add, update, and delete rows. At that point, you'll have all of the background and skills that you need to work with the rest of this book.

An introduction to relational databases This chapter presents the concepts and term.~ that you should understand before }rou begin learning how to \Vork \Vith a SQL database such as 1'1ySQL. Although thi chapter doesn't present the coding details. it doe pre. ent an o~ en ie"'' of the most importa.11t type ot SQL staten1ents that are presented in this book. An introduction to client/server systems ~ ~ 4 n1e l1ardware co1nponeru of a cl1entlser,er sy!den1...................................... 4 rhe. ot l\vare con1ponents at a client/. er,,er S)' ten1........................................ 6 01.he1 cl ie r1t/.ser, er architec1 ut es..................................................................... & An intr,oductlon to the relational database model............ 10 Ho\\' a table is 01gan1zed........................................ -..................................... 10 Ho'\\' r:ible~ are re lated.................................. --................... -.............................................. 12 Ho\.v column!! are uelined.............................................................................. 14 Hov.• Lo read a database diagratn.................................................................... 16... An introduction to SQL and SOL-based systems............. 18 A briet J1i tor) ot SQL.................................................................,.................................-......................... _... 18 A co111par1sot1 oJ Orucle. 082. ~1 icrt)s.oft SQL Sen,er. and My QL........... 20 The SOL stateme.nts................................................................ 22 An 1nuoducuon to the SQL ~ta1e1nenb................................................... - 21 Hov.• 10 v.ork '"itJ1 database objel. L'i... -.....................................

Orucle. 082. ~1 icrt)s.oft SQL Sen,er. and My QL........... 20 The SOL stateme.nts................................................................ 22 An 1nuoducuon to the SQL ~ta1e1nenb................................................... - 21 Hov.• 10 v.ork '"itJ1 database objel. L'i... -..................................... - 24 Ho\\ to query a;
```
Example SELECT statement from textbook.

### Example 2: DELETE Example
```sql
DELETE statements to add, update, and delete rows. At that point, you'll have all of the background and skills that you need to work with the rest of this book.

An introduction to relational databases This chapter presents the concepts and term.~ that you should understand before }rou begin learning how to \Vork \Vith a SQL database such as 1'1ySQL. Although thi chapter doesn't present the coding details. it doe pre. ent an o~ en ie"'' of the most importa.11t type ot SQL staten1ents that are presented in this book. An introduction to client/server systems ~ ~ 4 n1e l1ardware co1nponeru of a cl1entlser,er sy!den1...................................... 4 rhe. ot l\vare con1ponents at a client/. er,,er S)' ten1........................................ 6 01.he1 cl ie r1t/.ser, er architec1 ut es..................................................................... & An intr,oductlon to the relational database model............ 10 Ho\\' a table is 01gan1zed........................................ -..................................... 10 Ho'\\' r:ible~ are re lated.................................. --................... -.............................................. 12 Ho\.v column!! are uelined.............................................................................. 14 Hov.• Lo read a database diagratn.................................................................... 16... An introduction to SQL and SOL-based systems............. 18 A briet J1i tor) ot SQL.................................................................,.................................-......................... _... 18 A co111par1sot1 oJ Orucle. 082. ~1 icrt)s.oft SQL Sen,er. and My QL........... 20 The SOL stateme.nts................................................................ 22 An 1nuoducuon to the SQL ~ta1e1nenb................................................... - 21 Hov.• 10 v.ork '"itJ1 database objel. L'i... -.....................................

Orucle. 082. ~1 icrt)s.oft SQL Sen,er. and My QL........... 20 The SOL stateme.nts................................................................ 22 An 1nuoducuon to the SQL ~ta1e1nenb................................................... - 21 Hov.• 10 v.ork '"itJ1 database objel. L'i... -..................................... - 24 Ho\\ to query a;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39*
