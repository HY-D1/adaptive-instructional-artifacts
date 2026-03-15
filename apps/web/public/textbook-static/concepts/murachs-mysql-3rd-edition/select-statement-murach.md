---
id: select-statement-murach
title: SELECT Statement
definition: Retrieving data from a single table with column selection and aliases
difficulty: beginner
estimatedReadTime: 5
pageReferences: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95]
chunkIds:
  - murachs-mysql-3rd-edition:p73:c1
  - murachs-mysql-3rd-edition:p73:c2
  - murachs-mysql-3rd-edition:p73:c3
  - murachs-mysql-3rd-edition:p74:c1
  - murachs-mysql-3rd-edition:p74:c2
  - murachs-mysql-3rd-edition:p74:c3
  - murachs-mysql-3rd-edition:p75:c1
  - murachs-mysql-3rd-edition:p75:c2
  - murachs-mysql-3rd-edition:p75:c3
  - murachs-mysql-3rd-edition:p76:c1
  - murachs-mysql-3rd-edition:p76:c2
  - murachs-mysql-3rd-edition:p77:c1
  - murachs-mysql-3rd-edition:p77:c2
  - murachs-mysql-3rd-edition:p77:c3
  - murachs-mysql-3rd-edition:p78:c1
  - murachs-mysql-3rd-edition:p78:c2
  - murachs-mysql-3rd-edition:p79:c1
  - murachs-mysql-3rd-edition:p79:c2
  - murachs-mysql-3rd-edition:p80:c1
  - murachs-mysql-3rd-edition:p80:c2
  - murachs-mysql-3rd-edition:p81:c1
  - murachs-mysql-3rd-edition:p81:c2
  - murachs-mysql-3rd-edition:p81:c3
  - murachs-mysql-3rd-edition:p82:c1
  - murachs-mysql-3rd-edition:p82:c2
  - murachs-mysql-3rd-edition:p83:c1
  - murachs-mysql-3rd-edition:p83:c2
  - murachs-mysql-3rd-edition:p83:c3
  - murachs-mysql-3rd-edition:p84:c1
  - murachs-mysql-3rd-edition:p84:c2
  - murachs-mysql-3rd-edition:p84:c3
  - murachs-mysql-3rd-edition:p85:c1
  - murachs-mysql-3rd-edition:p85:c2
  - murachs-mysql-3rd-edition:p85:c3
  - murachs-mysql-3rd-edition:p86:c1
  - murachs-mysql-3rd-edition:p86:c2
  - murachs-mysql-3rd-edition:p86:c3
  - murachs-mysql-3rd-edition:p87:c1
  - murachs-mysql-3rd-edition:p87:c2
  - murachs-mysql-3rd-edition:p88:c1
  - murachs-mysql-3rd-edition:p88:c2
  - murachs-mysql-3rd-edition:p88:c3
  - murachs-mysql-3rd-edition:p89:c1
  - murachs-mysql-3rd-edition:p89:c2
  - murachs-mysql-3rd-edition:p90:c1
  - murachs-mysql-3rd-edition:p90:c2
  - murachs-mysql-3rd-edition:p91:c1
  - murachs-mysql-3rd-edition:p91:c2
  - murachs-mysql-3rd-edition:p93:c1
  - murachs-mysql-3rd-edition:p93:c2
  - murachs-mysql-3rd-edition:p94:c1
  - murachs-mysql-3rd-edition:p94:c2
  - murachs-mysql-3rd-edition:p94:c3
  - murachs-mysql-3rd-edition:p95:c1
  - murachs-mysql-3rd-edition:p95:c2
  - murachs-mysql-3rd-edition:p95:c3
relatedConcepts:
tags:
  - mysql
  - select
  - fundamentals
sourceDocId: murachs-mysql-3rd-edition
---

# SELECT Statement

## Definition
Retrieving data from a single table with column selection and aliases

