---
id: unions
title: UNION and UNION ALL
definition: Combining results from multiple SELECT statements
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311]
chunkIds:
  - murachs-mysql-3rd-edition:p301:c1
  - murachs-mysql-3rd-edition:p301:c2
  - murachs-mysql-3rd-edition:p302:c1
  - murachs-mysql-3rd-edition:p302:c2
  - murachs-mysql-3rd-edition:p302:c3
  - murachs-mysql-3rd-edition:p303:c1
  - murachs-mysql-3rd-edition:p303:c2
  - murachs-mysql-3rd-edition:p304:c1
  - murachs-mysql-3rd-edition:p304:c2
  - murachs-mysql-3rd-edition:p304:c3
  - murachs-mysql-3rd-edition:p304:c4
  - murachs-mysql-3rd-edition:p305:c1
  - murachs-mysql-3rd-edition:p305:c2
  - murachs-mysql-3rd-edition:p306:c1
  - murachs-mysql-3rd-edition:p306:c2
  - murachs-mysql-3rd-edition:p307:c1
  - murachs-mysql-3rd-edition:p307:c2
  - murachs-mysql-3rd-edition:p308:c1
  - murachs-mysql-3rd-edition:p308:c2
  - murachs-mysql-3rd-edition:p308:c3
  - murachs-mysql-3rd-edition:p309:c1
  - murachs-mysql-3rd-edition:p309:c2
  - murachs-mysql-3rd-edition:p310:c1
  - murachs-mysql-3rd-edition:p310:c2
  - murachs-mysql-3rd-edition:p311:c1
  - murachs-mysql-3rd-edition:p311:c2
relatedConcepts:
tags:
  - mysql
  - union
  - set-operations
sourceDocId: murachs-mysql-3rd-edition
---

# UNION and UNION ALL

## Definition
Combining results from multiple SELECT statements

## Explanation
Chapter 9 How to use functions The contents of the Date_Sample table date_id start date ► 1986-03-0100:00:00 2006-02-28 00:00:00 2010-10-3100:00:00 2018-02-28 10:00:00 2019-02-28 13:58:32 2019-03-0109:02:25 -... A SELECT statement that fails to return a row SELECT* FROM date_ sample WHERE start_date = '2018-02-28' L date_id start_date Three techniques for ignoring time values Search for a range of dates SELECT* FROM date_ sample WHERE start date >= '2018-02 -28' AND start date < '2018-03- 01' date_id start_date ► 2018-02-28 10:00:00 Search for month, day, and year integers SELECT* FROM date_ sample WHERE MONTH(start_date } = 2 AND DAYOFMONTH(start_ date) = 2 8 AND YEAR {start_date} = 2018 date id - start_date ► 2018-02-28 10:00:00 Search for a formatted date SELECT* FROM date_ sample WHERE DATE_ FORMAT (start_date, •~a111-%d -%Y') = '02 - 28- 2018' f date,d start date ► - 2018~2-28 10:00:00 Description • You can search for a date in a DATETIME column by searching for a range of dates, by using functions to specify the month, day, and year of the date, or by searching for a formatted date.

a date in a DATETIME column by searching for a range of dates, by using functions to specify the month, day, and year of the date, or by searching for a formatted date. of these techniques, searching for a range of dates is the most efficient. How to search for a date I.I

How to search for a time When you search for a time value in a DATETIME column without specifying a date component, MySQL automatically uses the default date of January 1, 1900. That's why the first SELECT statement in row even though one row matches the specified time. The second SELECT statement shows one way to solve this problem. Here, the WHERE clause uses the DATE_FORMAT function to return a string for the start_date column in the hh:mm:ss format. Then, the WHERE clause compares this string to a literal string of 10:00:00. The third SELECT statement in this figure shows another way to solve this problem. T

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
*Source: murachs-mysql-3rd-edition, Pages 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311*
