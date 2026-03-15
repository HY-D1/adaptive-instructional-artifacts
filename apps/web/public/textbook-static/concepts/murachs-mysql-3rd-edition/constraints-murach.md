---
id: constraints-murach
title: Constraints
definition: PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, and NOT NULL
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357]
chunkIds:
  - murachs-mysql-3rd-edition:p345:c1
  - murachs-mysql-3rd-edition:p345:c2
  - murachs-mysql-3rd-edition:p346:c1
  - murachs-mysql-3rd-edition:p346:c2
  - murachs-mysql-3rd-edition:p347:c1
  - murachs-mysql-3rd-edition:p347:c2
  - murachs-mysql-3rd-edition:p348:c1
  - murachs-mysql-3rd-edition:p348:c2
  - murachs-mysql-3rd-edition:p348:c3
  - murachs-mysql-3rd-edition:p348:c4
  - murachs-mysql-3rd-edition:p349:c1
  - murachs-mysql-3rd-edition:p349:c2
  - murachs-mysql-3rd-edition:p349:c3
  - murachs-mysql-3rd-edition:p350:c1
  - murachs-mysql-3rd-edition:p350:c2
  - murachs-mysql-3rd-edition:p350:c3
  - murachs-mysql-3rd-edition:p350:c4
  - murachs-mysql-3rd-edition:p351:c1
  - murachs-mysql-3rd-edition:p351:c2
  - murachs-mysql-3rd-edition:p351:c3
  - murachs-mysql-3rd-edition:p352:c1
  - murachs-mysql-3rd-edition:p352:c2
  - murachs-mysql-3rd-edition:p352:c3
  - murachs-mysql-3rd-edition:p353:c1
  - murachs-mysql-3rd-edition:p353:c2
  - murachs-mysql-3rd-edition:p354:c1
  - murachs-mysql-3rd-edition:p354:c2
  - murachs-mysql-3rd-edition:p354:c3
  - murachs-mysql-3rd-edition:p354:c4
  - murachs-mysql-3rd-edition:p355:c1
  - murachs-mysql-3rd-edition:p355:c2
  - murachs-mysql-3rd-edition:p355:c3
  - murachs-mysql-3rd-edition:p356:c1
  - murachs-mysql-3rd-edition:p356:c2
  - murachs-mysql-3rd-edition:p356:c3
  - murachs-mysql-3rd-edition:p357:c1
  - murachs-mysql-3rd-edition:p357:c2
  - murachs-mysql-3rd-edition:p357:c3
  - murachs-mysql-3rd-edition:p357:c4
relatedConcepts:
tags:
  - mysql
  - constraints
  - integrity
sourceDocId: murachs-mysql-3rd-edition
---

# Constraints

## Definition
PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, and NOT NULL

## Explanation
Chapter 10 Hovv to design a database The invoice data with a column that contains repeating values vendor _name lnvoice_number it:em_desaipbon - ► Cahners Publishing 112897 Android ad, MySQL ad, Library directory Zylka Design 97/522 Catalogs, MySQL Flyer Zylka Design 97/ 5-n:3 Card revision The invoice data with repeating columns vendor_name invotce number item_c:lesaiption_l item_desaiption_2 ltem_c:lescription_ 3 ► Cahners Pubfishing 112897 Android ad MySQLad Library directory Zylka Design 97/552 Catalogs MySQL flyer cm,, Zyfka Design 97/ SSE Card revision IH~!I w•l!I = = The invoice data in first normal form vendor _name invoice_number,tern_ descnption ► Cahners Publishing 112897 Android ad Cahners Publishlng 112897 MySQLad Cahners Publishing 112897 Library directory Zylka Design 97/5-22 Catalogs Zylka Design 97/522 MySQL flyer ZyikaDeslgn 97/5338 Card revision = Description • For a table to be in first normal for1n, its columns must not contain repeating values. Instead, each column must contain a single, scalar value. In addition, the table must not contain repeating columns that represent a set of values. • A table in first normal form often bas repeating valt1es in its rows. This

a single, scalar value. In addition, the table must not contain repeating columns that represent a set of values. • A table in first normal form often bas repeating valt1es in its rows. This can be resolved by applying the second normal form.

How to apply the second normal form normal form, every column in a table that isn't a key column must be dependent on the entire primary key. This form only applies to tables that have composite primary keys, which is often the case when you start with data that is completely unnormalized. The table at the top of this figure, for example, shows the invoice data in first normal form after key columns have been added. In this case, the primary key consists of the invoice_id and invoice_sequence columns. The invoice_sequence column is needed to u

