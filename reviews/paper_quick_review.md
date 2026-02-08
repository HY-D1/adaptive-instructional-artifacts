# Week1 paper review summary

# My project (anchor for comparison)

Build an automatic adaptive “My Notes / My Textbook” for SQL learning that accumulates + reorganizes explanations/examples from problem-solving interaction traces (SQL errors, retries, time, hint use).

- Escalation beyond hints only when needed (hint → explanation → reflective note).
- Persistent learner artifact (notes/textbook that grows over time).
- Evidence via defensible comparisons (ideally including offline replay on logs).

---

# Papers 1–8

## Paper 1 — Crossley et al. (2025) iTELL RCT (L@S ’25)

### What it contributes (core mechanism)

“Intelligent text” built from pages + chunks, injecting constructed response items (CRIs) and required page summaries; Interactive adds immediate AI feedback plus STAIRS self-explanation + summary revision when summary quality is low. (p. 3, “split into pages and chunks”; p. 4, “Summaries with low content scores activated”; p. 3, “always-available AI chatbot”)

### Closest match to the project

- Treats content as small attachable units (chunks/pages) and uses signals → interventions (e.g., content score + focus time + similarity). (p. 4, “based on reading time”; p. 4, “semantic similarity”)
- Implements escalation-like behavior: low-quality output triggers guided dialogue + revision. (p. 4, “STAIRS 1.0”; p. 4, “asked to revise their summary”)

### What’s different from the SQL-trace vision

- Adaptation is reading-comprehension-centered (summary content scores + focus time), not problem-solving error traces. (p. 4, “Summaries with low content scores activated”)
- The “artifact” is largely in-session writing tasks, not a persistent multi-problem note bank that dedups/reorders across attempts (not described as such in the excerpt).

### Evaluation lesson to “steal”

- a clean 3-condition decomposition (Traditional vs Productive vs Interactive) that isolates “produce” vs “produce+feedback.” (p. 4, “three conditions”)

### Caution for the evaluation plan

- they report better summary quality but no significant condition × test interaction on learning gains. (p. 9, “No significant interaction between test and condition”) That warns to measure artifact quality + behavior change, not only pre/post.

---

## Paper 2 — Crossley et al. (2024) Using Intelligent Texts in a CS Classroom (CSEDM’24)

### What it contributes (core mechanism)

classroom deployment of iTELL in a CS course: pages chunked under headings with “chunk reveal” gating, probabilistic CRI spawning (1/3), and required page summaries with automated scoring/feedback; rich clickstream logging. (p. 3, “blurred… chunk reveal”; p. 3–4, “1/3 chance”; p. 4, “logs… scrolling”)

### Closest match to the project

- Demonstrates a realistic path from “intelligent text idea” → course deployment + trace extraction (focus time, scrolling, reveals). (p. 4, 2.5 data extraction; p. 4, “scrolling”)
- Explicitly treats behavior logs as explanatory variables for outcomes (their delta-score regression uses scrolls + summary scores + baseline proficiency). (p. 6, “Number scrolls”; p. 6, “Wording score”; p. 6, “Testing level (low)”)

### Key differences vs the SQL-trace objective

- Still fundamentally reading + write-a-summary; “struggle” signals are clickstream rather than solver traces (SQL errors/retries/hints). (p. 4–5, “focus time… click-stream… summaries”)
- Doesn’t describe a multi-step escalation ladder beyond gating + feedback; “adaptive textbook” here is mostly interactive reading flow.

### Method caution should avoid

- it’s an A/B with self-selection (extra credit volunteers), not randomized; paper acknowledges self-selection bias. (p. 7, “self-selection bias”; p. 6, “an A/B test”)

### Engineering caution relevant

- logging failures matter—constructed response logging bug and no sandbox logs. (p. 4, “bug… 130… pages”; p. 5, “logging… not implemented”) For SQL, missing/dirty traces will directly undermine offline replay.

---

## Paper 3 — Morris et al. (2024) Automatic Question Generation and Constructed Response Scoring in Intelligent Texts (LLM+EdTech workshop)

