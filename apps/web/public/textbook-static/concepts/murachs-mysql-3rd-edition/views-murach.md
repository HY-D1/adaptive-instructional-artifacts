---
id: views-murach
title: Views
definition: Creating and using views in MySQL
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394]
chunkIds:
  - murachs-mysql-3rd-edition:p381:c1
  - murachs-mysql-3rd-edition:p381:c2
  - murachs-mysql-3rd-edition:p382:c1
  - murachs-mysql-3rd-edition:p382:c2
  - murachs-mysql-3rd-edition:p382:c3
  - murachs-mysql-3rd-edition:p383:c1
  - murachs-mysql-3rd-edition:p383:c2
  - murachs-mysql-3rd-edition:p383:c3
  - murachs-mysql-3rd-edition:p384:c1
  - murachs-mysql-3rd-edition:p385:c1
  - murachs-mysql-3rd-edition:p385:c2
  - murachs-mysql-3rd-edition:p385:c3
  - murachs-mysql-3rd-edition:p386:c1
  - murachs-mysql-3rd-edition:p387:c1
  - murachs-mysql-3rd-edition:p387:c2
  - murachs-mysql-3rd-edition:p387:c3
  - murachs-mysql-3rd-edition:p388:c1
  - murachs-mysql-3rd-edition:p388:c2
  - murachs-mysql-3rd-edition:p388:c3
  - murachs-mysql-3rd-edition:p388:c4
  - murachs-mysql-3rd-edition:p389:c1
  - murachs-mysql-3rd-edition:p389:c2
  - murachs-mysql-3rd-edition:p389:c3
  - murachs-mysql-3rd-edition:p390:c1
  - murachs-mysql-3rd-edition:p390:c2
  - murachs-mysql-3rd-edition:p390:c3
  - murachs-mysql-3rd-edition:p391:c1
  - murachs-mysql-3rd-edition:p391:c2
  - murachs-mysql-3rd-edition:p392:c1
  - murachs-mysql-3rd-edition:p392:c2
  - murachs-mysql-3rd-edition:p392:c3
  - murachs-mysql-3rd-edition:p394:c1
  - murachs-mysql-3rd-edition:p394:c2
  - murachs-mysql-3rd-edition:p394:c3
relatedConcepts:
tags:
  - mysql
  - views
  - virtualization
sourceDocId: murachs-mysql-3rd-edition
---

# Views

## Definition
Creating and using views in MySQL

## Explanation
Chapter 11 How to create databases, tables, and indexes The SQL script that creates the AP database CREATE TABLE ( • • invoices invoice_ id vendor_ id invoice_number invoice_date invoice_ total payment_ total credit_ total INT PRIMARY KEY); terms_ id INT VARCHAR(SO) DATE DECIMAL(9,2) DECIMAL(9,2) DECIMAL(9,2) INT invoice_due_date DATE payment_date DATE, CONSTRAINT invoices_ fk vendors FOREIGN KEY (vendor id) REFERENCES vendors (vendor_ id), CONSTRAINT invoices_ fk_terms FOREIGN KEY (terms_ id) REFERENCES terms (terms id) CREATE TABLE invoice line items ( invoice_ id INT • • 1nvo1ce_sequence INT INT NOT NOT NOT NOT NOT NOT NOT NOT account number line_ item_amount line_ item_description CONSTRAINT line_ items_pk DECIMAL(9,2) VARCHAR(lOO) NULL, NULL, NULL, NULL, NULL NULL NULL, NULL, NOT NOT NOT NOT NOT PRIMARY KEY (invoice_ id, invoice_sequence), CONSTRAINT line_ items_ fk_ invoices FOREIGN KEY (invoice id) REFERENCES invoices (invoice_ id), CONSTRAINT line_ items_ fk_acounts FOREIGN KEY (account number) NULL, NULL, NULL, NULL, NULL, AUTO_ INCREMENT, DEFAULT O, DEFAULT 0, REFERENCES general_ ledger_accounts (account number)); -- create an index CREATE INDEX invoices_ invoice date ix ON invoices (invoice_date DESC); The script used to

