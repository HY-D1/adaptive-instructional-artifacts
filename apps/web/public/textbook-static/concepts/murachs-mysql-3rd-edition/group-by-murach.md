---
id: group-by-murach
title: GROUP BY Clause
definition: Grouping data for aggregate calculations
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267]
chunkIds:
  - murachs-mysql-3rd-edition:p253:c1
  - murachs-mysql-3rd-edition:p254:c1
  - murachs-mysql-3rd-edition:p254:c2
  - murachs-mysql-3rd-edition:p254:c3
  - murachs-mysql-3rd-edition:p254:c4
  - murachs-mysql-3rd-edition:p255:c1
  - murachs-mysql-3rd-edition:p255:c2
  - murachs-mysql-3rd-edition:p255:c3
  - murachs-mysql-3rd-edition:p256:c1
  - murachs-mysql-3rd-edition:p256:c2
  - murachs-mysql-3rd-edition:p256:c3
  - murachs-mysql-3rd-edition:p256:c4
  - murachs-mysql-3rd-edition:p257:c1
  - murachs-mysql-3rd-edition:p257:c2
  - murachs-mysql-3rd-edition:p258:c1
  - murachs-mysql-3rd-edition:p258:c2
  - murachs-mysql-3rd-edition:p258:c3
  - murachs-mysql-3rd-edition:p258:c4
  - murachs-mysql-3rd-edition:p259:c1
  - murachs-mysql-3rd-edition:p259:c2
  - murachs-mysql-3rd-edition:p260:c1
  - murachs-mysql-3rd-edition:p260:c2
  - murachs-mysql-3rd-edition:p260:c3
  - murachs-mysql-3rd-edition:p261:c1
  - murachs-mysql-3rd-edition:p261:c2
  - murachs-mysql-3rd-edition:p262:c1
  - murachs-mysql-3rd-edition:p262:c2
  - murachs-mysql-3rd-edition:p262:c3
  - murachs-mysql-3rd-edition:p263:c1
  - murachs-mysql-3rd-edition:p263:c2
  - murachs-mysql-3rd-edition:p264:c1
  - murachs-mysql-3rd-edition:p264:c2
  - murachs-mysql-3rd-edition:p264:c3
  - murachs-mysql-3rd-edition:p264:c4
  - murachs-mysql-3rd-edition:p265:c1
  - murachs-mysql-3rd-edition:p265:c2
  - murachs-mysql-3rd-edition:p265:c3
  - murachs-mysql-3rd-edition:p266:c1
  - murachs-mysql-3rd-edition:p266:c2
  - murachs-mysql-3rd-edition:p267:c1
relatedConcepts:
tags:
  - mysql
  - group-by
  - aggregation
sourceDocId: murachs-mysql-3rd-edition
---

# GROUP BY Clause

## Definition
Grouping data for aggregate calculations

## Explanation
Clzapter 8 How to work with data types Data types Category Description Character Numeric Date and time Large Object (LOB) Spatial JSON Description Strings of character data Numbers that don't include a decimal point (integers) and numbers that include a decimal point (real numbers) Dates, times, or both Large strings of character or binary data Geographical values JSON documents • MySQL provides data types for storing many types of data. • Numbers that don't include a decimal point are known as integers. • Numbers that include a decimal point are known as real numbers. • The date and time data. types are often referred to as the date/time or temporal data type.';. • The large object (LOB) data types are useful for storing images, sound, video, and large amounts of text. • The spatial data types are useful for storing geometric or geographical values such as global positioning system (GPS) data. These data types are referred to as geometry types. • The ISON data type is used for storing JavaScript Object Notation (ISON) documents. Data type overview

The character types MySQL: CHAR and VARCHAR. These data types store strings of characters. You use the CHAR type to store fixed-length st1 ings. Data stored using this data type always occupies the same number of bytes regardless of the actual le ngth of the string. This data type is typically used to define columns that have a fixed number of characters. For example, the vendor_state column in the Vendors table is defined as CHAR(2) because it always contai11s two characters. However, if two chru acters are stored in a CHAR(lO) column, MySQL appends eight spaces to the string so it contains 10 char acters. You use the VARCHAR data type to store variable-length strings. Data stored using this data type occupies only the number of bytes needed to store the string plus an extra byte to store the length of the string. This data type is typically used to define colt1mns whose lengths vary from one row to the next. For exampl

