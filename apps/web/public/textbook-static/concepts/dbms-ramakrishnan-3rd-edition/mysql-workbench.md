# Using MySQL Workbench

## Definition
How to use MySQL Workbench for database development and administration

## Explanation
IntToduct'ion to Database Design 27. Database Design Tools: Design tools are available from RDBwiS ven- dors as well as third-party vendors. For example! see the following link for details on design and analysis tools from Sybase: http://www.sybase.com/products/application_tools The following provides details on Oracle's tools: http://www.oracle.com/tools Several methodologies have been proposed for organizing and presenting the information gathered in this step, and some automated tools have been developed to support this process. 2. Conceptual Database Design: The information gathered in the require- ments analysis step is used to develop a high-level description of the data to be stored in the database, along with the constraints known to hold over this data. This step is often carried out using the ER model and is dis- cussed in the rest of this chapter. The ER model is one of several high-level, or semantic, data models used in database design. The goal is to create a simple description of the data that closely matches how users and devel- opers think of the data (and the people and processes to be represented in the data).

create a simple description of the data that closely matches how users and devel- opers think of the data (and the people and processes to be represented in the data). This facilitates discussion among all the people involved in the design process, even those who have no technical background. At the same time, the initial design must be sufficiently precise to enable a straightfor- ward translation into a data model supported by a commercial database system (which, in practice, means the relational model). 3. Logical Database Design: We must choose a DBMS to implement our databctse design, and convert the conceptual database design into a database schema in the data model of the chosen DBMS. We will consider only relational DBMSs, and therefore, the task in the logical design step is to convert an ER schema into a relational database schema

## Examples
### Example 1: DELETE Example
```sql
delete all the relevant policy and dependent information from the database.

36 CHAPTETh 2 Figure 2.10 Manages and Works_In We might choose to identify a dependent by name alone in this situation, since it is reasonable to expect that the dependents of a given employee have different names. Thus the attributes of the Dependents entity set might be pname and age. The attribute pname does not identify a dependent uniquely. Recall that the key for Employees is ssn;
```
Example DELETE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78*
