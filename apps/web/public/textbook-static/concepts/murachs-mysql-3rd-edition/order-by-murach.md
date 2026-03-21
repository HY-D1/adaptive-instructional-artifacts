---
id: order-by-murach
title: ORDER BY Clause
definition: Sorting query results by one or more columns, ascending and descending
difficulty: beginner
estimatedReadTime: 5
pageReferences: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115]
chunkIds:
  - murachs-mysql-3rd-edition:p101:c1
  - murachs-mysql-3rd-edition:p101:c2
  - murachs-mysql-3rd-edition:p102:c1
  - murachs-mysql-3rd-edition:p102:c2
  - murachs-mysql-3rd-edition:p102:c3
  - murachs-mysql-3rd-edition:p102:c4
  - murachs-mysql-3rd-edition:p103:c1
  - murachs-mysql-3rd-edition:p103:c2
  - murachs-mysql-3rd-edition:p104:c1
  - murachs-mysql-3rd-edition:p104:c2
  - murachs-mysql-3rd-edition:p105:c1
  - murachs-mysql-3rd-edition:p105:c2
  - murachs-mysql-3rd-edition:p106:c1
  - murachs-mysql-3rd-edition:p106:c2
  - murachs-mysql-3rd-edition:p107:c1
  - murachs-mysql-3rd-edition:p107:c2
  - murachs-mysql-3rd-edition:p108:c1
  - murachs-mysql-3rd-edition:p109:c1
  - murachs-mysql-3rd-edition:p110:c1
  - murachs-mysql-3rd-edition:p111:c1
  - murachs-mysql-3rd-edition:p112:c1
  - murachs-mysql-3rd-edition:p112:c2
  - murachs-mysql-3rd-edition:p112:c3
  - murachs-mysql-3rd-edition:p112:c4
  - murachs-mysql-3rd-edition:p113:c1
  - murachs-mysql-3rd-edition:p113:c2
  - murachs-mysql-3rd-edition:p114:c1
  - murachs-mysql-3rd-edition:p114:c2
  - murachs-mysql-3rd-edition:p114:c3
  - murachs-mysql-3rd-edition:p115:c1
  - murachs-mysql-3rd-edition:p115:c2
  - murachs-mysql-3rd-edition:p115:c3
relatedConcepts:
tags:
  - mysql
  - order-by
  - sorting
sourceDocId: murachs-mysql-3rd-edition
---

# ORDER BY Clause

## Definition
Sorting query results by one or more columns, ascending and descending

## Explanation
Chapter 3 How to retrieve datafrom a single table A SELECT statement that renames the columns in the result set SELECT invoice_number AS "Invoice Number", invoice_date AS Date, invoice total AS Total FROM invoices Invoice Number Date Total ► 989319-457 2018-04-08 3813.33 263253241 2018-04-10 -10.20 963253234 2018-04-13 138. 75 2-000-2993 2018-04-16 144. 70 963253251 2018-04-16 15.50 963253261 2018-04-16 42.75 (114 rows) A SELECT statement that doesn't name a calculated column SELECT invoice_number, invoice_date, invoice_total, invoice_total - payment_total - credit_total FROM invoices ~ invoice_number invoice date invoice total invoice_tot.al - payment_total - credit_tot.al - - 2018-04-08 3813, 33 0.00 ► 989319-457 1263253241 2018-04-10 "10. 20 0.00 1963253234 2018-04-13 138.75 0.00 2-000-2993 2018-04-16 144.70 0.00 963253251 2018-04-16 15.50 0.00 1963253261 2018-04-16 42. 75 0.00 (114 rows) Description • By default, a column in the result set is given the same name as the column in the base table. If that's not what you want, you can specify a substitute name, or column alias, for the column. • to specify an alias for a column, use the AS phrase. Although the AS keyword

that's not what you want, you can specify a substitute name, or column alias, for the column. • to specify an alias for a column, use the AS phrase. Although the AS keyword is optional, I recommend you code it for readability. • If you don't specify an alias for a column that's based on a calculated value, MySQL uses the expression for the calculated value as the column name. • to include spaces or special characters in an alias, enclose the alias in double quotes ( ") or single quotes ( '). How to name the columns in a result set using aliases V -

How to code arithmetic expressions the arithmetic operators you can use in this type of expression. Then, it presents three examples that show bow you use these operators. The SELECT statement in the fu st example includes an arithmetic expression that 