### What it contributes (core mechanism)

a pipeline that (1) segments content into chunks, (2) uses GPT-3.5 to generate short-answer questions + reference answers with human review, then (3) scores student answers locally via an MPNet+BLEURT ensemble producing 0/1/2 plus feedback; UI supports revise / reveal / skip. (p. 2, “segments… into ‘chunks’”; p. 4, “consensus voting ensemble”; p. 5, “reveal… skip… revise”)

### Closest match to the project

- The system needs reliable “when do we escalate?” signals—this paper shows a practical 3-level confidence output (0/1/2) that could inspire a trace-confidence state for SQL (e.g., repeated syntax error + fast retries ⇒ low confidence). (p. 4, “records a score of 0/1/2”)
- Strong emphasis on human-in-the-loop for generated instructional content (important for SQL correctness). (p. 1, “review and revision by a content editor”)

### Where it diverges from the“adaptive notes” goal

- Focus is on embedding practice inside text, not building a persistent note artifact that reorganizes across problems; only Q/A storage is explicit (“saved to a database”). (p. 5, “saved to a database”)
- Their baseline deployment is random (one-third of chunks), while the goal is trace-triggered. They even say random is likely suboptimal and suggest behavior-based triggers as future work. (p. 8, “deploys the questions randomly”; p. 8, “analyzing reading behavior”)

### Actionable design pattern

- treat “revise / reveal / skip” as explicit learner choices and log them—this is a clean way to measure whether escalation helped or annoyed. (p. 5, “reveal… skip… revise”)

### Key caution

- user complaints cluster around feedback accuracy/clarity, which will also be the biggest risk if SQL explanations are wrong. (p. 7, “accuracy… unclear feedback”)

---

## Paper 4 — Morris et al. (2025) Formative Feedback on Student-Authored Summaries… (IJAIED)

### What it contributes (core mechanism)

a full filter → score → qualitative feedback → rewrite gating pipeline for learner-written summaries inside iTELL; predicts Content/Wording scores (PCA-compressed rubric) and provides actionable feedback including missing keyphrases and pointers to where to revise. (p. 15, “filter component”; p. 16, “rewrite… before moving on”; p. 16, “list of key phrases”)

### Closest match to the project

- The “My Notes” needs quality control—this paper is basically a blueprint for validating learner-generated artifacts before they become persistent. (p. 15, “rejected without being analyzed”)
- The missing-keyphrase idea maps well to SQL: can detect “coverage gaps” in a learner explanation (e.g., missing join key, grouping condition) and point to the exact concept chunk to add. (p. 16, “key phrases… not present”)

### Big difference vs the trace-driven adaptive textbook

- Trigger is “a summary was submitted,” not “SQL struggle happened.” It’s reflection-driven, not solver-trace-driven. (p. 15–16, Application pipeline)
- Adaptation action is mainly rewrite gating + keyphrase guidance, not a multi-step hint → explanation → note policy.

### How to reuse without inheriting limitations

- Keep the filter-first gate for SQL notes (min length, on-topic, low-copying) and only then generate/store “durable” notes. (p. 15, “between 50 and 200 words”; p. 15, “borrowing… rejected”)
- Use “source + response joint modeling” as a principle: evaluate notes against both problem prompt + solution constraints, not the note alone (analog of Longformer using summary+source). (p. 11, “both the summary and the source”)

### Evaluation gap should fill

- they explicitly say learning impact of feedback is not established (the project needs that evidence). (p. 17, “feedback… leads to increase learning” as a needed test)

---

## Paper 5 — Sovrano et al. (2025) Improve Explanatory Power… Legal Writing (IJAIED)

### What it contributes (core mechanism)

on-demand “intelligent explanation” via question-centered organization: extract many candidate Q/A pairs from a corpus, build a knowledge graph with provenance, rank snippets by Degree of Explainability (DoX), then filter/dedup questions/answers to produce an interactive overview; evaluation compares their question-selection strategy vs baselines. (p. 14, “workflow… steps”; p. 17, “keep track of the sources”; p. 14, “questions… too similar are removed”)

