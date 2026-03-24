---
id: views
title: SQL Views
definition: Virtual tables based on the result of a query - stored SELECT statements
difficulty: intermediate
estimatedReadTime: 5
pageReferences: [295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311]
chunkIds:
  - dbms-ramakrishnan-3rd-edition:p295:c1
  - dbms-ramakrishnan-3rd-edition:p295:c2
  - dbms-ramakrishnan-3rd-edition:p295:c3
  - dbms-ramakrishnan-3rd-edition:p296:c1
  - dbms-ramakrishnan-3rd-edition:p296:c2
  - dbms-ramakrishnan-3rd-edition:p296:c3
  - dbms-ramakrishnan-3rd-edition:p297:c1
  - dbms-ramakrishnan-3rd-edition:p297:c2
  - dbms-ramakrishnan-3rd-edition:p297:c3
  - dbms-ramakrishnan-3rd-edition:p297:c4
  - dbms-ramakrishnan-3rd-edition:p298:c1
  - dbms-ramakrishnan-3rd-edition:p298:c2
  - dbms-ramakrishnan-3rd-edition:p298:c3
  - dbms-ramakrishnan-3rd-edition:p299:c1
  - dbms-ramakrishnan-3rd-edition:p299:c2
  - dbms-ramakrishnan-3rd-edition:p299:c3
  - dbms-ramakrishnan-3rd-edition:p300:c1
  - dbms-ramakrishnan-3rd-edition:p300:c2
  - dbms-ramakrishnan-3rd-edition:p300:c3
  - dbms-ramakrishnan-3rd-edition:p301:c1
  - dbms-ramakrishnan-3rd-edition:p301:c2
  - dbms-ramakrishnan-3rd-edition:p301:c3
  - dbms-ramakrishnan-3rd-edition:p301:c4
  - dbms-ramakrishnan-3rd-edition:p302:c1
  - dbms-ramakrishnan-3rd-edition:p302:c2
  - dbms-ramakrishnan-3rd-edition:p302:c3
  - dbms-ramakrishnan-3rd-edition:p302:c4
  - dbms-ramakrishnan-3rd-edition:p303:c1
  - dbms-ramakrishnan-3rd-edition:p303:c2
  - dbms-ramakrishnan-3rd-edition:p303:c3
  - dbms-ramakrishnan-3rd-edition:p304:c1
  - dbms-ramakrishnan-3rd-edition:p304:c2
  - dbms-ramakrishnan-3rd-edition:p304:c3
  - dbms-ramakrishnan-3rd-edition:p305:c1
  - dbms-ramakrishnan-3rd-edition:p305:c2
  - dbms-ramakrishnan-3rd-edition:p305:c3
  - dbms-ramakrishnan-3rd-edition:p306:c1
  - dbms-ramakrishnan-3rd-edition:p308:c1
  - dbms-ramakrishnan-3rd-edition:p308:c2
  - dbms-ramakrishnan-3rd-edition:p309:c1
  - dbms-ramakrishnan-3rd-edition:p309:c2
  - dbms-ramakrishnan-3rd-edition:p309:c3
  - dbms-ramakrishnan-3rd-edition:p310:c1
  - dbms-ramakrishnan-3rd-edition:p310:c2
  - dbms-ramakrishnan-3rd-edition:p310:c3
  - dbms-ramakrishnan-3rd-edition:p310:c4
  - dbms-ramakrishnan-3rd-edition:p311:c1
  - dbms-ramakrishnan-3rd-edition:p311:c2
  - dbms-ramakrishnan-3rd-edition:p311:c3
relatedConcepts:
tags:
  - sql
  - views
  - virtualization
sourceDocId: dbms-ramakrishnan-3rd-edition
---

# SQL Views

## Definition
Virtual tables based on the result of a query - stored SELECT statements