## Explanation
Cliapter 2 How to use MySQL Workbench and other develop,nent tools The column definitions for the Vendors table 8 MySQL Workbench Local insmnce MySQLSO X File Edit Vif!!N Query Database Senter Tools Scnptmo Help Que,y1 SCHEMAS Table Name: lvendc.-s J Sdtema: ap q, I RI~ ob)ects T.J ap Owset/Colation: utfBni>'l - v j utf8mb'1_0900_ v Engine: lmo06 T'cl Tables ► general_ledger_accounts ► fnvo1ce_archlve ► mvoice_lme_iteJT'6 ► Invokes ► te_rms ► II vendor_contacts T vendors ►[;:) Co lumns ► Ind!!RS ► ~ Fore:ion Keys ► Triggers Views storNI Procedures 'i!5J Functions ► ex ► om ► sys Administration ~as • for, uo Table: vendors Columns: lnt(ll) AIPK vardia va<cha varcha var cha char(2: Comments: CoumName vendor_id vendor_name J vendor _addressl; vie_ndor _address2 vendor_dty vendor_sta2 vendor_zip_codt vendor_phone vendor_contact_last_name vie_ndor _contact_firsLname ~ ddault_terms_id ~ ddauft_account_number < Colum Name.: Charset/Cola6on: Comments: Datatype INT(U) VARCHAA(SO} VAACHAA(SO) VARCHAA(SO) VAACHAA(SO} CHAR{2) VARCHAA(20) VARCHAA(SO) VARCHAR(SO) VARCHAA(SO}!Nl{l 1)!Nl{U) PK l'-N UQ B ~ lF 0 D D D D D E2l E2I D D D D D D D D D □ D □ D D □ □ E2I

VARCHAA(SO) VAACHAA(SO} CHAR{2) VARCHAA(20) VARCHAA(SO) VARCHAR(SO) VARCHAA(SO}!Nl{l 1)!Nl{U) PK l'-N UQ B ~ lF 0 D D D D D E2l E2I D D D D D D D D D □ D □ D D □ □ E2I □ □ □ □ □ E2I □ □ D □ □ 0 □ D D □ □ D D D D □ D D □ □ D □ □ D D □ D □ □ E2I □ □ D □ □ E2I □ D D □ Data Type: DefalJt: Starage: Virtual Primary Key Bnarv Autolncr~t vendor id vendor_naml! veocb _address! vendor _address2 vendc<_oty vendor _state vendor _zlp_code vendor _phone Vatchll varcha Colu111ns Indexes Foreign Keys Trfggers Partitioning Options varcha v Al E2l D D D D D D □ D D D D □ V.. G Oefault,bilresslon D D D D D □ □ D D D D D Sto,-ed NULL NULL NULL NULL NULL Notl'd Urtqie u~ aroMlf > ven<!or _contact_l!9!l'l_name Object Info Session Apply Revert Description • to view the column definitions for a table, right-click the table name

D Sto,-ed NULL N