### Closest match to the project

- The “My Textbook” needs good content organization. This paper shows a concrete strategy: don’t just retrieve facts—organize explanations by the most useful implicit questions. (p. 3, “best answered in the collection as a whole”)
- Provenance is huge for trust; they track sources for retrieved answers (a strong pattern for SQL explanations too). (p. 17, “keep track of the sources”)

### Key differences vs the SQL adaptation vision

- Adaptation is primarily learner-initiated (click term / ask question), not triggered by struggle traces. (p. 10, “user can ask questions”; p. 12, “clicking on an annotated word”)
- Evidence is perceived explanation quality ratings, not learning gains or performance improvement. (p. 25, “without directly measuring changes”)
- Domain is legal writing with huge external corpora; SQL course material would likely be smaller and more structured.

### What to steal anyway

- Deduplication + “noise budget”: surface only a few high-value explanations (their smart annotation thresholds are directly relevant to avoiding UI overload). (p. 15, “smart annotation mechanism”)
- “Compare presentation logic” idea: evaluate competing organization/selection policies with controlled baselines. (p. 20, “evaluating the presentation logic”)

---

## Paper 6 — Tytenko (2025) AI-driven Interactive Hierarchical Concept Maps… (iTextbooks’25)

### What it contributes (core mechanism)

a production-oriented system that generates hierarchical drill-down concept maps (Vis.js), with an information panel that shows concept explanations; supports child maps and even infinite drill-down generation; includes caching and an instructor-facing content management panel for regeneration/editing (human-in-the-loop). (p. 3, “hierarchical drill-down navigation”; p. 9, “content management panel”; p. 6, “submaps… cached”)

### Closest match to the project

- This is very close to the “adaptive textbook artifact” concept: a persistent navigable structure that organizes knowledge and supports depth-on-demand. (p. 3, “central… overview”; p. 4, “child map”)
- The file-based content store + caching resembles what will need for a durable “My Notes/My Textbook” that updates over time. (p. 7, “meta.json… root concept map… cached submaps”)

### Key differences vs the SQL-trace-driven escalation

- Adaptation here is mostly learner-driven exploration (drill-down) and AI expansion, not “system detects struggle in SQL attempts and escalates.” (p. 5, “generating new sub-maps dynamically”)
- Risks include topic drift and disorientation—problemswill also face if the notes expand automatically from traces. (p. 7, “Disorientation”; p. 7, “Topic Drift”)
- Evaluation is primarily student satisfaction/usefulness ratings, not learning gains or trace-based policy comparisons. (p. 10, “average score of 8.91 out of 10”)

### What to steal

- Use hierarchy to keep a stable “big picture,” and only generate depth when needed (a good UI match for “escalation beyond hints”). (p. 3–4, drill-down design)
- Build instructor controls for correcting/locking content (critical for SQL correctness). (p. 9, “edit generated content”)

---

## Paper 7 — Durg et al. (2025) LLM-powered Framework for Automatic Generation of Metacognitive Scaffolding Cues… (iTextbooks’25) — ~300 words

This paper is most relevant to the project because it operationalizes reflective/on-demand instructional units as metacognitive “scaffolding cues” that explicitly target three phases: Understand–Plan–Reflect (U/P/R). The core contribution is not a tutoring policy, but a content-architecture + generation/QA pipeline for producing these cues at scale for programming exercises: for each exercise and each U/P/R type, the authors generate 10 candidate cues, then manually select the best 3 under a fixed constraint (2 from GPT-4, 1 from TinyLlama), yielding 126 cues total across 14 exercises × 3 types × 3 cues. (p. 4, “generate 10 candidate scaffolding cues”; p. 4, “2 … from GPT-4”; p. 4, “126 scaffolding cues in total”)

### Similar to the adaptive-textbook idea

