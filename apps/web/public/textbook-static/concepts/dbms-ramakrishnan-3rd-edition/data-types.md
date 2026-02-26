# MySQL Data Types

## Definition
Understanding numeric, string, date/time, and large object data types

## Explanation
Internet Applications <H1>Barns and Nobble Internet Bookstore</H1> Our inventory: <H3>Science</H3> <B>The Character of Physical Law</B> 225 The HTTP response message has three parts: a status line, several header lines, and the body of the message (which contains the actual object that the client requested). The status line has three fields (analogous to the request line of the HTTP request message): the HTTP version (HTTP/1.1), a status code (200), and an associated server message (OK). Common status codes and associated messages are: • 200 OK: The request succeeded and the object is contained in the body of the response message"; • 400 Bad Request: A generic error code indicating that the request could not be fulfilled by the server. • 404 Not Found: The requested object does not exist on the server. • 505 HTTP Version Not Supported: The HTTP protocol version that the client uses is not supported by the server. (Recall that the HTTP protocol version sent in the client's request.) Our example has three header lines: The date header line indicates the time and date when the HTTP

server. (Recall that the HTTP protocol version sent in the client's request.) Our example has three header lines: The date header line indicates the time and date when the HTTP response was created (not that this is not the object creation time). The Last-Modified header line indicates when the object was created. The Content-Length header line indicates the number of bytes in the object being sent after the last header line. The Content-Type header line indicates that the object in the entity body is HTML text. The client (the Web browser) receives the response message, extracts the HTML file, parses it, and displays it. In doing so, it might find additional URIs in the file, and it then uses the HTTP protocol to retrieve each of these resources, establishing a new connection each time. One important issue is that the HTTP protocol is a stateless protocol. Every message----from, the client

## Examples
### Example 1: INSERT Example
```sql
insert arbitrary Unicode characters into the text. Unicode is a standard for character representations, similar to ASCII. For example, we can display the Japanese Hiragana character a using the entity reference &#x3042. • Comments: We can insert comments anywhere in an XML document. Comments start with <! - and end with

display the Japanese Hiragana character a using the entity reference &#x3042. • Comments: We can insert comments anywhere in an XML document. Comments start with <! - and end with ->. Comments can contain arbi- trary text except the string --.

Internet Applications • Document Type Declarations (DTDs): In XML, we can define our own markup language. A DTD is a set of rules that allows us to specify our own set of elements, attributes, and entities. Thus, a DTD is basically a grammar that indicates what tags are allowed, in what order they can appear, and how they can be nested. We discuss DTDs in detail in the next section. We call an XML document well-formed if it has no associated DTD but follows these structural guidelines: • The document starts with an XML declaration. An example of an XML declaration is the first line of the XML document shown in Figure 7.2. • A root element contains all the other elements. In our example, the root element is the element BOOKLIST. • All elements must be properly nested. This requirement states that start and end tags of an element must appear within the same enclosing element. 7.4.2 XML DTDs A DTD is a set of rules that allows us to specify our own set of elements, attributes, and entities.

must appear within the same enclosing element. 7.4.2 XML DTDs A DTD is a set of rules that allows us to specify our own set of elements, attributes, and entities. A DTD specifies which elements we can use and con- straints on these elements, for example, how elements can be nested and where elements can appear in the document. We call a document valid if a DTD is associated with it and the document is structured according to the rules set by the DTD. In the remainder of this section, we use the example DTD shown in Figure 7.3 to illustrate how to construct DTDs. <!DOCTYPE BOOKLIST [ <! ELEMENT BOOKLIST (BOOK)*> <! ELEMENT BOOK (AUTHOR,TITLE,PUBLISHED?» <!ELEMENT AUTHOR (FIRSTNAME,LASTNAME» <! ELEMENT FIRSTNAME (#PCDATA» <! ELEMENT LASTNAME (#PCDATA» <! ELEMENT TITLE (#PCDATA» <! ELEMENT PUBLISHED (#PCDATA» <! ATTLIST BOOK GENRE (ScienceIFiction) #REQUIRED> <!ATTLIST BOOK FORMAT (PaperbackIHardcover) "Paperback"> ]> Figure 7.3 Bookstore XML DTD

232 CHAPTER .;
```
Example INSERT statement from textbook.

## Common Mistakes
### Mistake 1: Common Pitfall
an end tag. 11II The special symbol ANY, which indicates that any content is permitted. This content should be avoided whenever possible ::lince it disables all check- ing of the document structure inside the element.

**Why this happens:** This issue is documented in the textbook as a common pitfall.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270*
