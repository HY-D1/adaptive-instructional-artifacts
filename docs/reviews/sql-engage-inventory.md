# SQL-Engage Review

## What data exists

### Problem

- Source file(s): `sql_engage_dataset.csv`, `data_summary.ipynb`
- Fields per problem (exact keys): `query` , `error_type`, `error_subtype`, `emotion`, `feedback_target`, `intended_learning_outcome`
- Error taxonomy fields present:
  - `error_type` is one of **{syntax, schema, logic, construction}**
  - `error_subtype` is a fine-grained label; the repo states **23 total subtypes**
- Feedback/explanations present:
  - `feedback_target` is a supportive, hint-based feedback message tailored to the error and emotional state
  - `intended_learning_outcome` captures **the concept the feedback is meant to reinforce** (e.g., SELECT syntax, JOIN logic)
- Dataset size (as documented): The repo states **1,500 total samples**, covering **4 major error types** and **23 subtypes**

### Data generation & provenance

The README documents a synthetic + validated construction pipeline

- “Schema context” is the **Cybernetic Sabotage database** with tables: **Employees, Robots, Logs, Incidents, Access_Codes**
- Initial generation: **500 samples** generated using GPT-3.5-Turbo, then manually reviewed and validated
- Augmentation: **1,000 samples** produced with Llama-3.1-70B using subtype-specific prompts; refined using Claude 3 Sonnet and ChatGPT
- Environment: Python 3.13.2 with `pandas` + `openai` APIs
- Nature: “Fully synthetic, balanced, and manually validated…”

### License + citation metadata

- License section: **CC BY-NC 4.0**
- README provides a BibTeX entry with **DOI 10.5281/zenodo.17555894**

### Database schema & sample data

This repo include **the schema context at a high level** (table names for the Cybernetic Sabotage world), which is enough for semantic grounding of queries but not enough to recreate the database without another source

### Execution environment

SQL-Engage is a **dataset**

- The included notebook (`data_summary.ipynb`) is for dataset analysis, not query execution

For this project: SQL-Engage functions as **a knowledge backbone** (error taxonomy → feedback target → intended learning outcome), rather than a live execution environment

## What problems it targets

### Concept coverage (operationally: “what learner failures it models”)

SQL-Engage targets **error-driven learning needs**, organized around:

1. Syntax-level correctness

- Missing punctuation (e.g., semicolons, commas), malformed structure, keyword misspells, incorrect placement, etc.
This is captured under `error_type = syntax`

2. Schema awareness

- Referencing non-existent tables/columns/functions (`undefined column/table/function` kinds of failures)
Captured under `error_type = schema`

3. Logic and relational reasoning

- Incorrect JOIN usage, GROUP BY / HAVING mistakes, ambiguous references, operator misuse
Captured under `error_type = logic`

4. Construction / quality beyond correctness

- The README includes “inefficient query” as an example subtype, reflecting quality/efficiency feedback, not just correctness

### “Beyond hints”: what makes it useful for adaptive textbook work

For each query instance, the dataset pairs:

- a diagnosed error category/subtype
- a learner-facing supportive feedback message (`feedback_target`)
- an explicit pedagogical goal (`intended_learning_outcome`)

That’s exactly the shape you want for your adaptive artifact pipeline:
**trace signal → error concept → retrievable feedback → convert into notebook units**

## Brief explanation

- Treat SQL-Engage as the **taxonomy + feedback target store** for your adaptive textbook controller: map observed learner failures to (`error_type`, `error_subtype`) and retrieve/edit the corresponding `feedback_target` + `intended_learning_outcome` into learner-facing “My Notes” units.
- Use your separate SQL environment (e.g., Cybernatics Sabotage / SQLBeyond) for execution traces; use SQL-Engage for **what to say and what concept it serves**