## Examples
### Example 1: UPDATE Example
```sql
update the value manually as needed. • MySQL 5.7.5 and later support only 4-digit years, which can be defmed as YEAR and YEAR( 4). I-digit and 2-digit years can still be entered but are converted to 4-digit years. Values from Oto 69 are converted to 2000 to 2069, and values from 70 to 99 are converted to 1970 to 1999. • For a value of O or 00 to be stored as 2000 in a YEAR column, you 1nust enter it as a string. Otherwise, it's stored as 0000. The date and time types (part 1 of 2)

When you work with the date and time types, you need to know how to code date and time literals. Part 2 of fo1mat for MySQL is ''yyyy-mm-dd'', which is why we've used this forn1at in most of the examples in this book. By default, MySQL doesn't support other common date formats such as ''m.m/dd/yy''. If you attempt to use an unsupported format, MySQL returns an error. You also need to be aware of the two-digit year cutoff that's defined on your system. When you code a two-digit year, the two-digit year cutoff determines bow MySQL interprets the year. By default, MySQL interprets the years 00 through 69 as 2000 through 2069, and it interprets the years 70 through 99 as 1970 through 1999. Usually, that's what you want. However, the two-digit year cutoff can be modified if necessary. In general, it's considered a good coding practice to use four-digit years. That way, you can be sure that MySQL is interpreting the year correctly. MySQL interprets any punctuation character in a literal as a delimiter between date parts or time

practice to use four-digit years. That way, you can be sure that MySQL is interpreting the year correctly. MySQL interprets any punctuation character in a literal as a delimiter between date parts or time parts. If you don't use any delimiters, you can code the value as a numeric literal. In that case, you don't need to use single quotes. When storing a date in a DATE column, the values are loosely checked for valid data. For instance, months must be in the range 0-12 and days must be in the range 0-31. For illegal dates, such as February 31, MySQL returns an error. However, MySQL allows you to store unconventional date values, such as ''2018-12-00'', which represents a month and year without a specific day. The default time format for MySQL is ''hh:mm:ss'', using a 24-hour clock. Many of the same rules for coding date literals also apply to time literals. For instance, you can use any punctuation character as a delimiter. Similarly, for valid values, you can omit the delimiters. In that case, you can use a numeric

literals also apply to time literals. For instance, you can use any punctuation character as a delimiter. Similarly, for valid values, you can omit the delimiters. In that case, you can use a numeric literal (no quotes) instead of a string literal (quotes). Finally, MySQL checks times for validity. For illegal times, such as ''19:61:11'', MySQL returns an error. The default date/time format for MySQL is a combination of the date and time formats. Most of the rules for coding date/time literals rule a combination of the rules for coding date and time literals. In addition, if you don't specify a time when storing a TIMESTAMP or DATETIME value, the tim.e defaults to 00:00:00, which is midnight.

Clzapter 8 How to work with data types How MySQL interprets literal date/time values Literal value Value stored in DATE column '2018-08-15' 2018-08-15 '2018-8-15' 2018-08-15 '18-8-15' 2018-08-15 '20180815' 2018-08-15 20180815 2018-08-15 '2018. 08.15' 2018-08-15 '18/8/15' 2018-08-15 1 8/15/18 1 None '2018-02-31' None Literal value Value stored in TIME column '7:32' '19:32:11' '193211' 193211 1 19:61:11 1 07:32:00 19:32:11 19:32:11 19:32:11 None Literal value Value stored in DATETIME or TIMESTAMP column '2018-08-15 19:32:11' '2018-08-15' Description 2018-08-15 19:32:11 2018-08-15 00:00:00 • You can specify date and time values by coding a literal value. In most cases, you enclose the literal value in single quotes. • For dates, MySQL uses the ''yyyy-mm-dd'' format. For times, MySQL uses the ''hh:mm:ss'' format, using a 24-hot1r clock. • By default, MySQL does not support common date formats used by other systems such as ''mm/dd/yy'' and ''mon/dd/yyyy''. • By default, MySQL interprets 2-digit years from 00 to 69 as 2000 to 2069 and the years from 70 to 99 as 1970 to 1999. • MySQL interprets any punctuation character as a delimiter between date parts. If you

years from 00 to 69 as 2000 to 2069 and the years from 70 to 99 as 1970 to 1999. • MySQL interprets any punctuation character as a delimiter between date parts. If you don't use any delimiters, you can code the value as a numeric literal without quotes. • If you don't specify a time when storiI1g a DATETIME or TIMESTAMP value, MySQL stores a time value of 00:00:00 (12:00 midnight). • If you don't specify seconds when storing a TIME value, MySQL stores 00 for the seconds. • When storing date and time values, MySQL loosely checks the values to make sure they are valid. For example, months must be in the range 0-12, days must be in the range 0-31, and so on. If MySQL determines that a date or time isn't valid, it returns an error. • MySQL 5.5 and later are stricter than previous versions of MySQL for storing date and time values. If MySQL can't interpret a value, it returns an error or a warning. The date and time types (part 2 of 2)

The ENUM and SET types The ENUM and SET types can be considered character data types since they allow you to restrict the values for a column to a limited set of strings as shown in reduces the nun1ber of bytes needed to store each string. The main difference between the ENUM and SET types is that an ENUM column can store exactly one value, but a SET column can store zero, one, or up to 64 different values. In other words, an ENUM column can consist of only one member in a set of values, while the SET column may consist of any, or all, members in a set. You can use the ENUM type to store values that are mutually exclusive, such as Yes, No, or Maybe. In other words, you can use the ENUM type to represent a choice of one value, but not two. For example, delivery or pickup;
```
Example UPDATE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267*