## Examples
### Example 1: SELECT Example
```sql
select the ftle for the model. How to create a new EER model If you're designing a new database from scratch, you can create a model that doesn't contain any tables. to do that, you can click the® icon to the right of the Models heading. Then, you can add tables to the model as shown in the next figure. If you 're

any tables. to do that, you can click the® icon to the right of the Models heading. Then, you can add tables to the model as shown in the next figure. If you 're redesigning an existing database, you can start by creating a model from that database. to do that, you can click the 0 icon to the right of the Models heading and select the ''Create EER Model from Database'' item. Then, you can use the resulting dialog boxes to connect to the server and select a database. When you do, MySQL Workbench creates a model and a diagran1 that includes all of the tables and columns of the selected database. If you don't have access to the database but you have access to the script that creates it, you can create a model from that script. to do that, you can click the 0 icon to the right of the Models heading and select the ''Create EER Model from Script'' iten1. Then, you can use the resulting dialog box to select the script file.

Chapter 10 Hovv to design a database The Models tab of the MySQL Workbench Home page ■ MySQl. Workbench D X File Edit View Database T DOis Scripting Help Models 0@ 0 om ap c::I C;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
select the File➔Open Model item. Then, use the resulting dialog box to select the file for the model. • to create a new EER model that's blank, click the ® icon to the right of the Models heading, or select the File➔ New

dialog box to select the file for the model. • to create a new EER model that's blank, click the ® icon to the right of the Models heading, or select the File➔ New Model item. • to create an EER model from an existing database, click the 0 icon to the right of the Models heading, select the ''Create EER Model fi om Database'' item, and use the resulting dialog boxes to connect to the server and select the database. • to create an EER model from a SQL creation script, click the 0 icon to the right of the Models heading, select the ''Create EER Model from Script'' item, and use the resulting dialog box to select the script file. • to remove an existing model from the list of recently used models, right-click on the model and select the ''Remove Model File from List'' item. How to create and open an EER model

How to work with an EER model the MySQL Model tab for the AP database. From this tab, you can work with the tables of the database. to edit one of these tables, you can double-click on it. When you do, MySQL Workbench displays a tab for the table at the bottom of the window. Within this tab are additional tabs that you can use to modify the columns, indexes, and foreign keys for the table. For example, this figure shows the Columns tab for the Vendors table. From this tab, you can modify the names, data types, and other attributes of the columns. You can also add a new column by entering the information for the column at the bottom of the table. And, you can modify the name of the table. If you want to add a table to the model, you can double-click on the Add Table icon. Then, you can edit the table to set its name, columns, indexes, and foreign keys. You'll learn more about how to do that in the next chapter. Or, if

icon. Then, you can edit the table to set its name, columns, indexes, and foreign keys. You'll learn more about how to do that in the next chapter. Or, if you want to remove a table from the model, you can right-click on the table and select the Delete i tern. Since you typically begin designing a database by creating the tables of the database, this figt1re focL1ses on how to work with tables. However, you can use similar skills to work with other database objects that are stored in the model, such as views and stored programs. Since it's usually easier to work with a visual representation of the model, you can open a diagram that corresponds with the model. As yot1'll see in the next figure, this can make it easier to see the relationships between tables. When you work with a diagram, some changes that you make affect the corresponding model. As a result, you can think of working with a diagram as a more visual way of working with the model. When you create or open

changes that you make affect the corresponding model. As a result, you can think of working with a diagram as a more visual way of working with the model. When you create or open a model, the diagram for the model is displayed by default. If you close the tab for the diagram, however, you can open it again by double-clicking on the name of the diagram. In this figure, for example, the model for the AP database contains a diagram named EER Diagram. For small databases, you may only need a single diagram like this. However, for larger databases, you may need to create multiple diagrams that provide ways to view different parts of the database. to create a new diagram for the model, you can double-click the Add Diagram icon. Then, the diagram is given a name such as EER Diagram 1, EER Diagram 2, and so on. When you 're done creating your model, you can create a MySQL database creation script from the diagram. to do that, you can select the File➔ Export➔ Forward Engineer SQL

and so on. When you 're done creating your model, you can create a MySQL database creation script from the diagram. to do that, you can select the File➔ Export➔ Forward Engineer SQL CREATE Script item. Then, you can implement your design by using MySQL Workbench to run the script. This creates the database that corresponds to the model.

Chapter 10 Hovv to design a database The EER model for the AP database ■ MySQl Workbench D X MySOL Model" (ap.ln'Nb) "' EER Dai,am >< Rle Edit Vtf!Nf Arrange Model Database T cols Scripting Help IJ□ Descnllbot' Ea,toi vendcn: MySQL Table V Mooel C>,et111eA ¢ --' Add Diagram EER CXagam Y Physical Schemas Tables,...-,, o Add Table ~ tenns Views, " tems general_ledget _acco.•. J lnVOICe _archive - vendor_cantac:ts::J vendm ••• =::: = + - G lnVOiee_lne_ilef!\$:J Invoices V - ----------------- Descnpbon!;
```
Example SELECT statement from textbook.