- It treats support as small, attachable content units anchored directly inside exercises via insertion points (TODOs), which parallels how want to attach “My Notes” snippets to specific SQL checkpoints (e.g., recurring error types). (p. 4, “embedded ‘TODO’ comments”)
- It foregrounds a reflection ladder (U/P/R) that maps cleanly onto the “reflective/accumulative learning artifact” direction—especially if the system uses traces to decide when to prompt “Plan” or “Reflect.” (p. 1, Abstract, “understanding… planning… reflecting”; p. 2, Introduction, “Understand, Plan, Reflect”)

### Key mismatch / what it doesn’t yet solve

- The “adaptation” is not trace-driven. Cue type selection/personalization based on student-level performance is only proposed as future work, and the study itself does not test live learning impact. (p. 10, Future Work, “personalized scaffolding cues”; p. 9, Limitations, “did not test … live”)
- The artifact is a cue dataset, not a persistent, reorganized notebook that accumulates across many tasks. (p. 10, Conclusions, “generated a dataset of 126”)

### What can credibly “steal”

- U/P/R as a minimal, inspectable “reflection ladder” (p. 2); generate-many→curate-few with explicit constraints (p. 4); and rubric-based artifact QA—while noting their reviewers had “very little agreement,” so the rubric will need calibration, especially for deeper reflective prompts. (p. 8, “very little agreement”; p. 9, “rubric… refined”)

---

## Paper 8 — Johnson et al. (2025) Improving Textbook Accessibility through AI Simplification… (iTextbooks’25) — ~300 words

This paper is relevant to the project as a concrete example of an intelligent-textbook feature that transforms content on demand inside a real product interface, then evaluates it using large-scale interaction logs. The system is a “Simplify” tool embedded in an eReader: students highlight a passage and click “Simplify,” and an LLM returns a rewritten version in a side panel. (p. 2, Introduction, “highlight… select ‘Simplify’”; p. 2, “side panel chat window”) The study analyzes 54,371 simplifier interactions from 11,689 students across 2,082 textbooks (Sep 1, 2024–Apr 30, 2025). (p. 4, Method 2.2, “54,371 events… 11,689 students… 2,082 textbooks”)

### Strong overlap with the “content + evidence” priorities

- The adaptation is learner-initiated (students choose exactly what is hard), which is a plausible companion to the trace-triggered approach: can let learners request “simplify/clarify this error explanation” inside “My Notes.” (p. 4, Method 2.2, “student-initiated simplification events”)
- It demonstrates a scalable evaluation style: compute quality signals from logs using automated metrics (readability, lexical/syntactic simplification, semantic fidelity). (p. 4–5, Method 2.2, “four dimensions”)

### What it doesn’t provide for core novelty

- There’s no hint→explanation→reflection escalation ladder; it’s primarily a single-step rewrite, and follow-ups (restate / re-simplify) are not analyzed in this paper. (p. 2, Introduction, “focuses specifically on analyzing… initial event”)
- It is not trace-triggered from problem-solving errors/retries/hints; the trigger is a student highlight action. (p. 2, Introduction, “highlight a passage”)
- It explicitly stops short of claiming comprehension gains, framing outcomes as groundwork for future studies. (p. 11, Conclusion, “stop short of claiming”)

### Concrete, reusable mechanisms for the system design

- Deterministic generation settings for reproducibility (temperature=0, top_p=1). (p. 4, Method 2.1)
- Context-bounded prompting (selected text + surrounding context). (p. 4, Method 2.1)
- A practical semantic-fidelity diagnostic: mean cosine similarity .85, with an “acceptable” threshold of .7 and 94.5% above it—useful as a flagging rule for risky rewrites of SQL explanations. (p. 7, Table 1, “Cosine similarity .85”; p. 8, “threshold… .7”; p. 8, “94.5%”)

---

# Cross-paper similarities vs differences (based on Papers 1–8)

## Shared design patterns

### 1) Small content units + attachment points

- Small content units (chunks/pages or nodes) + interaction checkpoints (CRIs, summaries, reveals). (Paper 1–3, chunking; Paper 6, nodes/maps)
- It treats support as small, attachable content units anchored directly inside exercises via insertion points (TODOs). (p. 4, “embedded ‘TODO’ comments”)
- Selected passage (student-highlighted text) as the input unit; simplified passage as the output unit displayed in the side panel. (p. 1, Abstract, "select a textbook passage"; p. 1, Abstract, "receive a simplified version")