## Examples
### Example 1: SELECT Example
```sql
select the Alter Table command. Then, select the Columns tab at the bottom of the window that's displayed to view the column definitions for the table. • to edit the column definitions for a table, view the column definitions. Then, you can t1se the resulting window to add new columns and modify and delete existing columns. • For more information about creating and modifying tables, see chapter 11. How to view and edit the column definitions X V

How to use MySQL Workbench to run SQL staten,ents Besides letting you review the design of a database, MySQL Workbench is a great tool for entering and running SQL statements. How to enter and execute a SQL statement When you first connect to a MySQL server in MySQL Workbench, a SQL Editor tab is automatically opened. to enter and execute a SQL statement. The easiest way to open a SQL Editor tab is to click the Create New SQL Tab button in the SQL Editor toolbar or p1 ess the Ctrl+ T keys. Once you open a SQL tab, you can use standard techniques to enter or edit a SQL statement. As you enter statements, you'll notice that MySQL Workbench automatically applies colors to various elements. For example, it displays keywords in blue. This makes your state1nents easier to read and understand and can help you identify coding en ors. to execute a single SQL statement like the one in this figure, you can press Ctrl+Enter or click the Execute Current statement button in the SQL Editor toolbar. If the

coding en ors. to execute a single SQL statement like the one in this figure, you can press Ctrl+Enter or click the Execute Current statement button in the SQL Editor toolbar. If the statement returns data, that data is displayed below the SQL editor in a corresponding Result grid. In this figure, for example, the result set returned by the SELECT statement is displayed. If necessary, you can adjust the height of the Result grid by dragging the bar that separates the SQL Editor tab from the Result grid. Before you execute a SQL statement, make sure you've selected a database by double-clicking the database in the Navigator window. Otherwise, you'll get an error message like this: Error Code: 1046. No database selected Similarly, if you haven't selected the co1Tect database, you'll get an error message that says the table doesn't exist. For exan1ple, if the EX database is selected when you attempt to retrieve data from the Vendors table, you' 11 get an error message like this: Error Code: 1146. Table •ex.vendors' doesn't exist to fix this, you can

the EX database is selected when you attempt to retrieve data from the Vendors table, you' 11 get an error message like this: Error Code: 1146. Table •ex.vendors' doesn't exist to fix this, you can double-click the AP database to select it.

Cliapter 2 How to use MySQL Workbench and other develop,nent tools A SELECT statement and its results Create New SQL Tab button 11 M orkbench / wcat tns:tance MySQL.80 X Execute Current statement button File 1 -1 V!e'N Query Database Saver T oals Sc no Help Query 1 X SQL editor SCHEMAS ~ I Fil~ ob]l!CIS,, J ap u.,,. l"'"'I Umil to 100(hows • I 1-9 I ~ Q. l1l ~ • Tables ► Ell 9enual_led9l!l'_accounts ► iJ invoice_archlve ► El lnvoice_ll~_,t,ms ► ii Invoices ► terms ► el ve.ndor_contacts " El vendors ► t-1 Columns ► Indexes ► Foreigo Keys ►~Triggers Vi~ 'al Stored Procedures!?Ii Funrtlnn~ Adml11istrallon Sch~as ll'form.won Table: vendors Columns: vernlor ld vendor_name vendor _addressl vendor _address2 vt'fldor -dty vendor _state... lnl{I I) AlPK vard,a varcha varc:ha varcha diar(2 "' l • SELECT vendor_naee, vendor_city, vendor_state FR0'-1 vendors ORDER 8Y ve ndor_nam~ < vendor_name ► Abbev 0~ F\lnlsmgs Amencan Booksde's Assoc American Elqlress ASC~ Ascom Hasler Maino Systems AT&T Aztekl.cbel Baker & Taylor Books Bertelsmam indus1Jy Svcs. Inc 6fl tndUstrles Bil Jon6 Bil Marvn Electnc Inc Blanchartf

Abbev 0~ F\lnlsmgs Amencan Booksde's Assoc American Elqlress ASC~ Ascom Hasler Maino Systems AT&T Aztekl.cbel Baker & Taylor Books Bertelsmam indus1Jy Svcs. Inc 6fl tndUstrles Bil Jon6 Bil Marvn Electnc Inc Blanchartf & Johnson Associates Bkietross Blue Shield of California Bouche,- Cwmncabons Inc earners Pub\shino ~v Cal State Termite vendor_dty Fresno Tarrytown vendor _state CA NY Los Angdes CA Fresno Sheltot'I Phoenix Anahesn Owtotte Valenoa Fresno CA CT A1. CA NC CA CA Sacrament!> CA Fresno CA Mssion Viejo CA ())cnard CA Mahe. Tl CA FortWashi... PA Tuel.ala! m Selma CA Fresno CA Result grid D X □... "' Feld Tvi- > ObJect Info Session Califumia Business Machines vendors 1 >< 0 ReadOnly Description • to open a new SQL tab, press Ctrl+T or click the Create New SQL Tab button () in the SQL Editor toolbar. • to select the current database, double-click it in the Schemas tab of the Navigator window. This displays the selected database in bold. • to enter a SQL statement, type it into the SQL editor. • As you enter the text for a

in the Schemas tab of the Navigator window. This displays the selected database in bold. • to enter a SQL statement, type it into the SQL editor. • As you enter the text for a statement, the SQL editor applies color to various elements, such as SQL keywords, to make them easy to identify. • to execute a SQL statement, press Ctrl+Enter or click the Execute Current statement button ({if) in the SQL Editor toolbar. If the statement retrieves data, the data is displayed in a Result grid below the SQL tab. How to enter and execute a SOL statement

How to use snippets You can think of the srzippets that come with MySQL Workbench as a library of SQL syntax. This library is divided into statements that you can use to manage a database, define objects in a database, and manipulate the data in a database. You can also create your own snippets that provide custom code. In fact, you're more likely to create your own snippets than you are to use the built-in snippets. That's because the syntax that's provided for the bt1ilt-in snippets is much more complex than what you typically need. isn't displayed, you can display it by clicking on the rightmost button at the 1ight side of the SQL Editor tab. Then, you can display the snippets tab and use the drop-down list at the top of the tab to select a category of snippets. In this figUI e, for example, the My Snippets category is displayed. From here, you can select a snippet and then click the Insert Snippet button to enter the snippet into the SQL Editor tab. Finally, you can edit the

the My Snippets category is displayed. From here, you can select a snippet and then click the Insert Snippet button to enter the snippet into the SQL Editor tab. Finally, you can edit the snippet code so it's appropriate for your SQL statement. In this figure, the snippet contains code that I wrote for joining the vendors, invoices, and invoice_line_items tables. to create this snippet, I entered it into a SQL Editor tab and then clicked the Add New Snippet button. By saving this statement as a snippet, I can now use it anytime I want to join these trulee tables instead of having to type it each time. For now, don't wo1Ty if you don't understand the SQL statement p1 esented in this figure. The main point is that you can use the Snippets tab to save and retrieve a variety of SQL code. As you learn more about SQL statements, you'll see how useful this can be.

Cliapter 2 How to use MySQL Workbench and other develop,nent tools The SQL Additions tab with a snippet created by a user ■ MysQL Workbench A Local instance MySQLSO x File Edit View Query Database Server Tools Scnptmg Help q_ 11,ter objects • @ ap ►~Tables V,ev.-s '5l Stored Procedures 'al Functions ► ex ► om ► sys Description SQl ~dd1i:Jons Q Q I f' W ~ I~ I lmlto 1000rows • I..(> I My~s 1 ♦ SELECT a fRCf'I vendor-s v JOIII invoices i OIi v. vendor id % i. vendor id - - JOill invoice_line_iteflls li OH i. invoice id = li. invoice id - - X • The SQL Additions window contains context help and snippets. Snippets contain the syntax for many common SQL statements. You can use the snippets to guide you as you create a SQL statement. You can also create your own snippets and save them for later use. • The SQL Additions window is displayed to the right of the SQL Editor tab by default. If this window isn't displayed, you can display

own snippets and save them for later use. • The SQL Additions window is displayed to the right of the SQL Editor tab by default. If this window isn't displayed, you can display it by clicking the rightmost button (□) at the right side of the SQL Editor toolbar. Then, you can click the Snippets tab to display the available snippets. • The snippets are organized into categories. to display any category of snippets, select the category from the drop-down list at the top of the Snippets tab. • to enter a snippet into a SQL editor, select the snippet and then click the Insert Snippet button (~ at the top of the Snippets tab. Then, edit the snippet code so it's appropriate for your SQL statement. • to replace code in the SQL editor with a snippet, select the code, select the snippet you want to replace it with, and then click the Replace Current Text button ( ~). • to create your own snippet, enter the code for the snippet into a SQL editor tab. Then, select the

replace it with, and then click the Replace Current Text button ( ~). • to create your own snippet, enter the code for the snippet into a SQL editor tab. Then, select the category where you want to save the snippet, click the Save Snippet button ( 1-¢) in the SQL Editor toolbar, and enter a name for the snippet. • to delete a snippet, right-click it in the Snippets tab and select the Delete Snippet item. How to use the Snippets tab

How to handle syntax errors If an error occurs during the execution of a SQL statement, MySQL Workbench displays a message that includes the error numbe1 and a brief description of the error. In number of 1146 and a brief description that says ''Table ap.vendor doesn't exist." In this example, the problem is that the Vendor table doesn't exist in the database. to fix the problem, you need to edit the SQL statement so the table is Vendors instead of Vendor. Then, you should be able to successfully run the SQL statement. This figure also lists some other common causes of errors. As you can see, most e1Tors are caused by incorrect syntax. However, it's also common to get an error if you have selected the wrong database. If, for example, you have selected the EX database and you try to run a statement that refers to tables in the AP database, you will get an error. Regardless of what's causing the problem, you can usually identify and correct the problem without much trouble. In some cases, though, it may

tables in the AP database, you will get an error. Regardless of what's causing the problem, you can usually identify and correct the problem without much trouble. In some cases, though, it may be diffict1lt to figure out the cause of an error. Then, you can usually get more information about the error by searching the Internet or by searching the MySQL Reference Manual as described later in this chapter.

Cliapter 2 How to use MySQL Workbench and other develop,nent tools How to handle syntax errors iJ MySQL Workbench D X 4iLocal inslance MySOl.80 X File &lit v,_ 0uef)' Oatabas-e Server Tools Scnpb119 Help iil'Hi1 _________________________ _ SCKEMAS c;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
SELECT vendor_name. vendor_cty. vend«_slal... &rorCode: 1146 Table 'ap.vendor' doesn\ eiosl 0.000 sec AJPK varcha v11rd'la varcha ~archa char(!.., Common causes of errors • Having the wrong database selected • Misspelling the name of a table or column • Misspelling a keyword •

eiosl 0.000 sec AJPK varcha v11rd'la varcha ~archa char(!.., Common causes of errors • Having the wrong database selected • Misspelling the name of a table or column • Misspelling a keyword • Omitting the closing quotation mark for a character string Description • If an error occurs during the execution of a SQL statement, MySQL Workbench displays a message in the Output tab that includes an error code and a brief description of the error. • Most errors are caused by incorrect syntax and can be corrected without any additional assistance. Otherwise, you can usually get more information about an error by searching for the error code or description in the MySQL Reference Manual or on the Internet. How to handle syntax errors >

How to open and save SQL scripts In MySQL, a script is a file that contains one or more SQL statements. to create a script, you enter the state1nents you want it to include into a SQL Editor tab. You '11 learn more about that in the next figure. Then, you can click the Save button or press Ctrl+S to save the script as described in Once you've saved a script, you can open it later. to do that, you can click the Open SQL Script File button in the SQL Editor toolbar, or you can press Ctrl+Shift+O. In this figure, the dialog box that's displayed shows the script files that have been saved for chapter 2. These files are created when you download and install the source code for this book. Note that the names of these files have the.sql extension. (If you're using Windows 10 and the file extensions aren't displayed, you can display them by opening the File Explorer, displaying the View tab, and selecting the ''File name extensions'' option in the Show/hide group.) Once you open

and the file extensions aren't displayed, you can display them by opening the File Explorer, displaying the View tab, and selecting the ''File name extensions'' option in the Show/hide group.) Once you open a script, you can run it as shown in the next figure. You can also t1se it as the basis for a new SQL script. to do that, just modify it any way you want. Then, you can save it as a new script by pressing the Ctrl+Shift+S keys or selecting the File➔ Save Script As command. The screen in this figure shows the tabs for two script files that have been opened. After you open two or more scripts, you can switch between them by clicking on the appropriate tab. Then, you can cut, copy, and paste code from one script to another.

Cliapter 2 How to use MySQL Workbench and other develop,nent tools The Open SQL Script dialog box Open SQL Script File button D X._....., ms_tance MySQL.80 X v~N Que,y Database Server Tools ScriJ>lino Help avu;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
Insert Snippet button to enter the snippet into the SQL Editor tab. Finally, you can edit the

the My Snippets category is displayed. From here, you can select a snippet and then click the Insert Snippet button to enter the snippet into the SQL Editor tab. Finally, you can edit the snippet code so it's appropriate for your SQL statement. In this figure, the snippet contains code that I wrote for joining the vendors, invoices, and invoice_line_items tables. to create this snippet, I entered it into a SQL Editor tab and then clicked the Add New Snippet button. By saving this statement as a snippet, I can now use it anytime I want to join these trulee tables instead of having to type it each time. For now, don't wo1Ty if you don't understand the SQL statement p1 esented in this figure. The main point is that you can use the Snippets tab to save and retrieve a variety of SQL code. As you learn more about SQL statements, you'll see how useful this can be.

Cliapter 2 How to use MySQL Workbench and other develop,nent tools The SQL Additions tab with a snippet created by a user ■ MysQL Workbench A Local instance MySQLSO x File Edit View Query Database Server Tools Scnptmg Help q_ 11,ter objects • @ ap ►~Tables V,ev.-s '5l Stored Procedures 'al Functions ► ex ► om ► sys Description SQl ~dd1i:Jons Q Q I f' W ~ I~ I lmlto 1000rows • I..(> I My~s 1 ♦ SELECT a fRCf'I vendor-s v JOIII invoices i OIi v. vendor id % i. vendor id - - JOill invoice_line_iteflls li OH i. invoice id = li. invoice id - - X • The SQL Additions window contains context help and snippets. Snippets contain the syntax for many common SQL statements. You can use the snippets to guide you as you create a SQL statement. You can also create your own snippets and save them for later use. • The SQL Additions window is displayed to the right of the SQL Editor tab by default. If this window isn't displayed, you can display

own snippets and save them for later use. • The SQL Additions window is displayed to the right of the SQL Editor tab by default. If this window isn't displayed, you can display it by clicking the rightmost button (□) at the right side of the SQL Editor toolbar. Then, you can click the Snippets tab to display the available snippets. • The snippets are organized into categories. to display any category of snippets, select the category from the drop-down list at the top of the Snippets tab. • to enter a snippet into a SQL editor, select the snippet and then click the Insert Snippet button (~ at the top of the Snippets tab. Then, edit the snippet code so it's appropriate for your SQL statement. • to replace code in the SQL editor with a snippet, select the code, select the snippet you want to replace it with, and then click the Replace Current Text button ( ~). • to create your own snippet, enter the code for the snippet into a SQL editor tab. Then, select the

replace it with, and then click the Replace Current Text button ( ~). • to create your own snippet, enter the code for the snippet into a SQL editor tab. Then, select the category where you want to save the snippet, click the Save Snippet button ( 1-¢) in the SQL Editor toolbar, and enter a name for the snippet. • to delete a snippet, right-click it in the Snippets tab and select the Delete Snippet item. How to use the Snippets tab

How to handle syntax errors If an error occurs during the execution of a SQL statement, MySQL Workbench displays a message that includes the error numbe1 and a brief description of the error. In number of 1146 and a brief description that says ''Table ap.vendor doesn't exist." In this example, the problem is that the Vendor table doesn't exist in the database. to fix the problem, you need to edit the SQL statement so the table is Vendors instead of Vendor. Then, you should be able to successfully run the SQL statement. This figure also lists some other common causes of errors. As you can see, most e1Tors are caused by incorrect syntax. However, it's also common to get an error if you have selected the wrong database. If, for example, you have selected the EX database and you try to run a statement that refers to tables in the AP database, you will get an error. Regardless of what's causing the problem, you can usually identify and correct the problem without much trouble. In some cases, though, it may

tables in the AP database, you will get an error. Regardless of what's causing the problem, you can usually identify and correct the problem without much trouble. In some cases, though, it may be diffict1lt to figure out the cause of an error. Then, you can usually get more information about the error by searching the Internet or by searching the MySQL Reference Manual as described later in this chapter.

Cliapter 2 How to use MySQL Workbench and other develop,nent tools How to handle syntax errors iJ MySQL Workbench D X 4iLocal inslance MySOl.80 X File &lit v,_ 0uef)' Oatabas-e Server Tools Scnpb119 Help iil'Hi1 _________________________ _ SCKEMAS c;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95*