## Examples
### Example 1: SELECT Example
```sql
SELECT statement that renames the columns in the result set SELECT invoice_number AS "Invoice Number", invoice_date AS Date, invoice total AS Total FROM invoices Invoice Number Date Total ► 989319-457 2018-04-08 3813.33 263253241 2018-04-10 -10.20 963253234 2018-04-13 138. 75 2-000-2993 2018-04-16 144. 70 963253251 2018-04-16 15.50 963253261 2018-04-16 42.75 (114 rows) A SELECT statement that doesn't name a calculated column SELECT invoice_number, invoice_date, invoice_total, invoice_total - payment_total - credit_total FROM invoices ~ invoice_number invoice date invoice total invoice_tot.al - payment_total - credit_tot.al - - 2018-04-08 3813, 33 0.00 ► 989319-457 1263253241 2018-04-10 "10. 20 0.00 1963253234 2018-04-13 138.75 0.00 2-000-2993 2018-04-16 144.70 0.00 963253251 2018-04-16 15.50 0.00 1963253261 2018-04-16 42. 75 0.00 (114 rows) Description • By default, a column in the result set is given the same name as the column in the base table. If that's not what you want, you can specify a substitute name, or column alias, for the column. • to specify an alias for a column, use the AS phrase. Although the AS keyword

that's not what you want, you can specify a substitute name, or column alias, for the column. • to specify an alias for a column, use the AS phrase. Although the AS keyword is optional, I recommend you code it for readability. • If you don't specify an alias for a column that's based on a calculated value, MySQL uses the expression for the calculated value as the column name. • to include spaces or special characters in an alias, enclose the alias in double quotes ( ") or single quotes ( '). How to name the columns in a result set using aliases V -

How to code arithmetic expressions the arithmetic operators you can use in this type of expression. Then, it presents three examples that show bow you use these operators. The SELECT statement in the fu st example includes an arithmetic expression that calculates the balance due for an invoice. This expression subtracts the payment_total and credit_total columns from the invoice_total column. The resulting column is given an alias of balance_due. When MySQL evaluates an arithmetic expression, it performs the operations from left to right based on the order of precedence. to start, MySQL performs multiplication, division, and modulo operations. Then, it performs addition and subtraction operations. If that's not what you want, you can use parentheses to specify how an expression is evaluated. Then, MySQL evaluates the expressions in the innermost sets of parentheses first, followed by the expressions in outer sets of parentheses. Within each set of parentheses, MySQL evaluates the expression from left to right in the order of precedence. If you want, you can also use parentheses to clarify an expression even if they're not needed for the

of parentheses, MySQL evaluates the expression from left to right in the order of precedence. If you want, you can also use parentheses to clarify an expression even if they're not needed for the expression to be evaluated properly. However, you should avoid cluttering your SQL statements with unnecessary parentheses. to show how pai entheses and the order of precedence affect the evaluation of an expression, consider the second example in this figure. Here, the expressions in the second and third columns both perform the same operations. These expressions use one column name (invoice_id) that returns a number and two literal values for numbers (7 and 3). When you code a literal value for a number, you don't need to enclose it in quotes. When MySQL evaluates the exp1 ession in the second column, it perfo1ms the multiplication operation before the addition operation because multiplication comes before addition in the order of precedence. When MySQL evaluates the expression in the third column, though, it perfor1ns the addition operation first because it's enclosed in parentheses. Because of this, these two expressions

in the order of precedence. When MySQL evaluates the expression in the third column, though, it perfor1ns the addition operation first because it's enclosed in parentheses. Because of this, these two expressions return different values as shown in the result set. Although you're probably familiar with the addition, subtraction, multiplication, and division operators, you may not be familiar with the MOD (%) or DIV operators. MOD returns the remainder of a division of two integers, and DIV returns the integer quotient of two numbers. These are shown in the third example in this figure. Here, the second column contains the quotient of the two numbers, which MySQL automatically converts from an integer value to a decimal value. Then, the third column uses the DIV operator to return the integer quotient of the same division operation. The fourth column uses the modt1lo operator to return the remainder of the division operation. Before going on, you should notice that the second and third SELECT statements include an ORDER BY clause that sorts the result set in ascending sequence by the invoice_id column.

division operation. Before going on, you should notice that the second and third SELECT statements include an ORDER BY clause that sorts the result set in ascending sequence by the invoice_id column. Although you might think that this would be the default, that's not the case with MySQL. Instead, the rows in a result set are returned in the most efficient way. If you want the rows returned in a specific sequence, then, you need to include the ORDER BY clause.

Chapter 3 How to retrieve datafrom a single table The arithmetic operators in order of precedence Operator Name Order of precedence * Multiplication I Divisio11 DIV Integer division ~ (MOD) Modulo (remainder) + Addition - Subtraction A SELECT statement that calculates the balance due SELECT invoice_total, payment_total, credit_total, invoice_total - payment_ total - credit_ total AS balance_due FROM invoices invoice_ total payment_total aedit_total balance_due ► 3813.33 38L3.33 0.00 0.00 40.20 40.20 0.00 0.00 1 m. 75 138.75 0.00 0.00 Use parentheses to control the sequence of operations SELECT invoice_ id, invoice_id + 7 * 3 AS multiply_first, (invoice_id + 7) * 3 AS add first FROM invoices ORDER BY invoice_id invoice_id multiply _first add_first ► Use the DIV and modulo operators SELECT invoice_ id, invoice_id / 3 AS decimal_quotient, invoice_id DIV 3 AS integer_quotient, invoice_id % 3 AS remainder FROM invoices ORDER BY invoice_id _J invorce_id decimal_quotient integer _quotient remainder ► 0.3333 0.6667 I 1.0000 l Description '--. '-- • Unless parentheses are used, the operations in an expression take place from left to right in the order of precedence.

integer _quotient remainder ► 0.3333 0.6667 I 1.0000 l Description '--. '-- • Unless parentheses are used, the operations in an expression take place from left to right in the order of precedence. For arithmetic expressions, MySQL performs multiplication, division, and modulo operations first. Then, it performs addition and subtraction operations. • When necessary, you can use parentheses to override or clarify the sequence of operations. How to code arithmetic expressions

How to use the CONCAT function to join strings join, or concatenate, strings. In MySQL, a string can contain any combination of characters, and a function performs an operation and returns a value. to code a function, you begin by entering its name followed by a set of parentheses. If the function requires an argument, or parameter, you enter it within the parentheses. If the function takes more than one argument, you separate them with commas. In this figure, the first example shows how to use the CONCAT function to join the vendor_city and vendor_state columns in the Vendors table. Since this example doesn't assign an alias to this column, MySQL automatically assigns the expression formula as the column name. In addition, there isn't a space between the vendor_state and the vendor_city in the result set. Since this makes the data difficult to read, this string should be formatted as shown in the second or third example. The second example shows how to format a string expression by adding spaces and punctuation. Here, the vendor_city column is concatenated with a

be formatted as shown in the second or third example. The second example shows how to format a string expression by adding spaces and punctuation. Here, the vendor_city column is concatenated with a literal value for a string that contains a comma and a space. Then, the vendor_state column is concatenated with that result, followed by a literal value for a string that contains a single space and the vendor_zip_code column. to code a string literal, you can enclose the value in either single quotes ( ') or double quotes ( "). Occasionally, you may need to include a single quote as an apostrophe within a literal value for a string. If you're using single quotes around the literal, however, MySQL will misinterpret the aposn ophe as the end of the string. to solve this, you can code two single quotation marks in a row as shown by the third example. Or, you can use double quotes like this: CONCAT(vendor_name, "'s Address: ") AS vendor

Chapter 3 How to retrieve data from a single table The syntax of the CONCAT function CONCAT(stringl[, string2]... } How to concatenate string data SELECT vendor_ city, vendor_ state, CONCAT(vendor_city, vendor_ state} FROM vendors ~ vendor _city vendor _state CONCAT(vendor _city, vendor _state) - WI MadisonWI ► Madison Washington DC \~ashingtonDC (122 rows) How to format string data using literal values SELECT vendor_name, CONCAT(vendor_city, AS address FROM vendors vendor _name address ----, ', ', vendor_ state, ► US Postal Service National Information Data Ctr Madison, WI 53707 Washington, DC 20120 (122 rows} How to include apostrophes in literal values 1, vendor_ zip_code) SELECT CONCAT(vendor_name, '' 's Address: ') AS Vendor, CONCAT(vendor_city, ', ', vendor_state, ' ', vendor_ zip_code} AS Address FROM vendors Vendor Address ► US Postal Service's Address: Madison, WI 53707 National Information Data Ctr's Address: \n/ashington, DC 20120 (122 rows) Description • An expression can include any of the functions that are supported by MySQL. A function performs an operation and returns a value. l.- I\ \I • to code a function, code the function name followed by

include any of the functions that are supported by MySQL. A function performs an operation and returns a value. l.- I\ \I • to code a function, code the function name followed by a set of parentheses. Within the parentheses, code any parameters, or arguments, required by the function. If a function requires two or more arguments, separate them with commas. • to code a literal value for a string, enclose one or more characters within single quotes ( ') or double quotes ( "). • to include a single quote within a literal value for a string, code two single quotes. Or, use double quotes instead of single quotes to start and end the literal value. • to join, or concatenate, two or more string columns or literal values, use the CONCAT function. How to use the CONCAT function to join strings

How to use functions with strings, dates, and numbers functio11 operates on strings, the DATE_FORMAT function operates on dates, and the ROUND function operates on numbers. For now, don't worry about the details of how the functions shown here work, because you'll learn more about all of these functions in chapter 9. Instead, just focus on how they're used in column specifications. The first example in this figure shows how to use the LEFT function to extract the first character of the vendor_contact_first_name and vendor_contact_last_name columns. The first parameter of this function specifies the string value, and the second parameter specifies the number of characters to return. Then, this statement concatenates the results of the two LEFT functions to form initials as shown in the result set. The second example shows how to use the DATE_FORMAT function to change the format used to display date values. This function requires two parameters. The first parameter is the date value to be formatted and the second is a format string that uses specific values as placeholders for the various parts of the

This function requires two parameters. The first parameter is the date value to be formatted and the second is a format string that uses specific values as placeholders for the various parts of the date. The first column in this example renrrns the invoice_date column in the default MySQL date format, ''yyyy-mm-dd''. Since this format isn't used as often in the USA, the second column is formatted in the more typical ''mm/dd/yy'' format. In the third column, the invoice date is in another format that's commonly used. In chapter 9, you'll leait1 1nore about specifying the format string for the DATE_FORMAT function. The third example uses the ROUND function to round the value of the invoice total column to the nearest dollai and nearest dime. This function can - accept eitl1er one or two parameters. The first parameter specifies the number to be rounded and the optional second parameter specifies the number of decimal places to keep. If the second parameter is omitted, the function rounds to the nearest integer.

Chapter 3 How to retrieve datafrom a single table The syntax of the LEFT, DATE_FORMAT, and ROUND functions LEFT(string, number_of_characters) DATE_ FORMAT (date, format_string) ROUND(number[, number_of_decimal_places]) A SELECT statement that uses the LEFT function SELECT vendor_ contact_ first_name, vendor_contact_ last_ name, CONCAT(LEFT(vendor_ contact_first_ namA, 1), LEFT (vendor_ contact_ last_ namA, 1)) AS initials FROM vendors vendor _contact_first_name vendor contact last name initials - - - ► Francesco Alberto FA I Ania Irvin AI Lukas Liana LL (122 rows) A SELECT statement that uses the DATE FORMAT function SELECT invoice_date, DATE_ FORMAT(invoice_date, •~oro/%d /%y') AS 'MM/ DD/YY', DATE_ FORMAT{invoice_date, ' %e-%b-%Y') AS 'DD-Mon-YYYY' FROM invoices ORDER BY invoice_date invoice_date ~ 2018-04-08 2018-04-10 I 20 18-04-13 (114 rows) MM/00/'(Y 04/08/18 04/10/18 04/ 13/18 DD-Mon-YYYY 8-Apr-2018 10--Apr-2018 13-Apr-2018 A SELECT statement that uses the ROUND function SELECT invoice_date, invoice_total, ROUND(invoice_ total) AS nearest_dollar, ROUND (invoice_ total, 1) AS nearest_dime FROM invoices ORDER BY invoice date I invoice_date invoice _total nearest_dollar nearest_dime ► 2018--04-08 3813.33 3813 3813.3 2018-04-10 40.20 40.2 2018-04-13 138.75 138.8 ( 114 rows) Description • When using the DATE_FORMAT function to

ORDER BY invoice date I invoice_date invoice _total nearest_dollar nearest_dime ► 2018--04-08 3813.33 3813 3813.3 2018-04-10 40.20 40.2 2018-04-13 138.75 138.8 ( 114 rows) Description • When using the DATE_FORMAT function to specify the format of a date, you use the percent sign (%) to identify a format code. For example, a format code of m returns the month number with a leading zero if necessary. For more information about these codes, see chapter 9. • For more information about using functions, see chapter 9. How to use functions with strings, dates, and numbers I\ '-- V

How to test expressions by coding statements without FROM clauses When you use MySQL, you don't have to code FROM clat1ses in SELECT statements. This makes it easy for you to code SELECT statements that test expressions and functions like those that you've seen in this chapter. Instead of coding column specifications in the SELECT clause, you use literals or functions to supply the test values you need. And you code column aliases to display the results. Then, once you're sure that the code works as you intend it to, you can add the FROM clause and replace the literals or functions with the correct column specifications. an arithmetic expression using numeric literals that make it easy to verify the results. The remaining examples test the functions that you saw in you compare these statements, you'll see that the second and fourth examples simply replace the column specifications in third example uses another function, CURRENT_DATE, to supply a date value in place of the invoice_date column that's coded in

Chapter 3 How to retrieve datafrom a single table Four SELECT statements without FROM clauses Example 1: Testing a calculation SELECT 1000 * (1 +.1) AS 1110% More Than 1000" 10°/4 More Than 1000 ---I -- ► 1100.0 "'-~------;
```
Example SELECT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115*