### 2) Quality control loops (explicit or implied)

- Quality control pipelines: filter → score → feedback → revise/gate. (Paper 1 & 4 strongly; Paper 2 partially)
- Strong emphasis on human-in-the-loop for generated instructional content. (p. 1, “review and revision by a content editor”)
- Human review is built in: an author selects the best cues, and experts score/validate type and quality. (p. 4, Scaffolding Cue Generation, "reviewed these and selected"; p. 9, Discussion, "importance of human review")
- No post-simplification filters or fidelity checks are applied during real-time interactions. (p. 4, Method 2.1, "No additional post-simplification filters")

### 3) Navigation/organization is central (not just generation)

- Navigation/organization matters as much as generation: hierarchy (Paper 6) or question-centered overviews (Paper 5).
- For each exercise, there are three parallel cue sets aligned to U/P/R. (p. 4, Scaffolding Cue Generation, "generated scaffolding cues targeting")
- Textbook → student highlights passage → Simplify request → LLM simplification → side-panel display (with optional restate/follow-up). (p. 2, Introduction, "highlight ... select "Simplify""; p. 2, Introduction, "displayed ... side panel")

### 4) Learner control as a measurable signal

- treat “revise / reveal / skip” as explicit learner choices and log them. (p. 5, “reveal… skip… revise”)
- Learner-initiated: the student selects exactly which passage to simplify (“student-initiated”). (p. 4, Method 2.2, "student-initiated simplification events")
- Learner-initiated selection of cue types is not described; cues are “added at each exercise for evaluation.” (p. 4, Figure 1 caption, "added at each exercise")

### 5) Evidence via instrumentation + (mostly) intermediate metrics

- Demonstrates a realistic path from “intelligent text idea” → course deployment + trace extraction (focus time, scrolling, reveals). (p. 4, 2.5 data extraction; p. 4, “scrolling”)
- Observational log analysis comparing original student-selected passages vs simplified outputs on multiple automated metrics. (p. 1, Abstract, "compare the original ... and simplified")
- Rubric-driven evaluation of instructional artifact quality. (p. 6, Rubric-Based Evaluation, "structured 9-item binary rubric")
- The study analyzes 54,371 simplifier interactions from 11,689 students across 2,082 textbooks (Sep 1, 2024–Apr 30, 2025). (p. 4, Method 2.2, “54,371 events… 11,689 students… 2,082 textbooks”)

---

## Major axes of difference

### 1) Trigger model: system-triggered vs learner-triggered vs random

| Trigger type | Papers | Evidence (citations as written) |
|---|---|---|
| System-triggered (quality/score gate) | Paper 1, Paper 4 | (p. 4, “Summaries with low content scores activated”); (p. 16, “rewrite… before moving on”) |
| Learner-triggered (explicit request/click) | Paper 5, Paper 6, Paper 8 | (p. 10, “user can ask questions”; p. 12, “clicking on an annotated word”); (p. 5, “generating new sub-maps dynamically”); (p. 2, Introduction, “highlight… select ‘Simplify’”) |
| Random deployment | Paper 3 | (p. 8, “deploys the questions randomly”) |
| Author/system-curated insertion (not trace-driven) | Paper 7 | (p. 4, “embedded ‘TODO’ comments”); (p. 4, “selected the best three”) |

### 2) What adapts: structure, content, or language form

| Adaptation target | Papers | What changes |
|---|---|---|
| Reading flow + reflective tasks | Paper 1, Paper 2 | chunk gating, CRIs, summaries, feedback/revision gating |
| Practice layer + scoring feedback | Paper 3 | question generation, scoring (0/1/2), feedback + revise/reveal/skip |
| Reflective artifact QA | Paper 4 | filter/score + feedback + required rewrite gate |
| Explanatory organization | Paper 5, Paper 6 | question-centered overviews; hierarchical concept navigation/drill-down |
| Metacognitive prompts | Paper 7 | Understand–Plan–Reflect cues per exercise, curated from candidates |
| Language simplification | Paper 8 | rewrite selected passage to reduce complexity while maintaining meaning |

