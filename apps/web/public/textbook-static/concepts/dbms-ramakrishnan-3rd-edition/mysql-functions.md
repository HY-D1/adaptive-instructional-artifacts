# MySQL Functions

## Definition
String, numeric, date/time, and conversion functions

## Explanation
InteT1Iet AIJplications import java.io.*; import javCLx.servlet.*; import javax.servlet.http.*; pUblic class ServletTemplate extends HttpServlet { public void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException { PrintWriter out = response.getWriter(); / / Use 'out' to send content to browser out.println("Hello World"); } } Figure 7.18 Servlet Template 255 @ to all Java APls, including JDBC. All servlets must implement the Servlet interface. In most cases, servlets extend the specific HttpServlet class for servers that communicate with clients via HTTP. The HttpServlet class pro- vides methods such as doGet and doPost to receive arguments from HTML forms, and it sends its output back to the elient via HTTP. Servlets that communicate through other protocols (such as ftp) need to extend the class GenericServlet. Servlets are compiled Java classes executed and maintained by a servlet con- tainer. The servlet container manages the lifespan of individual servlets by creating and destroying them. Although servlets can respond to any type of re- quest, they are commonly used to extend the applications hosted by webservers. For such applications, there is a useful library of HTTP-specific servlet classes.

respond to any type of re- quest, they are commonly used to extend the applications hosted by webservers. For such applications, there is a useful library of HTTP-specific servlet classes. Servlets usually handle requests from HTML forms and maintain state between the client and the server. We discuss how to maintain state in Section 7.7.5. A template of a generic servlet structure is shown in Figure 7.18. This simple servlet just outputs the two words "Hello World," but it shows the general structure of a full-fledged servlet. The request object is used to read HTML form data. The response object is used to specify the HTTP response status code and headers of the HTTP response. The object out is used to compose the content

## Examples
### Example 1: SELECT Example
```sql
select books to buy do not want to re-enter their cllstomer identification numbers. Session management has to extend to the whole process of selecting books, adding them to a shopping cart, possibly removing books from the cart,

to re-enter their cllstomer identification numbers. Session management has to extend to the whole process of selecting books, adding them to a shopping cart, possibly removing books from the cart, and checking out and paying for the books.

262 CHAPTERi 7 DBDudes then considers whether webpages for books should be static or dy- namic. If there is a static webpage for each book, then we need an extra database field in the Books relation that points to the location of the file. Even though this enables special page designs for different books, it is a very labor-intensive solution. DBDudes convinces B&N to dynamically assemble the webpage for a book from a standard template instantiated with informa- tion about the book in the Books relation. Thus, DBDudes do not use static HTML pages, such as the one shown in Figure 7.1, to display the inventory. DBDudes considers the use of XML a'S a data exchange format between the database server and the middle tier, or the middle tier and the client tier. Representation of the data in XML at the middle tier as shown in Figures 7.2 and 7.3 would allow easier integration of other data sources in the future, but B&N decides that they do not anticipate a need for such integration, and so DBDudes decide not to

would allow easier integration of other data sources in the future, but B&N decides that they do not anticipate a need for such integration, and so DBDudes decide not to use XML data exchange at this time. DBDudes designs the application logic as follows. They think that there will be four different webpages: • index. j sp: The home page of Barns and Nobble. This is the main entry point for the shop. This page has search text fields and buttons that allow the user to search by author name, ISBN, or title of the book. There is also a link to the page that shows the shopping cart, cart. j sp. • login. j sp: Allows registered users to log in. Here DBDudes use an HTML form similar to the one displayed in Figure 7.11. At the middle tier, they use a code fragment similar to the piece shown in Figure 7.19 and JavaServerPages as shown in Figure 7.20. • search. j sp: Lists all books in the database that match the search condi- tion specified by the user.

in Figure 7.19 and JavaServerPages as shown in Figure 7.20. • search. j sp: Lists all books in the database that match the search condi- tion specified by the user. The user can add listed items to the shopping basket;
```
Example SELECT statement from textbook.

### Example 2: UPDATE Example
```sql
update the state, a potential performance bottleneck. An alternative is to store state in main memory at the middle tier. The drawbacks are that this information is volatile and that it might take up a lot of main memory. We can also store state in local files at the middle tier, &s a compromise between the first two approaches. A rule of thumb is to use state

main memory. We can also store state in local files at the middle tier, &s a compromise between the first two approaches. A rule of thumb is to use state maintenance at the middle tier or database tier only for data that needs to persist over many different user sessions. Examples of such data are past customer orders, click-stream data recording a user's movement through the website, or other permanent choices that a user makes, such as decisions about personalized site layout, types of messages the user is willing to receive, and so on. As these examples illustrate, state information is often centered around users who interact with the website. Maintaining State at the Presentation Tier: Cookies Another possibility is to store state at the presentation tier and pass it to the middle tier with every HTTP request. We essentially work around around the statelessness of the HTTP protocol by sending additional information with every request. Such information is called a cookie.

260 CHAPTE~ 7 / / no 88L required / / one month lifetime A cookie is a collection of (name, val'Ue)~~pairs that can be manipulated at the presentation and middle tiers. Cookies are ea..''!Y to use in Java servlets and Java8erver Pages and provide a simple way to make non-essential data persistent at the client. They survive several client sessions because they persist in the browser cache even after the browser is closed. One disadvantage of cookies is that they are often perceived as as being invasive, and many users disable cookies in their Web browser;
```
Example UPDATE statement from textbook.

### Example 3: UPDATE Example
```sql
update the shop-

Inter'net Applications ping basket with the altered quantities from the text boxes, and a third button to place the order, which directs the user to the page confirm.jsp. II coni irm. j sp: Lists the complete order so far and allows the user to enter his or her contact information or customer ID. There are two buttons on this page: one button to cancel the order and a second button to submit the final order. The cancel button ernpties the shopping ba.'3ket and returns the user to the home page. The submit button updates the database with the new order, empties the shopping basket, and returns the user to the home page. DBDudes also considers the use of JavaScript at the presentation tier to check user input before it is sent to the middle tier. For example, in the page login. j sp, DBDudes is likely to write JavaScript code similar to that shown in Figure 7.12. This leaves DBDudes with one final decision: how to connect applications to the DBMS. They consider the two main alternatives presented in Section

similar to that shown in Figure 7.12. This leaves DBDudes with one final decision: how to connect applications to the DBMS. They consider the two main alternatives presented in Section 7.7: CGI scripts versus using an application server infrastructure. If they use CGI scripts, they would have to encode session management logic-not an easy task. If they use an application server, they can make use of all the functionality that the application server provides. Therefore, they recommend that B&N implement server-side processing using an application server. B&N accepts the decision to use an application server, but decides that no code should be specific to any particular application server, since B&N does not want to lock itself into one vendor. DBDudes agrees proceeds to build the following pieces: III DBDudes designs top level pages that allow customers to navigate the website as well as various search forms and result presentations. II Assuming that DBDudes selects a Java-ba..sed application server, they have to write Java servlets to process form-generated requests. Potentially, they could reuse existing (possibly commercially available) JavaBeans. They can use

Assuming that DBDudes selects a Java-ba..sed application server, they have to write Java servlets to process form-generated requests. Potentially, they could reuse existing (possibly commercially available) JavaBeans. They can use JDBC a." a databa.':ie interface;
```
Example UPDATE statement from textbook.

## Common Mistakes
### No common mistakes listed
No specific mistakes documented in textbook.

---
*Source: dbms-ramakrishnan-3rd-edition, Pages 290, 291, 292, 293, 294, 295, 296, 297, 298*
