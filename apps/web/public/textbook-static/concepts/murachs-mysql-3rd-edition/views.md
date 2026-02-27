# Views

## Definition
Creating and using virtual tables based on SELECT queries

## Explanation

to use a default value like an empty string to indicate that a value is known but the column is empty. For example, an empty string might indicate that a vendor hasn't provided its street address. Although how you use nulls and empty strings is largely a matter of personal preference, it does affect the way you query a table. When a primary key consisted of a single column, I coded the PRIMARY KEY constraint at the column level. Similarly, I coded the UNIQUE constraint at the column level. As a result, I didn't provide names for these constraints. However, whenever I coded a primary key or foreign key constraint at the table level, I followed a convention that begins with the name of the table or an abbreviated name for the table. As you know, when MySQL creates a table, it automatically creates indexes for the primary key, foreign keys, and unique keys. MySQL uses the name ''PRIMARY'' for the name of the index for a table's p1imary key. It uses the name of the c

## Examples
### Example 1: SELECT Example
```sql
select the Alter Table item, and click on the Columns tab. • To rename a column, double-click on the column name and enter the new name. • To change the data type for a column, click on the data type in the Datatype colt1mn. Then, select a data type from the drop-down list that's displayed. • To change the default value

type for a column, click on the data type in the Datatype colt1mn. Then, select a data type from the drop-down list that's displayed. • To change the default value for a column, enter a new default valt1e in the Default column. • To change other attributes of the column, check or uncheck the attribute check boxes to the right of the column. • To drop a column, right-click on the column name and select the Delete Selected item. • To move a column up or down, right-click on the column name and select the Move Up or Move Down item. You can also use the Up and Down keys on the keyboard. • To add a new column, double-click in the Column Name column below the last column and type in a new name. Then, specify the attributes for the new column. • To apply the changes to the table, click the Apply button. To reverse the changes, click the Revert button. Figure 11-10 How to work with the columns of a table y 363

Chapter 11 How to create databases, tables, and indexes The indexes for the Invoices table ■ MySQl. Workbench D X 6 Local instance MySQLSO x File Edit Vtew Query Database Sefver Tools Scripting Help fjl &il lil &l Bi!l rai ~ SCHEMAS ~ IRter ol)Jccn • U ap • Tables ► II oenual_ledoer_accounts ► i1 invoice_archive ► iii ln,olce_hne_items ► C Invoices ► El turns ► &l vendor_conta<ts ► Cl vendors Views 'cl'.l stored Procedures 'cl Functions ► ex ► om .. =• Administration Schemas Information Columns: = ~ ~~i~j Al PK nvoke_runber vardw(SO) invoic~ date. dare nvoice.Jiital drotN,1{9,2) payment_total deomal(9,2) aedit_total deomo1(9,2J te.rms_id nt(U) --- ~.., Aa ♦a .-.st. Ob)ea Info S5SIOO Description j ,., V V Query 1 il:1-:\i& Table Name: F I Schema: ap L-----------' Olarset/Collation: utfl!tnb4 v lutf8mb4_0900_ v Engine: [ lmoOB Cooments: Index Name Tyi:,e tndexCoums-------- PRIMARY PRIMARY mvo,ces_l'k_vendors INDEX lnvoices_fk_terms INDEX mvo1cesjnvoice_~. 1NOEX Column ;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
select the Alter Table item, and click on the Indexes tab. • To rename an index, double-click on the name and enter the new name. • To change the type of an index, click on the Type column. Then, select a type from the drop-down list that appears. Revert • To change the colu1nn that's indexed, select the index and then select its column in the list of columns that appears. You can also change the sort order of the index by clicking in the Order column and then selecting ASC or DESC from the drop-down list that appears. • To drop an index, right-click on the

order of the index by clicking in the Order column and then selecting ASC or DESC from the drop-down list that appears. • To drop an index, right-click on the index name and select the Delete Selected item. • To add a new index, double-click below the last index name and type in a new name. Then, specify the type, column, and order for the index. • To apply the changes to the table, click the Apply button. To reverse the changes, click the Revert button. Figure 11 -11 How to work with the indexes of a table V 365

Chapter 11 How to create databases, tables, and indexes The foreign keys for the Invoices table ■ MySQl. Workbench D X 6 1.oca1 IMlance MySOLSO x File Edit Vtew Query Database Server Tools Scripting Help ouerv 1 il:1\Hftlffll,;
```
Example SELECT statement from textbook.

### Example 3: DELETE Example
```sql
DELETE statements that use them. How to work with the columns of a table Figure 11-10 shows how to work with the column defmitions of a table. To start, you can view the column defmitions for a table by right-clicking on the table in the Navigator window and selecting Alter Table to display the table in the main window. Then, click on the Columns tab at the bottom of the window. For example, this figure shows the columns for the Invoices table. Here, you can see the name, data type, and other attributes of each column. For

bottom of the window. For example, this figure shows the columns for the Invoices table. Here, you can see the name, data type, and other attributes of each column. For instance, you can see that the invoice_id column is the primary key column and an auto increment column. The payment_total and credit_total columns specify a default value of 0.00. And the pay1nent_date column allows null values and its default value is NULL. If you need to add a new column, you can double-click below the last name in the Column Name column. Then, you can type in a name for the new column, and you can specify its attributes to the right of the column name. You can also work with a new or existing column using the controls below the list of columns. In this figure, for example, I've selected the invoice_id column, so the information for that column is displayed below the column list. This is useful if you aren't familiar with the abbreviations that are used for the check boxes in the column list, since these attributes

is displayed below the column list. This is useful if you aren't familiar with the abbreviations that are used for the check boxes in the column list, since these attributes are clearly identified by the check boxes below the list. You can also use the Charset and Collation drop- down lists to change the character set and collation for some columns. You'll learn more about that later in this chapter.

Chapter 11 How to create databases, tables, and indexes The column definitions for the Invoices table ■ MySQl. Workbench D X 6 Local instance MySQL80 x File Edit Vtew Query Database ServeT Tools Scripting Help N IV gato, Quay, il:4❖?ftlffll'1il-L ____________________ _ SOlEMAS ~ IFllter abJeds ., J ap T'al Tables ► Iii general_ledg,r_accounts ► i1 invoice_1rchlve ► iii lnvolce_hne_items ► ii Invoices ► ii terms ► Iii vendor_contacts ► El vendors loJ Viev.-s 'ell stored Procedures lc)l Functions ► ex ► om .. =• Adminlstntlon Schemas lnformabon Tab~ 1nll0lces Columns: in • . 1d nt{U) Al PK v~ id nt{ll) lnvoice_runber varctw(SO) invoice date date nvoice_ liita! deornel{9, 2l payment_tutal ~9,2 aedit_tutal deo 9,2 ternts_id r,t{U) j ,., V V Table Name: E._ _______ ___.I Schema: ap Olarset/Collation: utft!mb4 v utfanb4_0900_ v Engine: [!maOB Cooments: ColumnName ,nvoic,_ld vendor_icf lnvofce_number involce_d1te lnvoice_total < Datatype INT{ll) INT{l 1) VARCHAR(SO) DATE OECIMAL(9,2) Cdl.lm Name: ,__l 1nv_oice_1c1 _____ _. Olarsetft:;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 380, 381, 382, 383, 384, 385, 386, 387, 388, 389*