NULL, NULL, NULL, NULL, NULL, AUTO_ INCREMENT, DEFAULT O, DEFAULT 0, REFERENCES general_ ledger_accounts (account number)); -- create an index CREATE INDEX invoices_ invoice date ix ON invoices (invoice_date DESC); The script used to create the AP database (part 2 of 2) Page2

How to use MySQL Workbench Since you often use a script to create tables and other database objects, it's important to understand the DDL skills presented in this chapter. Once you understand these skills, it's easy to learn how to use a graphical user interface such as MySQL Workbench to work with database objects such as tables and indexes. For example, it's often useful to view these database objects before writing the SELECT, INSERT, UPDATE, or DELETE statement

## Examples
### Example 1: SELECT Example
```sql
select the Alter Table item, and click on the Columns tab. • to rename a column, double-click on the column name and enter the new name. • to change the data type for a column, click on the data type in the Datatype colt1mn. Then, select a data type from the drop-down list that's displayed. • to change the default value for

the data type for a column, click on the data type in the Datatype colt1mn. Then, select a data type from the drop-down list that's displayed. • to change the default value for a column, enter a new default valt1e in the Default column. • to change other attributes of the column, check or uncheck the attribute check boxes to the right of the column. • to drop a column, right-click on the column name and select the Delete Selected item. • to move a column up or down, right-click on the column name and select the Move Up or Move Down item. You can also use the Up and Down keys on the keyboard. • to add a new column, double-click in the Column Name column below the last column and type in a new name. Then, specify the attributes for the new column. • to apply the changes to the table, click the Apply button. to reverse the changes, click the Revert button. How to work with the columns of a table y

How to work with the indexes of a table Although MySQL Workbench provides several ways to work with indexes, one of the easiest is to right-click on the table in the Navigator window and select the Alter Table command to display the table defmition. Then, you can click on the Indexes tab to display the indexes of the table. For example, figure 11-11 shows the indexes for the Invoices table. In most cases, you'll use this tab to add indexes to a table. to do that, you start by double-clicking below the last index name and entering the name of the new index. Then, you can select the type of index you want to create, the column or columns you want to index, and the order for each column. to change or drop an index, you can use the skills presented in this figure.

Chapter 11 How to create databases, tables, and indexes The indexes for the Invoices table ■ MySQl. Workbench D X Local instance MySQLSO x File Edit Vtew Query Database Sefver Tools Scripting Help fjl &il lil &l Bi!l rai ~ SCHEMAS ~ IRter ol)Jccn • U ap • Tables ► II oenual_ledoer_accounts ► i1 invoice_archive ► iii ln,olce_hne_items ► C Invoices ► El turns ► &l vendor_conta<ts ► Cl vendors Views 'cl'.l stored Procedures 'cl Functions ► ex ► om.. =• Administration Schemas Information Columns: = ~ ~~i~j Al PK nvoke_runber vardw(SO) invoic~ date. dare nvoice. Jiital drotN,1{9,2) payment_total deomal(9,2) aedit_total deomo1(9,2J te.rms_id nt(U) --- ~.., Aa ♦a.-.st. Ob)ea Info S5SIOO Description j,., V V Query 1 il:1-:\i& Table Name: F I Schema: ap L-----------' Olarset/Collation: utfl!tnb4 v lutf8mb4_0900_ v Engine: [ lmoOB Cooments: Index Name Tyi:,e tndexCoums-------- PRIMARY PRIMARY mvo,ces_l'k_vendors INDEX lnvoices_fk_terms INDEX mvo1cesjnvoice_~. 1NOEX Column;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
select the Alter Table item, and click on the Indexes tab. • to rename an index, double-click on the name and enter the new name. • to change the type of an index, click on the Type column. Then, select a type from the drop-down list that appears. Revert • to change the colu1nn that's indexed, select the index and then select its column in the list of columns that appears. You can also change the sort order of the index by clicking in the Order column and then selecting ASC or DESC from the drop-down list that appears. • to drop an index, right-click on the

change the sort order of the index by clicking in the Order column and then selecting ASC or DESC from the drop-down list that appears. • to drop an index, right-click on the index name and select the Delete Selected item. • to add a new index, double-click below the last index name and type in a new name. Then, specify the type, column, and order for the index. • to apply the changes to the table, click the Apply button. to reverse the changes, click the Revert button. Figure 11 -11 How to work with the indexes of a table V

How to work with the foreign keys of a table to work with the foreign keys of a table, you use the Foreign Keys tab. For example, foreign key named invoices_fk_terms is selected. Here, MySQL Workbench shows the table that's refe1 enced by the foreign key, the foreign key column, and the column that's referenced by the foreign key. If you need to, you can change any of the information that defmes the foreign key as described in this figure. You can also add new foreign keys, and you can drop existing keys.

Chapter 11 How to create databases, tables, and indexes The foreign keys for the Invoices table ■ MySQl. Workbench D X 1.oca1 IMlance MySOLSO x File Edit Vtew Query Database Server Tools Scripting Help ouerv 1 il:1 \Hftlffll,;
```
Example SELECT statement from textbook.

