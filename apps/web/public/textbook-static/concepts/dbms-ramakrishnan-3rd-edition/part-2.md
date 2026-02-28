# part 2

## Definition

Argument passing is the process of transferring data from one part of a program to another, typically between functions or methods.

## Explanation

Argument passing is crucial because it allows functions to perform tasks based on input provided by the user or other parts of the program. This makes code more modular and reusable. Here’s how it works:
1. **Problem**: Functions often need data to operate on, but this data might not be available within the function itself.
2. **How It Works**: When you call a function, you can pass values (arguments) to it. The function then uses these arguments to perform its operations.
3. **When to Use It**: Whenever a function needs information from outside to complete its task, use argument passing.
4. **Key Things to Remember**:
- Arguments are passed by value, meaning the function receives a copy of the data, not the original data itself.
- The number and type of arguments must match what the function expects.
- Functions can return values back to the caller using the `return` statement.

## Examples

### Basic Usage

```sql
-- Define a function that takes an author's name as an argument CREATE FUNCTION get_author_info(authorName VARCHAR(100)) RETURNS VARCHAR(255) AS $$ BEGIN RETURN 'The author is: ' || authorName; END; $$;
```

This example defines a function `get_author_info` that takes an author's name as an argument and returns a string with the author's name.

### Practical Example

```sql
-- Call the function with a specific author's name
SELECT get_author_info('J.K. Rowling');
```

This practical example shows how to call the `get_author_info` function and pass 'J.K. Rowling' as an argument.

## Common Mistakes

### Incorrect number of arguments

**Incorrect:**

```sql
-- Calling a function with incorrect number of arguments
SELECT get_author_info('J.K. Rowling', 'Harry Potter');
```

**Correct:**

```sql
-- Correct call with the right number of arguments
SELECT get_author_info('J.K. Rowling');
```

**Why this happens:** This mistake occurs when you pass too many or too few arguments to a function. Always ensure that the number and type of arguments match what the function expects.

---

## Practice

**Question:** Create a function that takes two numbers as arguments and returns their sum.

**Solution:** -- Define the function
CREATE FUNCTION add_numbers(num1 INT, num2 INT)
RETURNS INT
AS $$
BEGIN
RETURN num1 + num2;
END;
$$;
-- Call the function with specific numbers
SELECT add_numbers(5, 3);


---

*Source: Database Management Systems, 3rd Edition by Ramakrishnan & Gehrke*