### 3) What persists over time: session output vs durable knowledge store

- Persistent navigable structure (maps, caching, files) is explicit. (p. 7, “meta.json… root concept map… cached submaps”)
- Focus is on embedding practice inside text; only Q/A storage is explicit (“saved to a database”). (p. 5, “saved to a database”)
- Persistent storage/learner history integration is not described; the artifact described is a dataset of cues generated for evaluation. (p. 10, Conclusions, "generated a dataset of 126")
- The “artifact” is largely in-session writing tasks, not a persistent multi-problem note bank that dedups/reorders across attempts (not described as such in the excerpt).
- It does not define an escalation ladder (hint → explanation → reflection); the feature is a single-step simplification tool with optional follow-ups not analyzed. (p. 2, Introduction, "focuses specifically on analyzing")

### 4) Evidence type: learning outcomes vs artifact/UX metrics

- RCT decomposition exists, but they report no significant condition × test interaction on learning gains. (p. 9, “No significant interaction between test and condition”)
- Does not test cues in live settings, so they do not claim impact on learning, engagement, or performance. (p. 9, Limitations, "cannot make claims ... impact")
- It explicitly stops short of claiming comprehension gains. (p. 11, Conclusion, “stop short of claiming”)
- Evaluation is primarily student satisfaction/usefulness ratings, not learning gains or trace-based policy comparisons. (p. 10, “average score of 8.91 out of 10”)
- Evidence is perceived explanation quality ratings, not learning gains or performance improvement. (p. 25, “without directly measuring changes”)

---

## Biggest gap relative to the project (updated for Papers 1–8)

none of Papers 1–8 primarily adapt from problem-solving error traces (SQL errors, retries, time, hint use) into a persistent reorganized notebook that dedups/reorders across many problems; most are reading-centric (Papers 1–4), learner-initiated exploration or rewriting (Papers 5, 6, 8), random deployment (Paper 3), or author-curated cue insertion without trace-triggered personalization (Paper 7). (e.g., Paper 1 trigger is low summary content score; Paper 5 trigger is clicks/questions; Paper 6 trigger is drill-down; Paper 8 trigger is “highlight… select ‘Simplify’”; Paper 7 personalization is future work only)

---

## Closest reusable patterns for the SQL “My Notes / My Textbook”

- Escalation-like gating based on quality signals: low-quality output triggers guided dialogue + revision. (p. 4, “asked to revise their summary”)
- A practical 3-level confidence output (0/1/2) that could inspire a trace-confidence state for SQL. (p. 4, “records a score of 0/1/2”)
- U/P/R as a minimal, inspectable “reflection ladder.” (p. 2, Introduction, “Understand, Plan, Reflect”)
- Context-bounded generation: selected text plus surrounding context. (p. 4, Method 2.1, "including the immediate paragraph")
- Deterministic generation settings for consistency: temperature=0, top_p=1. (p. 4, Method 2.1, "temperature = 0, top_p = 1")
- A semantic-fidelity diagnostic threshold: threshold set at .7; 94.5% above threshold. (p. 8, Results 3.4, "threshold ... at .7"; p. 8, Results 3.4, "94.5%")
- Deduplication + “noise budget”: surface only a few high-value explanations. (p. 15, “smart annotation mechanism”)
- Instructor controls for correcting/locking content. (p. 9, “edit generated content”)

---

## Key cautions

- Measuring only artifact quality may not translate into learning gains. (p. 9, “No significant interaction between test and condition”)
- Human disagreement indicates rubric calibration is hard, especially for deeper reflective prompts. (p. 8, RQ2, "very little agreement")
- Feedback accuracy/clarity complaints are likely to be the biggest risk if SQL explanations are wrong. (p. 7, “accuracy… unclear feedback”)
- Logging failures directly undermine any offline replay or trace-based claims. (p. 4, “bug… 130… pages”; p. 5, “logging… not implemented”)
- No post-generation checks (like simplification) increases risk if reused for high-stakes conceptual correctness. (p. 4, Method 2.1, "No additional post-simplification filters")

