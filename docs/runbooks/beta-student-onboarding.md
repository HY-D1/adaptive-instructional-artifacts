# Beta Student Onboarding Runbook

**Version**: 1.0.0
**Audience**: First-time student users
**Prerequisites**: Instructor-provided class code
**Estimated Time**: 10 minutes for first session

---

## Before You Start

### What You'll Need

- A computer with a modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- **Class code** from your instructor
- Basic familiarity with SQL (helpful but not required)

### What to Expect

SQL-Adapt is an adaptive learning system that helps you learn SQL through practice. It will:
- Give you SQL problems to solve
- Provide hints when you're stuck (3 levels of help)
- Automatically save helpful explanations to your personal textbook
- Remember your progress across sessions

---

## Step 1: Sign Up (2 minutes)

### 1.1 Open the Application

1. Go to: **https://adaptive-instructional-artifacts.vercel.app**
2. You should see the SQL-Adapt welcome page

### 1.2 Create Your Account

1. Enter your **full name** in the username field
2. Select **"I am a Student"**
3. Click **"Get Started"**

### 1.3 Enter Class Code

When prompted, enter the class code provided by your instructor:
- Type the code exactly as given (case-sensitive)
- Click **"Join Class"**

**If you see "Invalid class code":**
- Double-check the spelling with your instructor
- Make sure there are no extra spaces

---

## Step 2: Your First Practice Problem (5 minutes)

### 2.1 Practice Page Overview

After signup, you'll be taken to the Practice page. Here's what you see:

| Section | Location | What It Does |
|---------|----------|--------------|
| **Problem Panel** | Top left | Shows the SQL problem to solve |
| **SQL Editor** | Center | Where you type your query |
| **Run Button** | Below editor | Executes your SQL |
| **Hint Button** | Right side | Get help when stuck |

### 2.2 Try Your First Query

1. Read the problem description carefully
2. Type a SQL query in the editor
3. Click **"Run Query"**

**Example Problem**: "Find all employees with salary greater than 70000"

**Try this**:
```sql
SELECT * FROM employees
WHERE salary > 70000;
```

### 2.3 When You Make Mistakes (Expected!)

Don't worry about getting it wrong - this is how you learn!

1. If your query has an error, you'll see an error message
2. The **"Need help?"** button will appear
3. Click it to get progressive hints

---

## Step 3: Using the Hint System (3 minutes)

### 3.1 Three Levels of Help

The hint system gives you just enough help to progress:

| Click | What You Get | Example |
|-------|--------------|---------|
| **1st click** | Micro-hint | "Check your WHERE clause" |
| **2nd click** | Strategic hint | "The WHERE clause needs proper formatting" |
| **3rd click** | Detailed help | Near-complete solution guidance |

### 3.2 Getting a Hint

1. Run an incorrect query (on purpose to learn!)
2. Click **"Need help?"**
3. Read the hint carefully
4. Try to fix your query based on the hint
5. Run the query again

### 3.3 Save Useful Explanations

After viewing a helpful hint:
1. Look for the **"Save to Notes"** button
2. Click it to add the explanation to your textbook
3. The system may automatically save helpful hints

---

## Step 4: Your Personal Textbook (2 minutes)

### 4.1 View Your Textbook

1. Click **"My Textbook"** in the top navigation
2. You'll see notes from your practice session

### 4.2 What's in Your Textbook

Each note contains:
- **Concept**: The SQL concept you learned (e.g., "WHERE clause")
- **Explanation**: The helpful explanation from the hint
- **Source**: Which problem it came from

### 4.3 Why This Matters

Your textbook automatically builds a personalized study guide from every struggle. Come back to review before exams!

---

## Step 5: Continuing Your Learning

### During Your Session

- Work through problems at your own pace
- Use hints when stuck (that's what they're for!)
- Save helpful explanations to your textbook
- Try problems multiple times - practice makes progress

### Between Sessions

- Your progress is automatically saved
- Log in again with the same name to continue
- Review your textbook before starting new problems

### Navigation Tips

| To Do This | Click This |
|------------|------------|
| Start practicing | "Practice" in the header |
| Review notes | "My Textbook" in the header |
| Get help on a problem | "Need help?" button (appears after error) |
| Run your query | "Run Query" button |
| Save an explanation | "Save to Notes" button |

---

## Common Issues and Solutions

### "Class code not working"
- Check with your instructor for the correct code
- Make sure you're typing it exactly (no extra spaces)

### "Hints not appearing"
- You need to run a query with an error first
- Try entering an intentionally wrong query like `SELECT * FROM nonexistent`

### "My textbook is empty"
- You need to view hints first
- The system saves explanations automatically after you see them
- Try working through a problem and requesting hints

### "Query won't run"
- Check for syntax errors (missing semicolons, typos)
- Look at the error message carefully
- Try the hint system for guidance

### "Lost my progress"
- Make sure you're using the same name to log in
- Progress is tied to your username
- Contact your instructor if issues persist

---

## Beta Participation Guidelines

### What We're Testing

This is a beta version - you're helping us improve! We're watching for:
- How well the hints help you learn
- Whether the textbook saves correctly
- Any errors or confusing parts
- How the system feels overall

### Your Feedback Matters

After your session, your instructor may ask:
- Were the hints helpful?
- Did anything confuse you?
- Did your textbook save correctly?
- Would you use this for learning SQL?

### Beta Limitations

Some features are disabled for the beta:
- AI-generated explanations (using pre-written hints instead)
- PDF search functionality
- Advanced instructor features

---

## Quick Reference Card

```
SQL-ADAPT QUICK START

1. Go to: adaptive-instructional-artifacts.vercel.app
2. Enter your name
3. Select "I am a Student"
4. Enter class code from instructor
5. Start practicing!

NEED HELP?
- Run a query with an error
- Click "Need help?"
- Read the hint
- Try again!

VIEW YOUR NOTES
- Click "My Textbook"
- Review saved explanations
- Study for your exam!
```

---

## Need More Help?

During your supervised beta session:
1. Ask your instructor
2. Check the hint system for guidance
3. Try a different problem and come back

---

*Last Updated: 2026-03-30*
*For Beta Version: v1.0.0-beta*