### Example 3: DELETE Example
```sql
DELETE statements that use them. How to work with the columns of a table start, you can view the column defmitions for a table by right-clicking on the table in the Navigator window and selecting Alter Table to display the table in the main window. Then, click on the Columns tab at the bottom of the window. For example, this figure shows the columns for the Invoices table. Here, you can see the name, data type, and other attributes of each column. For instance, you can see that the invoice_id column is the primary key column and an auto increment column. The payment_total and

the name, data type, and other attributes of each column. For instance, you can see that the invoice_id column is the primary key column and an auto increment column. The payment_total and credit_total columns specify a default value of 0.00. And the pay1nent_date column allows null values and its default value is NULL. If you need to add a new column, you can double-click below the last name in the Column Name column. Then, you can type in a name for the new column, and you can specify its attributes to the right of the column name. You can also work with a new or existing column using the controls below the list of columns. In this figure, for example, I've selected the invoice_id column, so the information for that column is displayed below the column list. This is useful if you aren't familiar with the abbreviations that are used for the check boxes in the column list, since these attributes are clearly identified by the check boxes below the list. You can also use the Charset and Collation dropdown

are used for the check boxes in the column list, since these attributes are clearly identified by the check boxes below the list. You can also use the Charset and Collation dropdown lists to change the character set and collation for some columns. You'll learn more about that later in this chapter.

Chapter 11 How to create databases, tables, and indexes The column definitions for the Invoices table ■ MySQl. Workbench D X Local instance MySQL80 x File Edit Vtew Query Database ServeT Tools Scripting Help N IV gato, Quay, il:4❖?ftlffll'1il-L ____________________ _ SOlEMAS ~ IFllter abJeds., J ap T'al Tables ► Iii general_ledg,r_accounts ► i1 invoice_1rchlve ► iii lnvolce_hne_items ► ii Invoices ► ii terms ► Iii vendor_contacts ► El vendors loJ Viev.-s 'ell stored Procedures lc)l Functions ► ex ► om.. =• Adminlstntlon Schemas lnformabon Tab~ 1nll0lces Columns: in •. 1d nt{U) Al PK v~ id nt{ll) lnvoice_runber varctw(SO) invoice date date nvoice_ liita! deornel{9, 2l payment_tutal ~9,2 aedit_tutal deo 9,2 ternts_id r,t{U) j,., V V Table Name: E._ _______ ___.I Schema: ap Olarset/Collation: utft!mb4 v utfanb4_0900_ v Engine: [!maOB Cooments: ColumnName,nvoic,_ld vendor_icf lnvofce_number involce_d1te lnvoice_total < Datatype INT{ll) INT{l 1) VARCHAR(SO) DATE OECIMAL(9,2) Cdl.lm Name:,__l 1nv_oice_1c1 _____ _. Olarsetft:;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 381, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394*