## Explanation
CHAPTE~ 7 / / no 88L required / / one month lifetime A cookie is a collection of (name, val'Ue)~~pairs that can be manipulated at the presentation and middle tiers. Cookies are ea..''!Y to use in Java servlets and Java8erver Pages and provide a simple way to make non-essential data persistent at the client. They survive several client sessions because they persist in the browser cache even after the browser is closed. One disadvantage of cookies is that they are often perceived as as being invasive, and many users disable cookies in their Web browser; browsers allow users to prevent cookies from being saved on their machines. Another disadvantage is that the data in a cookie is currently limited to 4KB, but for most applications this is not a bad limit. We can use cookies to store information such as the user's shopping basket, login information, and other non-permanent choices made in the current session. Next, we discuss how cookies can be manipulated from servlets at the middle tier. The Servlet Cookie API A cookie is stored. in a small

made in the current session. Next, we discuss how cookies can be manipulated from servlets at the middle tier. The Servlet Cookie API A cookie is stored. in a small text file at the client and. contains (name, val'l1e/- pairs, where both name and value are strings. We create a new cookie through the Java Cookie class in the middle tier application code: Cookie cookie = new Cookie( II username","guest"); cookie.setDomain("www.bookstore.com..); cookie.set8ecure(false); cookie.setMaxAge(60*60*24*7*31); response.addCookie(cookie); Let us look at each part of this code. First, we create a new Cookie object with the specified (name, val'l1e)~~ pair. Then we set attributes of the cookie; we list some of the most common attributes below: III setDomain and getDomain: The domain specifies the website that will receive the cookie. The default value for this attribute is the domain that created the cookie. II setSecure and getSecure: If this

## Examples
### Example 1: SELECT Example
```sql
select books to buy do not want to re-enter their cllstomer identification numbers. Session management has to extend to the whole process of selecting books, adding them to a shopping cart, possibly removing books from

to buy do not want to re-enter their cllstomer identification numbers. Session management has to extend to the whole process of selecting books, adding them to a shopping cart, possibly removing books from the cart, and checking out and paying for the books.

CHAPTERi 7 DBDudes then considers whether webpages for books should be static or dynamic. If there is a static webpage for each book, then we need an extra database field in the Books relation that points to the location of the file. Even though this enables special page designs for different books, it is a very labor-intensive solution. DBDudes convinces B&N to dynamically assemble the webpage for a book from a standard template instantiated with information about the book in the Books relation. Thus, DBDudes do not use static HTML pages, such as the one shown in DBDudes considers the use of XML a'S a data exchange format between the database server and the middle tier, or the middle tier and the client tier. Representation of the data in XML at the middle tier as shown in Figures 7.2 and 7.3 would allow easier integration of other data sources in the future, but B&N decides that they do not anticipate a need for such integration, and so DBDudes decide not to use XML data exchange at this time. DBDudes designs

sources in the future, but B&N decides that they do not anticipate a need for such integration, and so DBDudes decide not to use XML data exchange at this time. DBDudes designs the application logic as follows. They think that there will be four different webpages: • index. j sp: The home page of Barns and Nobble. This is the main entry point for the shop. This page has search text fields and buttons that allow the user to search by author name, ISBN, or title of the book. There is also a link to the page that shows the shopping cart, cart. j sp. • login. j sp: Allows registered users to log in. Here DBDudes use an HTML form similar to the one displayed in At the middle tier, they use a code fragment similar to the piece shown in and JavaServerPages as shown in • search. j sp: Lists all books in the database that match the search condition specified by the user. The user can add listed items to the shopping basket;
```
Example SELECT statement from textbook.

### Example 2: SELECT Example
```sql
select an application server that uses proprietary markup tags, but due to their arrangement with B&N, they are not allowed to use such tags in their code. For completeness, we remark that if DBDudes and B&N had agreed to use CGr scripts, DBDucles would have had the following ta.sks:

CHAPTER~ 7 II Create the top level HTML pages that allow users to navigate the site and vaTious forms that allow users to search the catalog by ISBN, author name, or title. An example page containing a search form is shown in Figure 7.1. In addition to the input forms, DBDudes must develop appropriate presentations for the results. II Develop the logic to track a customer session. Relevant information must be stored either at the server side or in the customer's browser using cookies. II Write the scripts that process user requests. For example, a customer can use a form called 'Search books by title' to type in a title and search for books with that title. The CGI interface communicates with a script that processes the request. An example of such a script written in Perl using the DBI library for data access is shown in Our discussion thus far covers only the customer interface, the part of the website that is exposed to B&N's customers. DBDudes also needs to add applications that allow the employees and the shop

Our discussion thus far covers only the customer interface, the part of the website that is exposed to B&N's customers. DBDudes also needs to add applications that allow the employees and the shop owner to query and access the database and to generate summary reports of business activities. Complete files for the case study can be found on the webpage for this book. 7.9 REVIEW QUESTIONS Answers to the review questions can be found in the listed sections. II What are URIs and URLs? (Section 7.2.1) II How does the HTTP protocol work? What is a stateless protocol? (Section 7.2.2) II Explain the main concepts of HTML. Why is it used only for data presentation and not data exchange? (Section 7.3) II What are some shortc.ornings of HTML, and how does XML address them? (Section 7.4) II What are the main components of an XML document? (Section 7.4.1) II Why do we have XML DTDs? What is a well-formed XML document? What is a valid XML document? Give an example of an XML document that is valid but not well-formed,

7.4.1) II Why do we have XML DTDs? What is a well-formed XML document? What is a valid XML document? Give an example of an XML document that is valid but not well-formed, and vice versa. (Section 7.4.2) II 'What is the role of domain-specific DTDs? (Section 7.4.3) II \Vhat is a three-tier architecture? 'What advantages does it offer over singletier and two-tier architectures? Give a short overview of the functionality at each of the three tiers. (Section 7.5)

Internet Apphcat-ions 2&5 • Explain hmv three-tier architectures address each of the following issues of databa.<;
```
Example SELECT statement from textbook.

### Example 3: INSERT Example
```sql
Insert the tuple (i, "AAA", "AAA Author", 5.99) i=i+l Insert the tuple (i, "BBB", "BBB Author", 5.99) i = i + 1 Insert the tuple (i, "CCC", "CCC Author", 5.99) i=i+1 Insert the tuple (i, "DDD", "DDD Author", 5.99) 1=i+l Insert the tuple (i, "EEE", "EEE Author", 5.99) Placeholder Technique: The simplest approach to top N queries is to store a placeholder for the first and last result tuples, and then perform the same query. When the new query results are returned, you can iterate to the placeholders and return the previous or

a placeholder for the first and last result tuples, and then perform the same query. When the new query results are returned, you can iterate to the placeholders and return the previous or next 20 results.

I Tuples Shown Lower Placeholder Previous Set Upper Placeholder Next Set I 1-20 None "- 21-40 21-40 1-20 41-60 41-60 21-40 61-80 Write a webpage in JSP that displays the contents of the Books table, sorted by the Title and BookId, and showing the results 20 at a time. There should be a link (where appropriate) to get the previous 20 results or the next 20 results. to do this, you can encode the placeholders in the Previous or Next Links as follows. Assume that you are displaying records 21-40. Then the previous link is display. j sp?lower=21 and the next link is display. j sp?upper=40. You should not display a previous link when there are no previous results;
```
Example INSERT statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311*
