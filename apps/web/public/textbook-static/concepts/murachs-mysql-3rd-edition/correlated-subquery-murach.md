---
id: correlated-subquery-murach
title: Correlated Subqueries
definition: Subqueries that reference outer query columns
difficulty: advanced
estimatedReadTime: 5
pageReferences: [289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300]
chunkIds:
  - murachs-mysql-3rd-edition:p289:c1
  - murachs-mysql-3rd-edition:p290:c1
  - murachs-mysql-3rd-edition:p290:c2
  - murachs-mysql-3rd-edition:p290:c3
  - murachs-mysql-3rd-edition:p291:c1
  - murachs-mysql-3rd-edition:p292:c1
  - murachs-mysql-3rd-edition:p293:c1
  - murachs-mysql-3rd-edition:p293:c2
  - murachs-mysql-3rd-edition:p294:c1
  - murachs-mysql-3rd-edition:p294:c2
  - murachs-mysql-3rd-edition:p295:c1
  - murachs-mysql-3rd-edition:p296:c1
  - murachs-mysql-3rd-edition:p296:c2
  - murachs-mysql-3rd-edition:p297:c1
  - murachs-mysql-3rd-edition:p297:c2
  - murachs-mysql-3rd-edition:p298:c1
  - murachs-mysql-3rd-edition:p298:c2
  - murachs-mysql-3rd-edition:p298:c3
  - murachs-mysql-3rd-edition:p299:c1
  - murachs-mysql-3rd-edition:p299:c2
  - murachs-mysql-3rd-edition:p300:c1
  - murachs-mysql-3rd-edition:p300:c2
  - murachs-mysql-3rd-edition:p300:c3
relatedConcepts:
tags:
  - mysql
  - subqueries
  - correlated
  - advanced
sourceDocId: murachs-mysql-3rd-edition
---

# Correlated Subqueries

## Definition
Subqueries that reference outer query columns

## Explanation
Chapter 9 How to use functions The Float_ Sample table float_id Roat_value ► o. 999999999999999 1.000000000000001 1234.56789012345 999.0'l'l,qQ209348 I 24.04849 -.I... A search for an exact value that doesn't include two approximate values SELECT* FROM float_sample WHERE float_value = 1 I float_id float_value ► r 2 How to search for approximate values Search for a range of values SELECT* FROM float_ sample WHERE float_value BETWEEN 0.99 AND 1.01 float id - float_value - - ► 0.999999999999999 LOOOOOOOOOOOOOO 1 Search for rounded values SELECT* FROM float_ sample WHERE ROUND(float_value, 2) = 1.00 float_id float_value ► 0. 999999999999999 1. 00000000000000 l Description • Becat1se floating-point values are approximate, you'll want to search for approximate values when working with floating-point data types such as the DOUBLE and FLOAT types. How to search for floating-point numbers

How to work with date/time data In the topics that follow, you'll learn how to use some of the functions that MySQL provides for working with dates and times. As you'll see, these include functions for extracting different parts of a date/time value and for performing operations on dates and times. In addition, you '11 learn how to perfor1n different types of searches on date/time values. How to get the current date and time work. The NOW, CURDATE, and CURTIME functions return the local dates and/or times based on your system's clock. However, if a session time zone has been set, the value returned by the CURDATE and CURTIME functions is adjusted to accommodate that time zone. The UTC_DATE and UTC_TIME functions work siinilarly, but they return the Universal Time Coordinate (UTC) date, also known as Greenwich Mean Time (GMT). Although you probably won't use the UTC functions often, they're useful if your system operates in different time zones. That way, the date/time values always reflect Greenwich Mean Time, regardless of the time zone in which they're entered. For example,

often, they'

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
*Source: murachs-mysql-3rd-edition, Pages 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300*
