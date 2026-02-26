# MySQL Functions

## Definition
String, numeric, date/time, and conversion functions

## Explanation
270 Section 2 More SQL skills cts you need them How to work with date/time data In the topics that follow, you'll learn how to use some of the functions that MySQL provides for working with dates and times. As you'll see, these include functions for extracting different parts of a date/time value and for performing operations on dates and times. In addition, you '11 learn how to perfor1n different types of searches on date/time values. How to get the current date and time Figure 9-7 presents some of th.e date/time functions and shows how they work. The NOW, CURDATE, and CURTIME functions return the local dates and/or times based on your system's clock. However, if a session time zone has been set, the value returned by the CURDATE and CURTIME functions is adjusted to accommodate that time zone. The UTC_DATE and UTC_TIME functions work siinilarly, but they return the Universal Time Coordinate (UTC) date, also known as Greenwich Mean Time (GMT). Although you probably won't use the UTC functions often, they're useful if your system operates in different time

Universal Time Coordinate (UTC) date, also known as Greenwich Mean Time (GMT). Although you probably won't use the UTC functions often, they're useful if your system operates in different time zones. That way, the date/time values always reflect Greenwich Mean Time, regardless of the time zone in which they're entered. For example, a date/time value entered at 11 :00 a.m. Los Angeles time is given the same value as a date/time value entered at 2:00 p.m. New York time. That makes it easy to compare and operate on these values. When you use functions to get the current date and time, you should be aware that the CURRENT_TIMESTAMP, CURRENT_DATE, and CURRENT_TIME functions are synonymous with the NOW, CURDATE, and CURTIME functions. In practice, the NOW, CURDATE, and CURTIME functions are typically used by MySQL programmers because they've been around the longest and because they're shorter, which makes them easier to

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
*Source: murachs-mysql-3rd-edition, Pages 290, 291, 292, 293, 294, 295, 296, 297, 298*
