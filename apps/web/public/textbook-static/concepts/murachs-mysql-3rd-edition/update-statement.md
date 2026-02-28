# The UPDATE Statement

## Definition
Modifying existing rows in a table with UPDATE and SET clauses

## Explanation

have matching rows in the Departments table, and it shows that one row in the Departments table doesn't have a matching row in the Employees table. In other words, two employees haven't been assigned to a department, and one depa1tment doesn't have any employees.

Chapter 4 How to retrieve data from two or m.ore tables 145 A union that simulates a full outer join SELECT department_name AS dept_name, d.department_ n11mber AS d_ dept_no, e.department_number AS e _dept_no, last_ name FROM departments d LEFT JOIN employees e ON d. department_number = e. department_ n11mber UNION SELECT department_ name AS dept_name, d.department_number AS d_ dept_ no, e.department_number AS e _dept_no, last_ name FROM departments d RIGHT JOIN employees e ON d. department_number = e. department_ n11mber ORDER BY dept_name ► dept_name Accounting Maintenance Operations Payroll Payroll Payroll I Personnel Personnel (10 rows ) Description d_dept_no 01611 ffi991 1 5 3 2 2 2 4 4 e_dept_no last_name

## Examples
### Example 1: SELECT Example
```sql
SELECT department_name AS dept_name, d.department_ n11mber AS d_ dept_no, e.department_number AS e _dept_no, last_ name FROM departments d LEFT JOIN employees e ON d. department_number = e. department_ n11mber UNION SELECT department_ name AS dept_name, d.department_number AS d_ dept_ no, e.department_number AS e _dept_no, last_ name FROM departments d RIGHT JOIN employees e ON d. department_number = e. department_ n11mber ORDER BY dept_name ► dept_name Accounting Maintenance Operations Payroll Payroll Payroll I Personnel Personnel (10 rows ) Description d_dept_no 01611 ffi991 1 5 3 2 2 2 4 4 e_dept_no last_name 6 Watson 6 locario 1 Hernandez 5 Hardy 001!1 lit!lil 2 Smith 2 Simonian 2 Aaronsen 4 Jones 4 Oleary • When you use afull outer join, the result set includes all the 1ows from both tables. • MySQL doesn't provide language keywords for full outer joins, but you can simulate a full outer join by using the UNION keyword to combine the result sets from a left outer

doesn't provide language keywords for full outer joins, but you can simulate a full outer join by using the UNION keyword to combine the result sets from a left outer join and a right outer join. Figure 4-15 How to simulate a full outer join

should return 114 rows. Hint: You can use an asterisk(*) to select the columns from both tables. 2. Write a SELECT statement that returns these four columns: vendor name - invoice number i11voice date balance due The vendor_name column from the Vendors table The invoice number column from the Invoices table The invoice date coltrmn from the Invoices table The invoice_total column minus the payment_total and credit_total columns from the Invoices table Use these aliases for the tables: v for Vendors and i for Invoices. Return one row for each invoice with a non-zero balance. This should return 11 rows. Sort the result set by vendor_name in ascending order. 3. Write a SELECT statement that returns these three columns: vendor name - default account - description The vendor name column from the Vendors table - The default account number column from the - - Vendors table The account_description column from the General_Ledger_Accounts table Return one row for eac.h vendor. This should return 122 rows. Sort the result set by account_description and then by vendor_name.

Chapter 4 How to retrieve data from two or m.ore tables 147 4. Write a SELECT statement that returns these five columns: vendor name invoice date - invoice number li_sequence Ii amount The vendor name column from the Vendors table - The invoice date column from the Invoices table - The invoice number column from the Invoices table The invoice_sequence column from the Invoice_Line_Items table The line item amount column from the - - Invoice_Line_Items table Use aliases for the tables. This should return 118 rows. Sort the final result set by vendor_name, invoice_date, invoice_number, and • • 1n voice _sequence. 5. Write a SELECT statement that returns three columns: vendor id vendor name contact_name The vendor id column from the Vendors table The vendor name column from the Vendors table A concatenation of the vendor_contact_first_name and vendor_contact_last_name columns with a space between Return one row for each vendor whose contact has the same last name as another vendor's contact. This should return 2 rows. Hint: Use a self-join to check that the vendor_id columns aren't equal but the vendor

contact has the same last name as another vendor's contact. This should return 2 rows. Hint: Use a self-join to check that the vendor_id columns aren't equal but the vendor _contact_last_name colu,nns are equal. Sort the result set by vendor_contact_last_name. 6. Write a SELECT statement that returns these three columns: account number - account_ description invoice id The account number column from the General_Ledger_Accounts table The account_description column from the General_Ledger_Accounts table The invoice id column from the - Invoice Line Items table - - Return one row for each account number that has never been used. This should return 54 rows. Hint: Use an outer join and only return rows where the invoice_id column contains a null value. Remove the invoice_id column from the SELECT clause. Sort the final result set by the account_number column. 7. Use the UNION operator to generate a result set consisting of two columns from the Vendors table: vendor_name and vendor_state. If the vendor is in California, the vendor_state value should be ''CA'';
```
Example SELECT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 164, 165, 166, 167, 168, 169, 170*