### Example 3: UPDATE Example
```sql
update the table periodically to reset the value of the derived column. Because normalization eliminates the possibility of data redundancy errors and optimizes the use of storage, you should carefully consider when and how to denormalize a data structure. In general, you should denormalize only when the increased efficiency outweighs the potential for redundancy errors and storage problems. of course, your decision to

consider when and how to denormalize a data structure. In general, you should denormalize only when the increased efficiency outweighs the potential for redundancy errors and storage problems. of course, your decision to denor1nalize should also be based on your knowledge of the real-world environment in which the system will be used. If you've carefully analyzed the real-world environment as outlined in this chapter, you'll have a good basis for making that decision.

Chapter 10 Hovv to design a database The accounts payable system in fifth normal form vendors vendor id - vendor name - vendor address - vendor_zip_code,..... vendor area code id ' - - vendor_phone vendor contact first name - - - vendor contact last name - - - default terms id - - default account no - - zip_codes zip_codes city state area codes - area code id - - area code - When to denormalize • • 1nvo1ces invoice line items - - invoice_id ••---- ◄ invoice_id vendor id - invoice number - invoice date - invoice total - payment_ tota I credit total -......--4 terms id - invoice due date - - payment_ date terms terms id - terms_description terms_due_days.. 1nvo1ce_sequence ~~ account no - line_item_qty line _item_ unit_price..... line_item_description_id line_item_descriptions line_item_description_id line_ item_ description general_ledger_accounts account no - account_ description • When a column from a joined table is used repeatedly in search criteria, you should consider moving that column to the primary key table if it will eliminate the need for a join. • If a

When a column from a joined table is used repeatedly in search criteria, you should consider moving that column to the primary key table if it will eliminate the need for a join. • If a table is updated infrequently, you should consider denormalizing it to improve efficiency. Because the data remains relatively constant, you don't have to worry about data redundancy errors once the initial data is entered and verified. • Incl11de columns with derived values when those values are used frequently in search conditions. If yo11 do that, you need to be sure that the column value is always synchronized with the value of the columns it's derived from. Description • Data structures that are normalized to the fourth normal form and beyond typically require more joins than tables normalized to the third normal fo1m and can therefore be less efficient. • MySQL statements that work with tables that are normalized to the fourth normal for111 and beyond are typically more difficult to code and debug. • Most designers denormalize data structures to some extent, usually to the

work with tables that are normalized to the fourth normal for111 and beyond are typically more difficult to code and debug. • Most designers denormalize data structures to some extent, usually to the third normal form. • Denormalization can result in larger tables, redundant data, and reduced performance. • Only denormalize when necessary. It is better to adhere to the normal fonns unless it is clear that perfor111ance will be improved by deno1m alizing. When and how to denormalize a data structure

How to use MySQL Workbench for database design When you're ready to create a database diagram, it usually makes sense to use a tool that's specifically designed for that purpose. Fortunately, dozens of tools for designing databases are available. This topic introduces you to one of them: MySQL Workbench. MySQL Workbench makes it easy to create one or more database diagrams from an enhanced entity-relationship model (EER model). This model extends the original entity-relationship model (ER mode[). In addition, you can create a visual representation of an EER model by creating one or more EER diagrams from that model. When working with MySQL Workbench, you can generate an EER model from an existing MySQL database or SQL creation script. Conversely, you can generate a SQL creation script from an EER model. This makes it easy to implement your design when you're done with it. How to open an existing EER model When you start MySQL Workbench, it displays the Welcome tab of the Home page. to work with EER models, you can display the Models tab that's shown in created

an existing EER model When you start MySQL Workbench, it displays the Welcome tab of the Home page. to work with EER models, you can display the Models tab that's shown in created with MySQL Workbench. If you opened the model recently, it should be displayed in the list of recently opened models. In this figure, for example, two models are shown in this list. One is named OM, and the other is named AP. Then, you can open the model by clicking on it. If the model you want to open isn't displayed in this list, you can click the @ icon to the right of the Models heading and use the resulting dialog box to select the ftle for the model. How to create a new EER model If you're designing a new database from scratch, you can create a model that doesn't contain any tables. to do that, you can click the® icon to the right of the Models heading. Then, you can add tables to the model as shown in the next figure. If you 're

any tables. to do that, you can click the® icon to the right of the Models heading. Then, you can add tables to the model as shown in the next figure. If you 're redesigning an existing database, you can start by creating a model from that database. to do that, you can click the 0 icon to the right of the Models heading and select the ''Create EER Model from Database'' item. Then, you can use the resulting dialog boxes to connect to the server and select a database. When you do, MySQL Workbench creates a model and a diagran1 that includes all of the tables and columns of the selected database. If you don't have access to the database but you have access to the script that creates it, you can create a model from that script. to do that, you can click the 0 icon to the right of the Models heading and select the ''Create EER Model from Script'' iten1. Then, you can use the resulting dialog box to select the script file.

Chapter 10 Hovv to design a database The Models tab of the MySQL Workbench Home page ■ MySQl. Workbench D X File Edit View Database T DOis Scripting Help Models 0@ 0 om ap c::I C;
```
Example UPDATE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: murachs-mysql-3rd-edition, Pages 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357*