# Week1 summary

## Synthesis of prior work (Papers 1–8)

### 1) What has already been done that is similar?

- **“Intelligent text” systems that chunk content and instrument learner behavior** (reading flow + logs), then insert interactive tasks (e.g., constructed responses) and feedback loops inside the text experience.
- **Quality-control pipelines for learner-authored artifacts** (filter → score → feedback → revision/gating) that treat student writing as an object to improve (and potentially store).
- **Automatic generation + scoring of short-answer items** inside an intelligent text framework, including explicit multi-level outcomes (e.g., 0/1/2) and “revise / reveal / skip” style learner controls that can be logged as signals.
- **Organization-first “intelligent explanations”** that structure a domain by high-value questions, track sources/provenance, and deduplicate similar questions/answers to reduce noise (i.e., not just “generate,” but curate the presentation).
- **Persistent navigable knowledge artifacts** (hierarchical drill-down concept maps) with explicit storage/caching and an instructor-facing management workflow (regenerate/edit).
- **Metacognitive “scaffolding cues” as attachable units** aligned to phases like Understand/Plan/Reflect, generated at scale with manual selection/QA, and embedded directly in programming exercises (via “TODO” insertion points).
- **On-demand content transformation in production** (a “Simplify” feature in an eReader) evaluated via large-scale interaction logs, with controlled generation settings and post-hoc quality metrics (readability + semantic similarity).

### 2) Where these approaches fall short (relative to the SQL-trace adaptive notebook)

- **Triggers are mostly reading- or UI-action-driven, not problem-solving error-trace-driven.** Examples: chunk reveal pacing in intelligent texts; learner highlight→simplify; author-inserted metacognitive cues; and even random deployment for 1/3 of chunks in one system.
- **Persistence is usually “content system” persistence (maps, caches, databases), not a per-learner cross-problem notebook that dedups/reorders based on struggle history.** (The closest “persistent artifact” here is concept-map storage/caching, but it’s not framed as an accumulating learner notebook across problem attempts.)
- **Learning-impact evidence is often incomplete or indirect.** Example: the iTELL RCT reports *no significant condition × test interaction* for learning outcomes, warning that artifact quality/engagement improvements may not automatically translate to pre/post gains.
- **Some interventions are explicitly not tested in live learning settings** (e.g., cue generation work framed as a dataset/quality study rather than demonstrated learning impact).
- **Quality/faithfulness risks remain a practical bottleneck.** Example: the simplification study explicitly notes it “stops short” of tying results to improved comprehension; it is primarily log + metric analysis rather than a learning-outcome claim.
- **Instrumentation fragility is real** (logging gaps/bugs are explicitly reported), which is a direct threat to any “offline replay” evaluation story if traces are incomplete or inconsistent.

### 3) How our idea is different (even if only conceptually)

- **Trace-to-content mapping from solver traces (SQL errors/retries/time/hint use)** rather than reading behavior or explicit UI requests: the system decides *when to stay at hints vs escalate vs aggregate into reflective notes* using interaction signals.
- **A persistent per-learner “My Notes / My Textbook” that accumulates across problems**, reorganizes/dedups, and tracks implicit concept coverage—so the artifact grows with the learner over many attempts, not just within one reading session or one exercise.
- **Defensible comparisons via offline replay on logs** (e.g., hint-only vs adaptive-textbook policies), leveraging the same traces that triggered adaptation as the substrate for evaluation—not just UX ratings or one-off artifact scoring.

---

## Net takeaway (Week 1 synthesis)

Prior work has strong building blocks—**chunked content units + embedded activities + artifact QA loops + organization-focused presentation + scalable logging**—but it largely *does not* describe using **problem-solving error traces** to drive a **multi-step escalation policy** that writes into a **persistent, reorganized learner notebook** and then validates that policy via **offline replay comparisons**.
