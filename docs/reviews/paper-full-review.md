# Week 1 Paper full review

# Paper 1

## A) Full citation

Scott Crossley, Joon Suh Choi, Wesley Morris, and Langdon Holmes. 2025.  
Exploratory Assessment of Learning in an Intelligent Text Framework: iTELL RCT.  
In Proceedings of the Twelfth ACM Conference on Learning @ Scale (L@S ’25), July 21–23, 2025, Palermo, Italy.  
ACM, New York, NY, USA, 11 pages.  
<https://doi.org/10.1145/3698205.3729548>  

(p. 2, ACM Reference format, "Exploratory Assessment of Learning in an Intelligent Text Framework: iTELL RCT")

---

## B) Summary

- This paper tests whether adding “productive” activities (writing answers and summaries) and “interactive” AI feedback on those activities changes learning and user experience compared to a traditional digital-text-like condition. (p. 2, Abstract, "three versions of the same text")
- In a randomized control trial with crowd-sourced readers, the interactive condition improved summary quality compared to the productive condition, but pre–post test learning gains did not significantly differ across conditions overall. (p. 2, Abstract, "users of the interactive text consistently wrote better summaries"; p. 9, 3.5 Learning Gains, "No significant interaction between test and condition")

---

## C) Section-by-section reading

### Abstract

- The study compares three versions of the same text: traditional digital, productive (write knowledge but no feedback), and interactive (write knowledge with AI feedback/interaction). (p. 2, Abstract, "three versions of the same text")
- Learning gains are assessed via pre–post testing and also by quality of constructed responses and summaries produced. (p. 2, Abstract, "differences from a pre-test and a post-test")
- User experience is measured via survey results about satisfaction and interaction. (p. 2, Abstract, "User experiences were investigated using survey results")
- Reported results: interactive users wrote better summaries than productive users and revised summaries more and more successfully. (p. 2, Abstract, "wrote better summaries"; p. 2, Abstract, "revised summaries to a greater degree")
- Knowledge gains occurred in all conditions; within interactive, more reading time related to stronger test scores. (p. 2, Abstract, "knowledge gains occurred in all reading conditions"; p. 2, Abstract, "spent more time reading")

### 1 Introduction

- The paper frames “intelligent texts” as a next iteration beyond conventional digital texts, adding NLP-based interactivity to make learning more dynamic. (p. 2, 1 Introduction, "the next iteration of digital texts: intelligent texts")
- It argues that many intelligent texts exist but there is limited evidence about their efficacy for learning gains. (p. 3, 1 Introduction, "little information is available about their efficacy")
- The study’s novelty  is an RCT with three controlled versions of the same text, including a productive condition that isolates “produce knowledge” from “receive AI feedback.” (p. 3, 1.2 Current Study, "Unlike previous studies, three text versions are used")
- The deployment uses iTELL to deliver chapters from a macroeconomics textbook to crowd-sourced workers who also take pre/post tests and surveys. (p. 3, 1 Introduction, "chapters from a macro-economics textbook"; p. 3, 1 Introduction, "crowd-sourced workers")

### 1.1 iTELL

- iTELL converts learning materials into an intelligent text using a content authoring system that splits materials into pages and chunks. (p. 3, 1.1 iTELL, "split into pages and chunks")
- A chunk is defined as a subsection under a single sub-header, usually 1–3 paragraphs or a single instructional video. (p. 3, 1.1 iTELL, "1-3 paragraphs of text or a single instructional video")
- iTELL generates learning activities (constructed responses and summary writing) to encourage readers to generate knowledge about what they read/watch. (p. 3, 1.1 iTELL, "constructed responses items (CRIs) and summary writing")
- A constructed response item (CRI) is generated for each chunk using GPT-3.5-turbo with human-in-the-loop; each chunk has a 1/3 chance to spawn a CRI, with at least one CRI per page. (p. 3, 1.1 iTELL, "generated for each chunk using GPT-3.5-turbo"; p. 3, 1.1 iTELL, "1/3 chance"; p. 3, 1.1 iTELL, "minimum of one constructed response item per page")
- Users must submit at least one CRI response before proceeding to the next chunk; CRIs are scored and then feedback is given. (p. 3, 1.1 iTELL, "required to submit at least one response"; p. 3, 1.1 iTELL, "scored for correctness")
- A summary is required at the end of each page; it is filtered (e.g., borrowing, relevance, profanity) before scoring. (p. 3, 1.1 iTELL, "A summary is required at the end of each page"; p. 3, 1.1 iTELL, "filtered for language borrowing")
- The system includes an always-available AI chatbot (Llama 3 + RAG) for text-related questions and system questions, with guardrails against misuse. (p. 3, 1.1 iTELL, "based on Llama 3 with retrieval augmented generation (RAG)"; p. 3, 1.1 iTELL, "guardrails against cheating")
- If summary scores suggest low comprehension, iTELL triggers re-reading and uses a dialogic chatbot (STAIRS 1.0) to guide self-explanations, then asks users to revise their summary. (p. 4, 1.1 iTELL, "occur when readers show low comprehension"; p. 4, 1.1 iTELL, "STAIRS 1.0"; p. 4, 1.1 iTELL, "asked to revise their summary")

### 1.2 Current Study

- The goal is to assess learning gains and users’ experiences when reading within iTELL. (p. 4, 1.2 Current Study, "assess potential learning gains"; p. 4, 1.2 Current Study, "assess users’ experiences")
- The three conditions are: Traditional, Productive (produce knowledge without feedback), Interactive (produce knowledge + AI feedback/interaction). (p. 4, 1.2 Current Study, "traditional text"; p. 4, 1.2 Current Study, "productive text"; p. 4, 1.2 Current Study, "interactive intelligent text")
- Learning is operationalized as (a) quality of constructed responses and summaries and (b) pre–post test gains; experiences are via survey. (p. 4, 1.2 Current Study, "quality of constructed responses and summaries"; p. 4, 1.2 Current Study, "pre-test and a post-test"; p. 4, 1.2 Current Study, "survey results")
- Four research questions are listed, including experience differences, performance differences, learning differences, and moderation by individual differences. (p. 4, 1.2 Current Study, "The primary research questions")

### 2 Method — 2.1 Text

- The content is Chapter 7 (“Economic Growth”) from an OpenStax macroeconomics textbook; OpenStax is chosen due to a permissive Creative Commons license. (p. 4, 2.1 Text, "An OpenStax textbook"; p. 4, 2.1 Text, "permissive Creative Commons license")
- They excluded non-main-content subsections (e.g., Key Terms, Review Questions), leaving four subsections total. (p. 4, 2.1 Text, "Key Terms"; p. 4, 2.1 Text, "This left us with four subsections")

### 2 Method — 2.2 iTELL Deployment

- Three iTELL “volumes” implement three conditions; textual and multimedia contents are identical across conditions. (p. 4, 2.2 iTELL Deployment, "textual and multimedia contents ... identical")
- Each volume has four digital pages, one per selected subsection. (p. 4, 2.2 iTELL Deployment, "four digital pages")
- Interactive: at least one CRI per page + at least one summary per page; immediate AI feedback after CRI/summary submission. (p. 4, 2.2 iTELL Deployment, "answer at least one short question"; p. 4, 2.2 iTELL Deployment, "given immediate AI feedback")
- In Interactive, summaries with low content scores activate STAIRS; after STAIRS, users revise their summary. (p. 4, 2.2 iTELL Deployment, "Summaries with low content scores activated"; p. 4, 2.2 iTELL Deployment, "asked to revise their summary")
- Productive: same tasks as Interactive but no feedback; after summary submission there is a 25% chance of being redirected to a random text portion for re-reading, then revise summary. (p. 4, 2.2 iTELL Deployment, "not provided with any feedback"; p. 4, 2.2 iTELL Deployment, "25% chance")
- Traditional: no CRIs or self-written summaries; instead participants read CRIs with correct answers and read AI-generated summaries at the end. (p. 5, 2.2 iTELL Deployment, "not required to write any summaries"; p. 5, 2.2 iTELL Deployment, "read AI generated summaries")

### 2 Method — 2.3 Participants and Procedures

- Participants are recruited via Prolific; the paper motivates this by citing higher-quality outputs than similar platforms. (p. 5, 2.3 Participants and Procedures, "recruited from ... Prolific"; p. 5, 2.3 Participants and Procedures, "produce higher quality outputs")
- Eligibility requires passing four attention checks and three comprehension checks, with up to two chances. (p. 5, 2.3 Participants and Procedures, "four attention checks"; p. 5, 2.3 Participants and Procedures, "two chances")
- Participants are randomly assigned to conditions after intake survey; compensation differs by condition due to different estimated times (Traditional 40 min, Productive 1 hr, Interactive 1.33 hr). (p. 5, 2.3 Participants and Procedures, "assigned conditions at random"; p. 5, 2.3 Participants and Procedures, "40 minutes for Traditional")
- Initially 391 participants; removals lead to 348 participants for analysis (Traditional N=121, Productive N=119, Interactive N=108). (p. 5, 2.3 Participants and Procedures, "Initially, data was collected from 391"; p. 7, 3.1 IRT Results, "348 participants remained")

### 2 Method — 2.3 Variable Selection And Derivation

- User experience factors are derived via exploratory factor analysis (EFA) into general UX, summary UX, and CRI UX. (p. 5–6, 2.3.1 User Experience, "exploratory factor analysis (EFA)"; p. 6, Table 1, "three factor scores")
- Education is converted to an 8-level ordinal scale (1 = nursery–8th grade; 8 = doctorate). (p. 6, 2.3.2 Education, "eight levels")
- Economics interest is derived via PCA combining interest/confidence/news frequency. (p. 6, 2.3.3 Economics Interest, "principal component analysis")
- Reading skill is derived via PCA combining self-reported proficiency, books/year, and hours reading online. (p. 6, 2.3.4 Reading Skill, "combined using a principal component analysis")
- Reading time is measured by mean focus time per chunk, excluding chunks with CRIs or summaries, and removing outliers >3 SD above mean. (p. 6, 2.3.5 Reading Time, "mean focus time"; p. 6, 2.3.5 Reading Time, "> 3 standard deviations")

### 2 Method — 2.4 Analyses

- They use item response theory (IRT) to prune quiz items with negative discrimination and remove “misfitting” participants. (p. 6, 2.4 Analyses, "prune quiz items"; p. 6, 2.4 Analyses, "remove participants identified as misfitting")
- Survey differences across conditions are examined with one-way ANOVAs. (p. 6, 2.4 Analyses, "one-way ANOVAs")
- Performance analyses use linear mixed-effects models for CRI scores and summary content scores (Productive vs Interactive), including page progression and random intercepts for participants. (p. 6, 2.4 Analyses, "linear mixed-effects models"; p. 6, 2.4 Analyses, "random intercepts for participants")
- Summary revision analyses compare second attempts using Levenshtein distance and model content score changes. (p. 6, 2.4 Analyses, "Levenshtein distance"; p. 7, 2.4 Analyses continuation, "interaction effects")
- Pre/post learning analyses use mixed-effects modeling including individual differences (education, background knowledge, reading skill, reading time). (p. 7, 2.4 Analyses continuation, "controlling for individual differences")

### 3 Results — 3.1 IRT Results

- Initial reliability is low (Cronbach’s alpha 0.413), improves after removing two items with negative discrimination, then after removing 20 misfitting participants; final alpha 0.498 with 348 participants and 14 questions. (p. 7, 3.1 IRT Results, "Cronbach’s alpha of 0.413"; p. 7, 3.1 IRT Results, "improved Cronbach’s alpha"; p. 7, 3.1 IRT Results, "final reported Cronbach’s alpha ... 0.498")

### 3 Results — 3.2 Survey Results

- Participants are “generally satisfied” across all conditions, with outliers more notable in Interactive. (p. 7, 3.2 Survey Results, "generally satisfied"; p. 7, 3.2 Survey Results, "notable outliers")
- ANOVA shows no differences for general UX, CRI UX, and overall satisfaction, but a significant difference for summary experience (F(2,344)=3.143, p<.050, η²=.018). (p. 8, 3.2 Survey Results, "no differences"; p. 8, 3.2 Survey Results, "F(2, 344) = 3.143")
- Post-hoc indicates Traditional summary experience rated higher than Interactive, interpreted as preference for lower demands/no feedback. (p. 8, 3.2 Survey Results, "Traditional condition"; p. 10, 4 Discussion, "fewer demands placed on readers")

### 3 Results — 3.3 Performance Across The Text

- CRI scores: marginal page progression effect (β=0.027, p=.050), but no condition effect (p=.839). (p. 8, 3.3.1 CRI Scores, "β = 0.027"; p. 8, 3.3.1 CRI Scores, "p = .839")
- Summary content scores: Interactive higher than Productive (β=0.265, p<.001) and scores increase across pages (β=0.067, p<.001). (p. 8, 3.3.2 Summary Scores, "Interactive condition scored significantly higher"; p. 8, 3.3.2 Summary Scores, "Page progression also positively predicted")

### 3 Results — 3.4 Original And Revised Summaries

- Interactive participants revise summaries more than Productive (Levenshtein distance; U=1226.5, p<.001, Cliff’s d=0.823), and the descriptive means differ (Interactive M=206.54 vs Productive M=29.72). (p. 8, 3.4 Original And Revised Summaries, "Levenshtein distance"; p. 8, 3.4 Original And Revised Summaries, "M=206.54")
- Revision-to-score model shows a significant positive interaction between revision and Interactive condition (β=0.276, p<.001), interpreted as revision helping more in Interactive. (p. 8, 3.4 Original And Revised Summaries, "significant positive interaction"; p. 8, 3.4 Original And Revised Summaries, "β = 0.276")

### 3 Results — 3.5 Learning Gains

- All conditions improve from pre to post; delta is described as stronger for Traditional/Productive (~.12) than Interactive (~.07). (p. 9, 3.5 Learning Gains, "strongest growth ... (∆ = ~.12)"; p. 9, 3.5 Learning Gains, "lowest growth ... (∆ = ~.07)")
- The best quiz-score model reports no significant test×condition interaction, so they do not find evidence that learning gains differ by condition in that way. (p. 9, 3.5 Learning Gains, "No significant interaction between test and condition")
- They report an interaction between condition and focus time: in Interactive, higher focus time predicts higher quiz scores, while the other conditions show the opposite pattern. (p. 9, 3.5 Learning Gains, "significant interaction between condition and focus time")
- The table reports a significant Interactive*Focus Time term (Estimate 0.337, t=2.349, ). (p. 9, Table 1, "InteractiveFocus Time 0.337")

### 4 Discussion

- The discussion restates: no condition differences in general UX, CRI UX, or overall satisfaction, but summary UX favors Traditional over Interactive (small effect). (p. 9–10, 4 Discussion, "no differences"; p. 10, 4 Discussion, "summary factor")
- They emphasize that interactive yields higher-quality summaries and stronger revisions, despite lower satisfaction with the summary tool. (p. 10, 4 Discussion, "produced higher quality initial summaries"; p. 10, 4 Discussion, "not predicated on satisfaction")
- They interpret the lack of differential pre–post gains as possibly “the act of reading” driving learning across conditions, but propose time and accuracy may matter. (p. 10, 4 Discussion, "act of reading"; p. 10, 4 Discussion, "time spent on practice activities and accuracy")

### 5 Conclusion (and embedded Limitations / Future Work)

- Conclusion: no differences in CR accuracy between Productive and Interactive, but Interactive leads to stronger initial and revised summaries; all conditions show increased learning. (p. 10, 5 Conclusion, "no differences existed"; p. 10, 5 Conclusion, "produced stronger")
- They claim the study supports intelligent textbooks by providing AI feedback/practice without extra teacher responsibility and with automatic generation requiring little teacher/admin input. (p. 10, 5 Conclusion, "without putting further responsibility on the teacher"; p. 10, 5 Conclusion, "require little to no input")
- Limitations: crowd-sourced workers are not actual students; motivation differs because participants were paid and goals were not skill acquisition. (p. 10–11, Limitations paragraph in 5 Conclusion, "not actual students"; p. 11, Limitations paragraph in 5 Conclusion, "paid to interact")
- Limitations: higher dropout in Interactive reduces confidence and challenges the assumption of a true RCT due to selection bias. (p. 11, Limitations paragraph in 5 Conclusion, "higher drop-out rates"; p. 11, Limitations paragraph in 5 Conclusion, "questioning the assumption")
- Limitations: low Cronbach’s alpha (they state .70 is typically sought), so better items/participants would increase confidence. (p. 11, Limitations paragraph in 5 Conclusion, "Cronbach’s alpha of .70 is sought"; p. 11, Limitations paragraph in 5 Conclusion, "hovered around")
- Future work: iTELL has newer personalization features (reading/vocab assessments; dynamic scoring thresholds; streak system) that were not in this study’s alpha version. (p. 11, Future work paragraph, "did not include recent features"; p. 11, Future work paragraph, "dynamic scoring thresholds"; p. 11, Future work paragraph, "streak system")
- Future work: click-stream data may be mined to identify behaviors (e.g., scrolling/click-stream) that relate to learning and effort. (p. 11, Future work paragraph, "click-stream data"; p. 11, Future work paragraph, "scrolling activities")

---

## D) System explained

| Item | Description |
|---|---|
| What the learner sees | a text split into pages and chunks, with occasional CRI prompts and a required end-of-page summary task. (p. 3, 1.1 iTELL, "split into pages and chunks"; p. 3, 1.1 iTELL, "A summary is required") |
| What the learner does (Interactive/Productive) | answer at least one constructed response item (CRI) per page and write at least one summary per page. (p. 4, 2.2 iTELL Deployment, "answer at least one short question"; p. 4, 2.2 iTELL Deployment, "write at least one summary") |
| What the learner does (Traditional) | reads CRIs with correct answers and reads AI-generated summaries, without producing answers/summaries. (p. 5, 2.2 iTELL Deployment, "read CRIs that included correct answers"; p. 5, 2.2 iTELL Deployment, "read AI generated summaries") |
| What the system observes | reading “focus time” per chunk, summary–text semantic similarity (for selecting re-reading chunks), CRI completion status, and summary content scores. (p. 4, 1.1 iTELL, "based on reading time"; p. 4, 1.1 iTELL, "semantic similarity"; p. 4, 2.2 iTELL Deployment, "content scores") |
| What the system outputs (Interactive) | immediate AI feedback after CRIs/summaries, and if summaries are low-scoring, it triggers STAIRS self-explanation dialogue plus summary revision. (p. 4, 2.2 iTELL Deployment, "given immediate AI feedback"; p. 4, 2.2 iTELL Deployment, "activated ... STAIRS") |
| What the system outputs (Productive) | no feedback, but sometimes prompts re-reading (25% chance) and requests a revised summary. (p. 4, 2.2 iTELL Deployment, "not provided with any feedback"; p. 4, 2.2 iTELL Deployment, "25% chance") |

---

## E) Content architecture

| Item | Description |
|---|---|
| Units | pages, chunks, CRIs, summaries, and STAIRS dialog prompts; plus an always-available chatbot for questions and self-explanations. (p. 3, 1.1 iTELL, "pages and chunks"; p. 3, 1.1 iTELL, "constructed response item"; p. 3, 1.1 iTELL, "A summary is required"; p. 4, 1.1 iTELL, "STAIRS 1.0") |
| Structure | a sequence of pages; each page contains multiple chunks (subsections under sub-headers) and may interleave CRIs; each page ends with a summary requirement. (p. 3, 1.1 iTELL, "split into pages and chunks"; p. 3, 1.1 iTELL, "A summary is required") |
| Attachment rules | (a) CRI generation is tied to chunks with a 1/3 probability and at least one CRI per page; (b) summary is tied to each page end. (p. 3, 1.1 iTELL, "1/3 chance"; p. 3, 1.1 iTELL, "minimum of one") |
| Lifecycle (create → show → evaluate → revise) | summaries are filtered, then scored; low content scores can trigger STAIRS and then summary revision. (p. 3, 1.1 iTELL, "filtered for language borrowing"; p. 4, 2.2 iTELL Deployment, "Summaries with low content scores") |

---

## F) Adaptation mechanics

- IF a chunk is encountered, THEN it has a 1/3 chance to spawn a CRI (with at least one CRI per page). (p. 3, 1.1 iTELL, "1/3 chance"; p. 3, 1.1 iTELL, "minimum of one")
- IF the learner tries to proceed past a CRI chunk, THEN they must submit at least one response before moving to the next chunk. (p. 3, 1.1 iTELL, "required to submit at least one response")
- IF a page ends, THEN the learner must submit a summary (Interactive/Productive) or instead read an AI-generated summary (Traditional). (p. 3, 1.1 iTELL, "A summary is required"; p. 5, 2.2 iTELL Deployment, "read AI generated summaries")
- IF a summary fails expected filters (borrowing/relevance/length/profanity/English), THEN it requires revision and resubmission before scoring. (p. 4, 2.2 iTELL Deployment, "Summaries that did not pass"; p. 3, 1.1 iTELL, "filtered for language borrowing")
- IF a summary has low content score (Interactive), THEN iTELL triggers re-reading and launches STAIRS to guide self-explanations, THEN asks for a revised summary. (p. 4, 2.2 iTELL Deployment, "Summaries with low content scores"; p. 4, 1.1 iTELL, "guides the reader through a self-explanation")
- IF iTELL triggers re-reading (Interactive), THEN it selects a chunk the user likely did not attend to, using reading time, semantic similarity (summary vs segments), and whether they already completed a CRI for that segment. (p. 4, 1.1 iTELL, "based on reading time"; p. 4, 1.1 iTELL, "semantic similarity")
- IF in Productive condition after summary submission, THEN there is a 25% chance of random re-reading redirection, then the learner revises the summary (without feedback). (p. 4, 2.2 iTELL Deployment, "25% chance"; p. 4, 2.2 iTELL Deployment, "No feedback was given")
- Learner-initiated vs system-initiated: chatbot is always available for the learner to activate (learner-initiated), while STAIRS activation is system-triggered by low summary content scores. (p. 3, 1.1 iTELL, "always available to users"; p. 4, 2.2 iTELL Deployment, "activated ... STAIRS")
- Human-in-the-loop: CRIs are generated using GPT-3.5-turbo “with a human-in-the-loop.” (p. 3, 1.1 iTELL, "with a human-in-the-loop")

---

## G) Evaluation

### Setting / context

- Domain/content: an OpenStax macroeconomics chapter (Chapter 7, Economic Growth), reduced to four main-content subsections. (p. 4, 2.1 Text, "Chapter 7, Economic Growth"; p. 4, 2.1 Text, "four subsections")
- Platform: iTELL volumes (Interactive, Productive, Traditional) with identical base text/multimedia across conditions. (p. 4, 2.2 iTELL Deployment, "contents ... identical"; p. 4, 2.2 iTELL Deployment, "Three iTELL volumes")

### Design (conditions / randomization)

- Random assignment to one of three conditions after an intake survey. (p. 5, 2.3 Participants and Procedures, "assigned conditions at random")
- The three conditions differ primarily by (a) whether learners must produce CRIs/summaries and (b) whether they receive AI feedback/STAIRS vs none vs just reading provided answers/summaries. (p. 4–5, 2.2 iTELL Deployment, "immediate AI feedback"; p. 4, 2.2 iTELL Deployment, "not provided with any feedback"; p. 5, 2.2 iTELL Deployment, "read CRIs")

### Participants and procedure

- Recruitment: Prolific crowd-sourced workers, with attention and comprehension checks. (p. 5, 2.3 Participants and Procedures, "online crowd-sourcing platform Prolific"; p. 5, 2.3 Participants and Procedures, "attention checks")
- Sample sizes: 391 initially; final analysis N=348 (Traditional 121, Productive 119, Interactive 108). (p. 5, 2.3 Participants and Procedures, "data was collected from 391"; p. 7, 3.1 IRT Results, "Traditional: N= 121")
- Pre-test and post-test: 8 true/false pre-test items drawn from 16, and remaining 8 used as post-test. (p. 5, 2.2 iTELL Deployment, "eight true or false"; p. 5, 2.2 iTELL Deployment, "remaining eight questions")
- Compensation/time: Traditional 8 USD, Productive 12 USD, Interactive 14 USD; enforced time limit 123 minutes. (p. 5, 2.3 Participants and Procedures, "8 USD"; p. 5, 2.3 Participants and Procedures, "hard time limit of 123 minutes")

### Measures

- Learning: pre–post quiz score change plus quality metrics from CRI and summary scoring. (p. 4, 1.2 Current Study, "improvement of the quality"; p. 4, 1.2 Current Study, "pre-test and a post-test")
- User experience: Likert-scale survey, factor-scored into general UX, CRI UX, and summary UX. (p. 5–6, 2.3.1 User Experience, "five-point Likert"; p. 6, 2.3.1 User Experience, "three factor scores")

### Analysis methods

- IRT for test reliability and participant/item pruning; final Cronbach’s alpha 0.498. (p. 6, 2.4 Analyses, "item response theory"; p. 7, 3.1 IRT Results, "0.498")
- ANOVA for survey factor differences; one significant summary UX difference. (p. 6, 2.4 Analyses, "one-way ANOVAs"; p. 8, 3.2 Survey Results, "A significant difference")
- Linear mixed-effects models for CRI and summary scores (Productive vs Interactive), including page progression and random intercepts. (p. 6, 2.4 Analyses, "linear mixed-effects models"; p. 6, 2.4 Analyses, "random intercepts")
- Levenshtein distance and mixed effects modeling for revision amount and revision impact. (p. 6, 2.4 Analyses, "Levenshtein distance"; p. 8, 3.4 Original And Revised Summaries, "significant positive interaction")

### Key results

- Survey: summary experience differs across conditions (F(2,344)=3.143, p<.050, η²=.018), with Traditional rated higher than Interactive. (p. 8, 3.2 Survey Results, "F(2, 344) = 3.143"; p. 8, 3.2 Survey Results, "Traditional condition")
- CRI performance: no significant condition effect (β=0.010, p=.839); page progression marginal (β=0.027, p=.050). (p. 8, 3.3.1 CRI Scores, "p = .839"; p. 8, 3.3.1 CRI Scores, "p = .050")
- Summary content: Interactive > Productive (β=0.265, p<.001) and increases with page progression (β=0.067, p<.001). (p. 8, 3.3.2 Summary Scores, "β = 0.265"; p. 8, 3.3.2 Summary Scores, "β = 0.067")
- Revision amount: Interactive revisions larger (U=1226.5, p<.001, Cliff’s d=0.823; Interactive M=206.54, Productive M=29.72). (p. 8, 3.4 Original And Revised Summaries, "U = 1226.5"; p. 8, 3.4 Original And Revised Summaries, "M=206.54")
- Learning gains: no significant test×condition interaction; condition×focus time interaction suggests interactive benefits for higher focus time readers. (p. 9, 3.5 Learning Gains, "No significant interaction between test and condition"; p. 9, 3.5 Learning Gains, "significant interaction between condition and focus time")

---

## H) Limitations and failure modes

- Crowd-sourced workers are not actual students; paid participation means motivation/goals differ from classroom skill acquisition. (p. 10–11, Limitations paragraph in 5 Conclusion, "not actual students"; p. 11, Limitations paragraph in 5 Conclusion, "paid to interact")
- Higher dropout in Interactive reduces confidence and introduces potential selection bias, undermining “true random” participation. (p. 11, Limitations paragraph in 5 Conclusion, "higher drop-out rates"; p. 11, Limitations paragraph in 5 Conclusion, "participation was not truly random")
- Assessment reliability is low (they note .70 is typically sought; their alpha ~.50), which limits confidence in findings. (p. 11, Limitations paragraph in 5 Conclusion, "Cronbach’s alpha of .70 is sought"; p. 11, Limitations paragraph in 5 Conclusion, "hovered around")
- iTELL was in alpha testing and lacked newer learner-model/personalization features during data collection. (p. 11, Future work paragraph, "in alpha testing"; p. 11, Future work paragraph, "did not include recent features")

---

# PROJECT RELEVANCE

## I) Where this overlaps with our project (“What’s already been done that is similar?”)

| Paper feature / idea | Evidence (citation) | Closest match to our component | Notes on mapping to SQL learning |
|---|---|---|---|
| Break content into pages + chunks as instructional units | (p. 3, 1.1 iTELL, "split into pages and chunks") | 2) intelligent/adaptive textbook artifact | Similar to splitting SQL explanations into units attachable to tasks/errors. |
| Inject “produce-knowledge” activities (CRIs + summaries) | (p. 3, 1.1 iTELL, "constructed responses items (CRIs) and summary writing") | 1) adaptive instructional content beyond hints | Could map to asking learners to explain query logic or summarize mistakes. |
| Automated scoring + feedback on learner-generated text | (p. 3, 1.1 iTELL, "scored automatically"; p. 4, 2.2 iTELL Deployment, "immediate AI feedback") | 3) escalation from hints to explanations | Analog: hint → ask learner to justify → give feedback on justification. |
| Triggered re-reading + guided self-explanations (STAIRS) | (p. 4, 1.1 iTELL, "occur when readers show low comprehension"; p. 4, 1.1 iTELL, "guides the reader") | 4) reflective/accumulative learning artifacts | Similar to “reflective note” workflow after repeated SQL errors. |
| Trace-based trigger uses reading time + semantic similarity | (p. 4, 1.1 iTELL, "based on reading time"; p. 4, 1.1 iTELL, "semantic similarity") | 5) trace-to-content mapping / learning-from-logs | Directly analogous to using error/retry/time/hint-use traces in SQL. |
| Learner-initiated chatbot for questions (RAG guardrails) | (p. 3, 1.1 iTELL, "always available"; p. 3, 1.1 iTELL, "retrieval augmented generation") | 1) adaptive instructional content beyond hints | Similar to an “ask for help” channel in SQL tasks, grounded in course content. |
| RCT comparison: Traditional vs Productive vs Interactive | (p. 3, 1.2 Current Study, "three text versions"; p. 5, 2.3 Participants, "assigned conditions at random") | 6) offline replay and comparison (closest available: 5) | You can mirror this as hint-only vs reflective-notes vs adaptive-notes policies. |

## J) Where the paper falls short

- The adaptation trigger is tied to low summary content scores and reading behaviors, but the paper does not describe a broader multi-step escalation policy (e.g., hint → explanation → reflective note bank) as a general controller. (p. 4, 2.2 iTELL Deployment, "Summaries with low content scores activated")
- The evaluation is an online crowd-sourced RCT, not an offline replay-on-logged-traces evaluation; offline counterfactual replay is not discussed as the main evidence method here. (p. 4, 1.2 Current Study, "randomized control trial"; p. 11, Future work paragraph, "click-stream data ... could be mined")
- Personalization features (dynamic thresholds, streak-based skipping) are mentioned as newer features, but they were not part of the evaluated system in this paper’s data collection. (p. 11, Future work paragraph, "These newer features")
- The system measures focus time and summary similarity for chunk selection, but the paper does not detail an inspectable rule set for all adaptations beyond the described summary-based pathway. (p. 4, 1.1 iTELL, "based on reading time"; p. 4, 1.1 iTELL, "semantic similarity")

## K) How our idea is different

- Our idea differs because adaptation is driven by interaction traces from problem solving (SQL errors, retries, hint use), not primarily by summary content scores from reading comprehension tasks. (p. 4, 2.2 iTELL Deployment, "Summaries with low content scores activated")
- Our idea differs because we prioritize an explicit escalation ladder beyond hints (hint → explanation → reflective notes), while iTELL’s described escalation centers on re-reading + STAIRS + summary revision. (p. 4, 1.1 iTELL, "re-reading exercises"; p. 4, 1.1 iTELL, "asked to revise their summary")
- Our idea differs because we plan offline replay evaluation on logged traces to compare strategies; this paper’s evidence is an online RCT with Prolific readers. (p. 4, 1.2 Current Study, "randomized control trial"; p. 5, 2.3 Participants, "Prolific")

## L) Actionable “steal-this” design patterns

### Page–chunk decomposition as the core content primitive

- Page–chunk decomposition as the core content primitive
- What it does: splits material into reusable small units (chunks) nested inside pages, enabling targeted prompts and re-reading. (p. 3, 1.1 iTELL, "split into pages and chunks")
- How to implement for SQL: define “SQL chunk” units (one concept + example + common error) attachable to a trace event, and group them into “note pages” per concept.

### Probabilistic activity injection with minimum coverage

- Probabilistic activity injection with minimum coverage
- What it does: each chunk has a chance to spawn a CRI, but the system enforces a minimum per page. (p. 3, 1.1 iTELL, "1/3 chance"; p. 3, 1.1 iTELL, "minimum of one")
- How to implement for SQL: trigger “explain your query” prompts on some attempts, but enforce at least one reflective check per session or per concept.

### Filter-before-score pipeline for learner text

- Filter-before-score pipeline for learner text
- What it does: summaries are filtered for issues (borrowing/relevance/length/profanity/English) before scoring. (p. 3, 1.1 iTELL, "filtered for language borrowing")
- How to implement for SQL: validate learner explanations/notes (length, relevance to query, copying from solution) before using them to update notebook state.

### Score-triggered escalation to guided self-explanation

- Score-triggered escalation to guided self-explanation
- What it does: low summary content scores activate STAIRS self-explanation dialogue and then require a revised summary. (p. 4, 2.2 iTELL Deployment, "Summaries with low content scores activated"; p. 4, 1.1 iTELL, "guides the reader")
- How to implement for SQL: if repeated errors or low-quality self-explanations occur, escalate to a structured dialog that prompts reasoning steps, then store a cleaned “note” entry.

### Target selection using multiple behavioral signals

- Target selection using multiple behavioral signals
- What it does: selects a chunk for re-reading based on reading time, semantic similarity, and whether the learner already completed a CRI for that chunk. (p. 4, 1.1 iTELL, "based on reading time"; p. 4, 1.1 iTELL, "semantic similarity")
- How to implement for SQL: choose which concept note to surface using signals like time-on-task, retry count, hint usage, and “was a similar misconception already addressed?”

### Learner-initiated chatbot access with retrieval grounding

- Learner-initiated chatbot access with retrieval grounding
- What it does: chatbot is always available, uses RAG to keep responses on-topic, and includes guardrails. (p. 3, 1.1 iTELL, "always available"; p. 3, 1.1 iTELL, "retrieval augmented generation (RAG)")
- How to implement for SQL: “Ask about this error” button that retrieves SQL-Engage templates + relevant prior notes, then generates a short constrained explanation.

---

## M) Final takeaway

- This paper shows a concrete “intelligent text” design where reading material is split into pages/chunks, learners are prompted to generate knowledge (short answers and summaries), and the system adapts by giving feedback and triggering re-reading plus guided self-explanation when comprehension seems low. (p. 3, 1.1 iTELL, "split into pages and chunks"; p. 4, 1.1 iTELL, "occur when readers show low comprehension")
- Empirically, the interactive condition improved summary quality and revision behavior compared to the productive condition, but overall pre–post learning gains did not significantly differ by condition, except that time-on-text interacted with the interactive condition. (p. 8, 3.3.2 Summary Scores, "Interactive condition scored significantly higher"; p. 9, 3.5 Learning Gains, "No significant interaction between test and condition"; p. 9, 3.5 Learning Gains, "significant interaction between condition and focus time")

# Paper 2

## Instruction-fit notes

- Page numbers are visible (p. 1–9), so citations will use p. X (not p. ?). (p. 1, Footer, "CSEDM’24: 8th Educational Data Mining")
- The paper is a classroom deployment with an A/B comparison where students volunteered to use iTELL for extra credit (not randomized assignment as described here). (p. 6, 4 Discussion and conclusion, "an A/B test"; p. 3, 1.3 Current Study, "given extra credit")
- The paper does not present a formal standalone “Related Work” section; related context is embedded in the Introduction subsections. (p. 2, 1.1 Intelligent Texts, "Intelligent textbooks have become")

---

## A) Full citation

- Scott Crossley, Joon Suh Choi, Wesley Morris, Langdon Holmes, David Joyner, and Vaibhav Gupta. (p. 1, Author block, "Scott Crossley"; p. 1, Author block, "David Joyner")
- Using Intelligent Texts in a Computer Science Classroom: Findings from an iTELL Deployment. (p. 1, Title, "Using Intelligent Texts in a Computer Science Classroom")
- CSEDM’24: 8th Educational Data Mining in Computer Science Education Workshop, July 14, 2024, Atlanta, GA. (p. 1, Footer, "CSEDM’24: 8th Educational Data Mining")
- Published in CEUR Workshop Proceedings (ceur-ws.org), ISSN 1613-0073; CC BY 4.0. (p. 1, Footer, "CEUR Workshop Proceedings"; p. 1, Footer, "Creative Commons License Attribution 4.0")

---

## B) Summary

- This paper studies an “intelligent text” version of a programming textbook chapter used in a real computer science class, where iTELL adds constructed response questions and per-page summaries with automated scoring and feedback. (p. 1, Abstract, "assesses the efficacy of intelligent texts"; p. 2, 1.2 iTELL, "requires readers to submit a summary")
- Students who used iTELL (voluntarily, for extra credit) reported positive experiences, and the authors report small learning-gain differences between iTELL and non-iTELL groups plus a regression linking gains to scroll behavior, summary wording scores, and prior proficiency. (p. 1, Abstract, "students responded positively"; p. 6, 3.3 Delta Value Predictions, "number of scrolls"; p. 6, 3.3 Delta Value Predictions, "Testing level (low)")

---

## C) Section-by-section reading

### Abstract

- The study evaluates intelligent texts in a computer science class for computational thinking/programming understanding, using iTELL to convert a programming textbook chapter into an interactive format. (p. 1, Abstract, "computer science class understand"; p. 1, Abstract, "ingested into an intelligent text format")
- iTELL requires constructed responses and summaries, and uses LLMs trained for scoring to generate qualitative feedback. (p. 1, Abstract, "constructed response items and summaries"; p. 1, Abstract, "scored automatically by large language models")
- Students report positive survey responses about these tasks, and iTELL users show increased learning gains vs non-iTELL in delta pre/post comparisons as described. (p. 1, Abstract, "responded positively"; p. 1, Abstract, "showed increased learning gains")
- Regression analyses predict delta gains using scrolls, summary “word scores,” and pre-test proficiency level. (p. 1, Abstract, "predicted by the number of scrolls"; p. 1, Abstract, "pre-test proficiency level")

### 1. Introduction

- The introduction motivates the work by framing computational thinking as a key skill and describing programming as complex and iterative beyond syntax. (p. 1, 1 Introduction, "Computational thinking is a critical"; p. 1, 1 Introduction, "beyond simple syntax")
- It argues static textbooks may be ineffective for dynamic programming concepts and that students may fail to comprehend programming dynamics from static materials. (p. 1, 1 Introduction, "static confines of the text"; p. 2, 1 Introduction continuation, "fail to comprehend programming dynamics")
- The stated goal is to assess interactive intelligent texts in a CS class using iTELL, which supports read-to-write tasks and automated scoring/feedback used to guide learning and correct misconceptions. (p. 2, 1 Introduction continuation, "goal of this study is to assess"; p. 2, 1 Introduction continuation, "correct misconceptions")

### 1.1. Intelligent Texts

- The paper defines intelligent textbooks as increasingly feasible due to NLP advances enabling accessible human–machine interaction. (p. 2, 1.1 Intelligent Texts, "advancements in Natural Language Processing")
- It claims interactive features can improve reading performance, referencing a meta-analysis, and notes student preference for digital textbooks due to cost/ease. (p. 2, 1.1 Intelligent Texts, "interactive features ... can moderately improve"; p. 2, 1.1 Intelligent Texts, "prefer digital textbooks")
- It describes personalization research directions: using assessments/behaviors to recommend activities or adapt content and provide remedial materials. (p. 2, 1.1 Intelligent Texts, "recommend optimal learning activities"; p. 2, 1.1 Intelligent Texts, "provide remedial materials")
- It argues LLMs can increase interactivity and enable real-time feedback, chatbots, and auto-generated content plus automated scoring/feedback. (p. 2, 1.1 Intelligent Texts, "real-time feedback"; p. 2, 1.1 Intelligent Texts, "automation of scoring and feedback")

### 1.2. iTELL

- iTELL is presented as a framework to simplify creation/deployment of intelligent texts with LLM pipelines (with human oversight) to generate participatory content and provide scoring APIs. (p. 2, 1.2 iTELL, "simplifies the creation"; p. 2, 1.2 iTELL, "with human oversight")
- It is described as domain-agnostic and logs rich clickstream data via viewport detection plus scrolling and page clicks. (p. 2, 1.2 iTELL, "domain-agnostic framework"; p. 2, 1.2 iTELL, "logs the observation time")
- It emphasizes read-to-write tasks: readers complete at least one constructed response and one summary per page; LLMs generate questions, score responses, score summaries, and provide feedback for revisions. (p. 2, 1.2 iTELL, "complete at least one constructed response"; p. 2, 1.2 iTELL, "provide feedback to readers")

### 1.3. Current Study

- The study examines an iTELL volume in an Introduction to Computing class; about 25% of students used iTELL for extra credit while others used a static digital textbook. (p. 3, 1.3 Current Study, "about 25% did"; p. 3, 1.3 Current Study, "static, digital version")
- Students took chapter tests; research questions include usability/learning perceptions, test score gains from chapter 2→3 comparing iTELL vs non-iTELL, and whether iTELL log features predict score changes. (p. 3, 1.3 Current Study, "easy to interact"; p. 3, 1.3 Current Study, "gains from the test on chapter two")

### 2. Method — 2.1 Course

- Data comes from an Intro to Computing class in spring 2024 at a large technology university; the course includes many programming problems and proctored tests. (p. 3, 2.1 Course, "spring of 2024"; p. 3, 2.1 Course, "several hundred small programming problems")
- Tests and quizzes comprise 52% of the course grade. (p. 3, 2.1 Course, "Tests and quizzes comprise 52%")

### 2. Method — 2.2 Textbook

- The textbook is Introduction to Computing (first edition), digital, with five units; the study ingests the “Control Structures” unit into an iTELL volume. (p. 3, 2.2 Textbook, "Introduction to Computing, first edition"; p. 3, 2.2 Textbook, "third unit covering Control Structures")
- The iTELL volume includes an overview page + 5 additional pages; pages follow chapter structure (objectives, key terms, prose, figures/tables). (p. 3, 2.2 Textbook, "overview page"; p. 3, 2.2 Textbook, "5 additional pages")
- IDE screenshots in the textbook were replaced with a Python interactive sandbox allowing students to run code in iTELL. (p. 3, 2.2 Textbook, "replaced with a Python interactive sandbox")
- Pages are separated into chunks under unique sub-headings; average ~6.6 chunks per page; only the first chunk is visible initially and others are blurred until the learner clicks “chunk reveal.” (p. 3, 2.2 Textbook, "separated into chunks"; p. 3, 2.2 Textbook, "blurred"; p. 3, 2.2 Textbook, "chunk reveal")
- A constructed response item exists for each chunk and has a 1/3 chance of being presented to the user. (p. 3, 2.2 Textbook, "Each chunk had an accompanying"; p. 3, 2.2 Textbook, "1/3 chance")

### 2. Method — 2.3 Participants and Procedure

- There were 476 enrolled students; 121 used iTELL and 356 did not; iTELL participation gave 1% extra credit. (p. 3, 2.3 Participants and Procedure, "total of 476"; p. 3, 2.3 Participants and Procedure, "1% extra credit")
- Of 121 iTELL users, 101 consented to data analysis; 82 completed iTELL + outtake; 79 reported test scores for units 2 and 3; non-iTELL: 277 reported test scores for units 2 and 3. (p. 3, 2.3 Participants and Procedure, "101 consented"; p. 3, 2.3 Participants and Procedure, "79 reported test scores")
- Outtake survey focuses on layout/organization, annotation features, and effectiveness of summary and short answer tasks. (p. 3, 2.3 Participants and Procedure, "layout, organization, annotation features")

### 2. Method — 2.4 Surveys

- Intake survey collects demographics and reading/technology habits plus prior intelligent-text feature experience. (p. 3, 2.4.1 Intake Survey, "demographic data"; p. 3, 2.4.1 Intake Survey, "features that they have used")
- Outtake survey asks about feature relevance, correctness, ease of interaction, and learning impact, plus short text feedback. (p. 4, 2.4.2 Outtake Survey, "stayed relevant to the text"; p. 4, 2.4.2 Outtake Survey, "helped improve")

### 2. Method — 2.5 iTELL Data Extraction

- They extract focus time, click-stream events, constructed responses, and summaries. (p. 4, 2.5 iTELL Data Extraction, "extracted data related to")

#### 2.5.1 Focus Time

- Focus time is measured two ways: (1) page-open to next-page time (includes constructed responses and summary scoring), and (2) chunk view time aggregated per page. (p. 4, 2.5.1 Focus Time, "subtracting the time"; p. 4, 2.5.1 Focus Time, "how long each chunk")

#### 2.5.2 Events

- Logged events include chunk reveal (with/without constructed responses), general clicks, page focus periods, and scrolling. (p. 4, 2.5.2 Events, "chunk reveal events"; p. 4, 2.5.2 Events, "when scrolling")
- Many students reread; ~40% of chapters show rereading operationalized as scrolling upwards >3% of page content. (p. 4, 2.5.2 Events, "Around 40% of chapters"; p. 4, 2.5.2 Events, "scrolling upwards of more than 3%")

#### 2.5.3 Constructed Responses

- Constructed response items are generated per chunk using GPT-3.5-turbo with human-in-the-loop; items spawn with 1/3 chance and at least one per page; users must respond before proceeding. (p. 4, 2.5.3 Constructed Responses, "GPT-3.5-turbo"; p. 4, 2.5.3 Constructed Responses, "1/3 chance"; p. 4, 2.5.3 Constructed Responses, "required to submit")
- Responses are scored for correctness using two fine-tuned models (BLEURT and MPNet), and learners can revise based on feedback. (p. 4, 2.5.3 Constructed Responses, "scored for correctness"; p. 4, 2.5.3 Constructed Responses, "opportunity to revise")
- They compute number of responses and average score on a 1–3 scale based on model agreement. (p. 4, 2.5.3 Constructed Responses, "average score ... on a scale of 1-3")
- Logging limitation: a bug caused many constructed responses not to be logged; 130 of 395 completed pages lacked constructed response data. (p. 4, 2.5.3 Constructed Responses, "bug in the code"; p. 4, 2.5.3 Constructed Responses, "130 of those pages")

#### 2.5.4 Summaries

- After each page, students write a summary; filters enforce 50–200 words, English, and no inappropriate language; copy/paste from text is not allowed. (p. 4, 2.5.4 Summaries, "between 50 and 200 words"; p. 4, 2.5.4 Summaries, "does not allow copying")
- Summaries receive language borrowing and relevance scores; passing summaries are scored by two encoder models on Content and Wording, with normalized predictions. (p. 4, 2.5.4 Summaries, "Language Borrowing"; p. 4, 2.5.4 Summaries, "scored by two encoder")
- Content/Wording scores are tied to rubric-derived components; the paper reports held-out R² values of 0.82 (Content) and 0.7 (Wording). (p. 4, 2.5.4 Summaries, "reported R2 values of 0.82"; p. 4, 2.5.4 Summaries, "0.7 for Wording")
- They compute per-participant summary counts and average scores for Content, Wording, Language Borrowing, and Relevance. (p. 5, 2.5.4 Summaries, "calculated the number of summaries"; p. 5, 2.5.4 Summaries, "average score")

#### 2.5.5 Python IDE

- The iTELL volume included a Python IDE sandbox, but sandbox logging was not implemented at data collection time. (p. 5, 2.5.5 Python IDE, "logging features ... were not implemented")

### 2.6 Analyses

- RQ1 uses descriptive statistics and visualizations of survey responses. (p. 5, 2.6 Analyses, "simple descriptive statistics")
- RQ2 compares delta values (test 2 vs test 3) for iTELL vs non-iTELL using statistical tests plus p-values and Cliff’s Delta. (p. 5, 2.6 Analyses, "differences between the two groups’ delta values"; p. 5, 2.6 Analyses, "Cliff’s Delta")
- RQ3 uses stepwise linear regression with iTELL predictors and includes a categorical baseline performance variable (above/below mean on test 2) and interactions. (p. 5, 2.6 Analyses, "stepwise linear regression"; p. 5, 2.6 Analyses, "above the mean (high) or below")

---

## D) System explained

### What the learner sees (UI/components)

- A web-based intelligent text volume with multiple pages derived from a programming textbook unit. (p. 3, 2.2 Textbook, "ingested the third unit"; p. 3, 2.2 Textbook, "5 additional pages")
- Pages split into chunks under unique sub-headings, with “chunk reveal” gating (blurred chunks until clicked). (p. 3, 2.2 Textbook, "chunks ... under a unique sub-heading"; p. 3, 2.2 Textbook, "blurred")
- Constructed response items that sometimes appear for chunks (1/3 spawn chance). (p. 3, 2.2 Textbook, "1/3 chance of a constructed response")
- A summary-writing interface after each page. (p. 4, 2.5.4 Summaries, "prompted to write a summary")
- A Python sandbox replacing IDE screenshots, letting students run code. (p. 3, 2.2 Textbook, "replaced with a Python interactive sandbox")

### What the learner does (actions)

- Clicks to reveal chunks sequentially while reading. (p. 3, 2.2 Textbook, "click on a “chunk reveal” button")
- Answers spawned constructed response items and may revise responses based on feedback. (p. 4, 2.5.3 Constructed Responses, "required to submit"; p. 4, 2.5.3 Constructed Responses, "opportunity to revise")
- Writes a summary after reading each page and receives scoring/feedback per the pipeline. (p. 4, 2.5.4 Summaries, "receive a score"; p. 4, 2.5.4 Summaries, "scored by two encoder")
- Runs Python code in the sandbox (but those actions are not logged in this deployment). (p. 5, 2.5.5 Python IDE, "allowed students to enter and run"; p. 5, 2.5.5 Python IDE, "not implemented")

### What the system observes (signals/logs)

- Focus time at page level and chunk level (view durations). (p. 4, 2.5.1 Focus Time, "how long each chunk")
- Clickstream events including chunk reveals, general clicks, focusing periods, and scrolling. (p. 4, 2.5.2 Events, "chunk reveal events"; p. 4, 2.5.2 Events, "when scrolling")
- Constructed response counts and correctness scores (1–3 scale) when logged. (p. 4, 2.5.3 Constructed Responses, "average score ... 1-3"; p. 4, 2.5.3 Constructed Responses, "not logged")
- Summary scores (Content, Wording, Language Borrowing, Relevance). (p. 5, 2.5.4 Summaries, "Content, Wording"; p. 5, 2.5.4 Summaries, "Language Borrowing, and Relevance")

### What the system outputs (content/feedback/artifacts)

- Qualitative feedback informed by LLM-based scoring for constructed responses and summaries. (p. 2, 1 Introduction continuation, "inform qualitative feedback"; p. 2, 1.2 iTELL, "provide feedback")
- Scoring outputs for summaries including borrowing/relevance plus content/wording components when passing filters. (p. 4, 2.5.4 Summaries, "Language Borrowing"; p. 4, 2.5.4 Summaries, "Content ... and Wording")

---

## E) Content architecture

### Units (what “content chunks” exist)

- iTELL volume containing an overview page plus multiple content pages aligned to textbook chapters. (p. 3, 2.2 Textbook, "overview page"; p. 3, 2.2 Textbook, "5 additional pages")
- Page as a top-level unit; pages contain objectives/terms/prose/figures and interactive elements. (p. 3, 2.2 Textbook, "Each page followed the structure")
- Chunk as a sub-unit under unique sub-headings, gated by “chunk reveal.” (p. 3, 2.2 Textbook, "chunks ... under a unique sub-heading"; p. 3, 2.2 Textbook, "blurred")
- Constructed response item linked to chunks, spawned probabilistically. (p. 3, 2.2 Textbook, "constructed response question"; p. 3, 2.2 Textbook, "1/3 chance")
- Summary after each page, with filter-and-score pipeline. (p. 4, 2.5.4 Summaries, "prompted to write a summary"; p. 4, 2.5.4 Summaries, "Algorithmic filters")
- Python IDE sandbox embedded in pages (no logging in this deployment). (p. 3, 2.2 Textbook, "Python interactive sandbox"; p. 5, 2.5.5 Python IDE, "not implemented")

### Structure (how units connect)

- Page → multiple chunks (avg ~6.6), with sequential reveal (only first visible initially). (p. 3, 2.2 Textbook, "around 6.6 chunks"; p. 3, 2.2 Textbook, "Only the first chunk")
- Chunk → possible constructed response item (1/3 spawn chance; at least one per page). (p. 4, 2.5.3 Constructed Responses, "1/3 chance"; p. 4, 2.5.3 Constructed Responses, "minimum of one")
- Page → summary prompt after reading page. (p. 4, 2.5.4 Summaries, "After reading each page")

### Attachment rules (task→unit, concept→unit, etc.)

- Each chunk has an associated constructed response item (authoring side), but user-facing spawning is probabilistic (1/3 chance). (p. 3, 2.2 Textbook, "Each chunk had an accompanying"; p. 4, 2.5.3 Constructed Responses, "each chunk has a 1/3 chance")
- Summary prompt attaches to each page and enforces constraints (length/English/inappropriate language/no copy-paste). (p. 4, 2.5.4 Summaries, "between 50 and 200 words"; p. 4, 2.5.4 Summaries, "does not allow copying")

### Lifecycle (create → show → evaluate → revise → store)

- Create: content management system generates Q/A for each chunk with human-in-the-loop, and designers check accuracy before publishing. (p. 3, 2.2 Textbook, "automatically generates"; p. 3, 2.2 Textbook, "ensured ... accurate")
- Show: chunks are revealed via button; constructed responses may appear; summaries appear after each page. (p. 3, 2.2 Textbook, "chunk reveal"; p. 4, 2.5.4 Summaries, "prompted to write a summary")
- Evaluate: constructed responses scored by models and summaries scored via filter + scoring pipeline. (p. 4, 2.5.3 Constructed Responses, "scored for correctness"; p. 4, 2.5.4 Summaries, "If they pass these tests")
- Revise: constructed response feedback supports revision; summary feedback is “to use when revising summaries.” (p. 4, 2.5.3 Constructed Responses, "opportunity to revise"; p. 2, 1.2 iTELL, "use when revising summaries")

---

## F) Adaptation mechanics

### Triggers/signals observed

- IF a learner opens a page and moves to the next page, THEN page-level focus time is recorded; IF a chunk is viewed, THEN chunk-level view time contributes to total/average times. (p. 4, 2.5.1 Focus Time, "opened the page"; p. 4, 2.5.1 Focus Time, "how long each chunk")
- IF scrolling occurs and includes upward scrolling beyond a threshold, THEN rereading events are represented (paper operationalizes rereading as “scrolling upwards of more than 3%”). (p. 4, 2.5.2 Events, "reread chapters"; p. 4, 2.5.2 Events, "more than 3%")

### Adaptation actions taken (explicit in this deployment)

- IF a chunk is not yet revealed, THEN the learner must click “chunk reveal” to unblur it. (p. 3, 2.2 Textbook, "required to click on a “chunk reveal”")
- IF a constructed response item spawns, THEN the learner must submit at least one response before proceeding to the next chunk. (p. 4, 2.5.3 Constructed Responses, "required to submit at least one response")
- IF a chunk is encountered, THEN it has a 1/3 chance of spawning a constructed response item (with at least one per page). (p. 4, 2.5.3 Constructed Responses, "1/3 chance"; p. 4, 2.5.3 Constructed Responses, "minimum of one")
- IF a summary is submitted, THEN it is checked against filters and then scored for borrowing/relevance and (if passed) content/wording. (p. 4, 2.5.4 Summaries, "ensure that the summaries"; p. 4, 2.5.4 Summaries, "If they pass these tests")

### Learner-initiated vs system-initiated

- Learner-initiated: chunk reveal and rereading via scrolling are learner-controlled actions that generate logged events. (p. 3, 2.2 Textbook, "click on a “chunk reveal”"; p. 4, 2.5.2 Events, "reread chapters")
- System-initiated: item spawning is system-controlled probabilistic presentation (“1/3 chance”) and gating requires a response before proceeding. (p. 4, 2.5.3 Constructed Responses, "1/3 chance"; p. 4, 2.5.3 Constructed Responses, "before proceeding")

### Human-in-the-loop controls

- Human oversight exists in question/answer generation: GPT-3.5-turbo with human-in-the-loop, with page designer verifying accuracy before publishing. (p. 4, 2.5.3 Constructed Responses, "GPT-3.5-turbo with human-in-the-loop"; p. 3, 2.2 Textbook, "ensured ... accurate")

---

## G) Evaluation

### Setting/context (course/platform/domain/content source)

- Course: Intro to Computing at a large technology university, spring 2024, covering procedural programming through algorithms; many programming problems and timed tests. (p. 3, 2.1 Course, "spring of 2024"; p. 3, 2.1 Course, "four timed, proctored tests")
- Content: Introduction to Computing textbook unit on Control Structures ingested into iTELL, with Python sandbox replacing IDE screenshots. (p. 3, 2.2 Textbook, "Control Structures"; p. 3, 2.2 Textbook, "Python interactive sandbox")

### Design (conditions/baselines/randomization)

- Design is described as an A/B test: about 25% volunteered to use iTELL for extra credit vs the rest using a static digital text. (p. 6, 4 Discussion and conclusion, "an A/B test"; p. 3, 1.3 Current Study, "about 25% did")
- Baseline: chapter 2 test scores used as baseline; chapter 3 test corresponds to the iTELL volume content. (p. 6, 4 Discussion and conclusion, "test scores from the previous chapter"; p. 3, 1.3 Current Study, "chapter two (no iTELL volume)")

### Participants and procedure

- Enrollment and participation: 476 enrolled; 121 used iTELL and 356 did not; data analysis uses subsets based on consent/completion and reported scores. (p. 3, 2.3 Participants and Procedure, "476 students enrolled"; p. 3, 2.3 Participants and Procedure, "121 students elected")
- Reported-score sample sizes: iTELL group 79 reporting test scores for units 2 and 3; non-iTELL group 277 reporting test scores for units 2 and 3. (p. 3, 2.3 Participants and Procedure, "79 reported test scores"; p. 3, 2.3 Participants and Procedure, "277 reported test scores")

### Measures (learning, UX, artifact quality, logs)

- User experience: outtake survey about layout/organization/annotation and perceived effectiveness of summary and short answer tasks. (p. 3, 2.3 Participants and Procedure, "annotation features"; p. 4, 2.4.2 Outtake Survey, "helped improve")
- Learning outcome: delta value between test 2 and test 3 for iTELL vs non-iTELL. (p. 6, 3.2 Test Score Differences, "Delta score between test 2 and test 3")
- Trace/log measures: focus time, clickstream events (scrolls, chunk reveals, clicks), constructed response outputs, and summary scores. (p. 4, 2.5 iTELL Data Extraction, "focus time, click-stream"; p. 5, 2.5.4 Summaries, "average score")

### Analysis methods (stats/tests/models) only if explicitly stated

- Survey: descriptive stats/plots plus follow-up ANOVAs across ethnicity/reading frequency. (p. 5, 3.1 User Survey Data, "conducted follow up ANOVAs")
- Delta test-score difference: Mann–Whitney U test due to non-normality; reports p-value, U, Cliff’s Delta and CI; post-hoc t-test after removing ceiling-zero deltas. (p. 6, 3.2 Test Score Differences, "Mann-Whitney U test"; p. 6, 3.2 Test Score Differences, "Cliff’s Delta")
- Prediction: stepwise linear regression predicting delta from iTELL predictors including baseline proficiency category. (p. 5, 2.6 Analyses, "stepwise linear regression"; p. 6, 3.3 Delta Value Predictions, "Linear model to predict")

### Key results (exact reported numbers)

- Survey: summary-task means generally positive (e.g., feedback accuracy M=4.18; ease understanding M=4.29; “helped them learn” M=4.18), with no significant differences by race/ethnicity or reading frequency. (p. 5, 3.1 User Survey Data, "accuracy of feedback (M = 4.18)"; p. 5, 3.1 User Survey Data, "no significant differences")
- Survey: constructed-response means generally positive (e.g., feedback accuracy M=4.01; ease interaction M=4.32; “helped them learn” M=4.20), with no significant differences by race/ethnicity or reading frequency. (p. 5, 3.1 User Survey Data, "accuracy of feedback (M = 4.01)"; p. 5, 3.1 User Survey Data, "no significant differences")
- Delta comparison (all): iTELL M=0.032 SD=0.304 vs non-iTELL M=-0.018 SD=0.248; Mann–Whitney p=0.067; U=12,386; Cliff’s Delta=0.132 with CI. (p. 6, 3.2 Test Score Differences, "iTELL (M = .032, SD = .304"; p. 6, 3.2 Test Score Differences, "p=0.067; U=12,386")
- Post-hoc after removing ceiling-zero deltas: N=227 (162 non-iTELL, 65 iTELL); t(114.52)=1.426, p=.157; Cohen’s d=.213 with CI. (p. 6, 3.2 Test Score Differences, "sample size to 227"; p. 6, 3.2 Test Score Differences, "t(114.52) = 1.426, p = .157")
- Regression predicting delta (iTELL students): number scrolls estimate -0.099 (t=-3.111**), wording score -0.077 (t=-2.499*), testing level low 0.216 (t=3.382**); model r=.501, R²=.251, F(3,75)=8.362, p<.001. (p. 6, 3.3 Delta Value Predictions, "Number scrolls -0.099"; p. 6, 3.3 Delta Value Predictions, "R2 = .251")

---

## H) Limitations and failure modes

- Self-selection / convenience sample: students were rewarded with extra credit and likely volunteered non-randomly, producing self-selection bias. (p. 7, 4 Discussion and conclusion, "convenience sample"; p. 7, 4 Discussion and conclusion, "self-selection bias")
- Data logging bug: constructed response logging failed for many items; over half of page-level constructed response data missing in that sense (130/395 pages). (p. 4, 2.5.3 Constructed Responses, "bug in the code"; p. 4, 2.5.3 Constructed Responses, "130 of those pages")
- Missing sandbox logs: no Python sandbox data was logged, limiting tool-effect disaggregation. (p. 7, 4 Discussion and conclusion, "no data from the Python sandbox"; p. 5, 2.5.5 Python IDE, "not implemented")
- Imbalanced and smaller iTELL sample vs non-iTELL reduces generalizability. (p. 7, 4 Discussion and conclusion, "relatively small sample size"; p. 3, 2.3 Participants and Procedure, "121 students elected")
- High variation: standard deviations for delta values are large, indicating wide variation in learning gains. (p. 7, 4 Discussion and conclusion, "standard deviation was quite high")
- Population limitation: students come from a technical background (technical university), which may affect outcomes. (p. 7, 4 Discussion and conclusion, "technical background")

---

# PROJECT RELEVANCE

## I) Where this overlaps with our project (“What’s already been done that is similar?”)

| Paper feature/idea | Evidence (citation) | Closest match to our project component | Notes on mapping to SQL learning (grounded to paper feature) |
|---|---|---|---|
| Convert static text into interactive units (pages/chunks) | (p. 2, 1 Introduction continuation, "converts any type of machine-readable text") | 2) intelligent/adaptive textbook artifact | Could mirror “page/chunk” units as note units keyed to SQL concepts/errors. (p. 3, 2.2 Textbook, "separated into chunks") |
| Read-to-write tasks: constructed responses + summaries | (p. 2, 1.2 iTELL, "complete at least one constructed response"; p. 2, 1.2 iTELL, "submit a summary") | 4) reflective/accumulative learning artifacts | Similar to reflective “My Notes” entries after SQL attempts (e.g., short explanation + summary). (p. 2, 1.2 iTELL, "provide feedback to readers") |
| Trace logging: focus time + clickstream (scrolls/clicks) | (p. 2, 1.2 iTELL, "logs the observation time"; p. 4, 2.5.2 Events, "when scrolling") | 5) trace-to-content mapping / learning-from-logs | Directly analogous to using SQL traces (time/retries/hint-use) to select what to surface. (p. 5, 2.6 Analyses, "click-stream data, focus time") |
| Automated scoring + qualitative feedback from LLMs | (p. 2, 1 Introduction continuation, "scored automatically by large language models"; p. 2, 1 Introduction continuation, "inform qualitative feedback") | 1) adaptive instructional content beyond hints | Similar to generating short targeted explanations when SQL traces show struggle, then storing as a note unit. (p. 2, 1 Introduction continuation, "correct misconceptions") |
| Event-driven gating: chunk reveal + must-answer-to-proceed | (p. 3, 2.2 Textbook, "blurred"; p. 4, 2.5.3 Constructed Responses, "before proceeding to the next chunk") | 3) escalation from hints to explanations | Analog could be “attempt first, then unlock deeper explanation if repeated errors,” without interrupting too early. (p. 4, 2.5.3 Constructed Responses, "required to submit") |

## J) Where the paper falls short for our needs

- It evaluates an iTELL reading volume + writing tasks, but does not describe adapting instructional content from problem-solving error traces (e.g., SQL error types/retries) as the primary driver. (p. 5, 2.6 Analyses, "click-stream data, focus time, and summary scores")
- The key learning comparison is not randomized; students volunteered for extra credit, and the paper flags self-selection bias and calls for an RCT. (p. 7, 4 Discussion and conclusion, "self-selection bias"; p. 7, 4 Discussion and conclusion, "randomized control trial is needed")
- Important trace streams are missing due to logging issues (constructed response bug; no Python sandbox logs), limiting fine-grained trace-to-outcome attribution. (p. 7, 4 Discussion and conclusion, "over half of the items not being logged"; p. 7, 4 Discussion and conclusion, "no data from the Python sandbox")

## K) How our idea is different

- Our idea differs because adaptation is driven primarily by problem-solving traces (SQL errors/retries/hint use), whereas this paper emphasizes reading clickstream/focus time plus constructed-response/summary scores. (p. 5, 2.6 Analyses, "click-stream data, focus time, and summary scores")
- Our idea differs because we plan inspectable escalation rules from hints → explanations → reflective notes; this paper describes gating and feedback pipelines but not a general escalation ladder framed that way. (p. 4, 2.5.3 Constructed Responses, "required to submit"; p. 2, 1 Introduction continuation, "guide learning")
- Our idea differs because we plan offline replay comparisons among strategies on the same trace logs; this paper reports classroom A/B-style comparisons and regression predictors. (p. 6, 3.2 Test Score Differences, "Mann-Whitney U test"; p. 6, 3.3 Delta Value Predictions, "Linear model to predict")

## L) Actionable “steal-this” design patterns

### Chunk reveal gating to enforce stepwise reading

- Chunk reveal gating to enforce stepwise reading  
- What it does: hides later chunks until the learner reveals them, producing clear interaction events and pacing. (p. 3, 2.2 Textbook, "all subsequent chunks being blurred")  
- How to implement for SQL notes: keep deeper explanations collapsed until after an attempt (or repeated failure), logging “reveal” events as engagement signals. (p. 4, 2.5.2 Events, "chunk reveal events")

### Probabilistic prompt injection with minimum per page

- Probabilistic prompt injection with minimum per page  
- What it does: each chunk has a 1/3 chance to spawn a constructed response item, with at least one per page. (p. 4, 2.5.3 Constructed Responses, "1/3 chance"; p. 4, 2.5.3 Constructed Responses, "minimum of one")  
- How to implement for SQL: sample reflective prompts (“explain your WHERE clause”) but ensure at least one reflective check per concept/session. (p. 2, 1.2 iTELL, "complete at least one")

### Must-answer-to-proceed checkpoints

- Must-answer-to-proceed checkpoints  
- What it does: requires at least one response to a spawned item before continuing. (p. 4, 2.5.3 Constructed Responses, "required to submit at least one response")  
- How to implement for SQL: require a brief rationale after multiple failed attempts before showing the full worked explanation, keeping it reflective. (p. 2, 1 Introduction continuation, "used ... to guide learning")

### Filter → score pipeline for learner-written summaries

- Filter → score pipeline for learner-written summaries  
- What it does: enforces length/language constraints, blocks copy/paste, then computes borrowing/relevance before content/wording scores. (p. 4, 2.5.4 Summaries, "between 50 and 200 words"; p. 4, 2.5.4 Summaries, "Language Borrowing")  
- How to implement for SQL notes: validate “My Notes” entries for minimal length and relevance to the query/error before storing them as durable units. (p. 5, 2.5.4 Summaries, "average score they received")

### Use scroll/focus signals as predictors for who benefits

- Use scroll/focus signals as predictors for who benefits  
- What it does: uses scroll count and proficiency to predict delta score gains (and uses focus/clickstream as candidate predictors). (p. 6, 3.3 Delta Value Predictions, "Number scrolls"; p. 5, 2.6 Analyses, "focus time, and summary scores")  
- How to implement for SQL: test whether retries/time/hint use predict who benefits from adaptive notes; use that to tune escalation thresholds. (p. 5, 2.6 Analyses, "predictors of the delta values")

---

## M) Final takeaway

- This paper reports a classroom deployment of iTELL where a programming textbook unit is converted into an interactive, chunked reading experience with constructed response questions and page summaries that receive automated scoring and feedback. (p. 2, 1 Introduction continuation, "interactive, intelligent text"; p. 4, 2.5.4 Summaries, "receive a score")
- Students responded positively in surveys, and the authors report small learning-gain differences (test 2→test 3 deltas) plus evidence that behaviors like scrolling and prior proficiency relate to gains, while also noting limitations like self-selection and missing logs. (p. 5, 3.1 User Survey Data, "mean responses were generally positive"; p. 6, 3.2 Test Score Differences, "Cliff’s Delta = .132"; p. 7, 4 Discussion and conclusion, "self-selection bias")

# Paper 3

## Instruction-fit notes

- Page numbers are visible (p. 1–10), so citations can use p. X consistently. (p. 1, Footer, "Leveraging Large Language Models for Next Generation")
- This paper is primarily about an NLP/LLM pipeline (question generation + constructed-response scoring) that plugs into an intelligent-text system, so it’s inherently “mechanism-heavy.” (p. 1, Abstract, "create a Natural Language Processing (NLP) pipeline")
- The paper still contains content-organization/adaptation elements (chunks, random deployment, gating, feedback options, future trigger ideas), so the “content architecture + IF–THEN” framing is applicable. (p. 5, 5.1.2 Integrating Constructed Responses, "only the first chunk is visible")

---

## A) Full citation

- Wesley Morris, Joon Suh Choi, Langdon Holmes, Vaibhav Gupta, and Scott Crossley. (p. 1, Author block, "Wesley Morris")
- Automatic Question Generation and Constructed Response Scoring in Intelligent Texts. (p. 1, Title, "Automatic Question Generation and Constructed")
- Venue/date/location line: Leveraging Large Language Models for Next Generation Educational Technologies, July 14, 2024, Atlanta, Georgia, USA. (p. 1, Footer, "July 14, 2024, Atlanta, Georgia, USA")
- Publication info: CEUR Workshop Proceedings (ceur-ws.org), ISSN 1613-0073; CC BY 4.0. (p. 1, Footer, "CEUR Workshop Proceedings"; p. 1, Footer, "Creative Commons License Attribution 4.0")

---

## B) Summary

- The paper builds and tests a pipeline that automatically generates short-answer questions (and reference answers) from textbook “chunks,” then scores students’ constructed responses and provides feedback inside an intelligent-text system (iTELL). (p. 1, Abstract, "generating questions and scoring short constructed responses"; p. 1, Introduction, "pipeline can be divided into three parts")
- They report that GPT-3.5 produced coherent questions and correct reference answers in their generation study, and that a two-model encoder ensemble (MPNet + BLEURT) is used for fast, automated scoring with a 0/1/2 score and feedback messages. (p. 3, 3.2 Results, "generated questions ... coherent"; p. 4, 4.2 Results, "consensus voting ensemble")
- In a trial deployment with students using iTELL, most inline feedback and survey responses were positive, but negative feedback focused on scoring accuracy and unclear feedback. (p. 6, 5.2 Results, "75.4% ... positive"; p. 7, 6. Discussion, "majority had to do with the accuracy")

---

## C) Section-by-section reading

### Abstract

- Motivation: constructed responses help learning but are hard to create and time-consuming to score; the paper explores automating both with LLMs. (p. 1, Abstract, "difficult to create and time-consuming to score")
- Contribution: an NLP pipeline for automatic question generation and constructed-response scoring as part of an intelligent-text framework (iTELL). (p. 1, Abstract, "pipeline ... component of a larger framework")
- Key findings preview: GPT-3.5 works for question + reference answer generation; scoring uses BLEURT and MPNet; users report positive experiences but suggest improvements. (p. 1, Abstract, "GPT-3.5 is effective"; p. 1, Abstract, "participants report positive experiences")

### 1. Introduction

- Defines constructed response items as open-ended responses used for comprehension and “active processing,” but costly to score. (p. 1, 1. Introduction, "open-ended response"; p. 1, 1. Introduction, "can take considerable time")
- Positions recent LLM advances as enabling scalable generation/scoring of these items. (p. 1, 1. Introduction, "possibility of generating and scoring")
- Describes iTELL: converts static texts into an interactive, dynamically personalized intelligent text with features like annotation, summary writing (scored), Python exercises, and constructed responses. (p. 1, 1. Introduction, "interactive and dynamically personalized"; p. 1, 1. Introduction, "annotation and highlighting")
- States pipeline requirements: question generation must allow human-in-the-loop review; scoring should be fully automated and run locally for privacy/cost. (p. 1, 1. Introduction, "opportunity for human intervention"; p. 3, 4.1.1 Dataset, "run locally")
- Summarizes pipeline stages: generate questions/answers → editor review → automated scoring of student responses. (p. 1, 1. Introduction, "divided into three parts")

### 2. Background

- Explains the “generation effect” idea: constructing knowledge improves memory/learning, motivating constructed-response tasks. (p. 2, 2. Background, "memory is improved through construction")
- Reviews prior work: question type matters; constructed response can elicit higher-level processing than multiple choice; question generation history exists but scoring has been costly. (p. 2, 2. Background, "question type"; p. 2, 2. Background, "too time-consuming and expensive")
- Positions this paper’s goal as a domain-agnostic pipeline for iTELL (both generation + scoring). (p. 2, 2. Background, "general, domain agnostic pipeline")

### 3. Study 1: Constructed Response Generation

- Setup: content editor segments pages into “chunks,” stores them; some chunk types (objectives/glossaries/exercises) are excluded from CR generation. (p. 2, 3.1 Method, "segments each page ... into 'chunks'"; p. 2, 3.1 Method, "disregarded")
- Method: sample 20 subsections; generate recall/summary/inference questions (60 total) with GPT-3.5; human-rate question quality and type; rate reference answers correctness. (p. 2–3, 3.1 Method, "randomly sampled 20 subsections"; p. 3, 3.1 Method, "generated sixty questions")
- Results: questions coherent/relevant in 100% cases, but 35% wrong type; answers all correct; decision: use GPT-3.5 but do not request a specific question type. (p. 3, 3.2 Results, "100% of cases"; p. 3, 3.2 Results, "35% (n = 21)"; p. 3, 3.2 Results, "prompt ... without specifying")

### 4. Study 2: Automatic Scoring of Constructed Responses

- Dataset: trains scoring models on MultiRC; explains why broad sources support “content agnostic” goal; uses 70/15/15 split on sources. (p. 3, 4.1.1 Dataset, "MultiRC dataset"; p. 3, 4.1.1 Dataset, "broad nature"; p. 3, 4.1.1 Dataset, "70/15/15")
- Motivation for local scoring: GPT scoring raises privacy/interpretability concerns and cost; local scoring protects potential PII in responses. (p. 3, 4.1.1 Dataset, "concerns around privacy"; p. 3, 4.1.1 Dataset, "personally identifying information")
- Two strategies: (a) context-aware (source+question+answer), (b) context-independent (distill reference answer then compare with student answer). (p. 3, 4.1.2 Model Selection, "context-aware"; p. 3, 4.1.2 Model Selection, "context-independent")
- Results: best accuracy was LLaMa2 (.85) but too slow; MPNet (.81) and BLEURT (.79) faster; adversarial weaknesses differ; choose consensus ensemble MPNet+BLEURT. (p. 4, 4.2 Results, "accuracies of .85"; p. 4, 4.2 Results, "MPNET ... 0.81"; p. 4, 4.2 Results, "consensus voting ensemble")
- Scoring rule implemented in iTELL: models agree correct → score 2; agree incorrect → score 0; disagree → score 1 with “likely correct” message and revise suggestion. (p. 4, 4.2 Results, "records a score of 0"; p. 4, 4.2 Results, "records a score of 2"; p. 4, 4.2 Results, "records a score of 1")

### 5. Efficacy Testing

- Integrates pipeline into iTELL; GPT-3.5 generates questions/answers once during content prep and stores them in a database; runtime scoring uses the selected models. (p. 5, 5. Efficacy Testing, "This happens only once"; p. 5, 5. Efficacy Testing, "saved to a database")
- Content: adapts Think Python chapters; pages divided into chunks; excludes exercises/objectives; questions checked by hand. (p. 5, 5.1.1 Generating Intelligent Text, "Think Python"; p. 5, 5.1.1 Generating Intelligent Text, "checked by hand")
- UI/mechanics: blurred chunks until “reveal” clicks; one-third of chunks show a constructed response; must attempt before moving on; if incorrect, can reveal answer, skip, or revise/resubmit; inline thumbs up/down feedback with tags and optional text. (p. 5, 5.1.2 Integrating Constructed Responses, "rest of the page is blurred"; p. 5, 5.1.2 Integrating Constructed Responses, "required to attempt an answer")
- Participants: 139 students invited; 98 consented (18+); extra credit; outtake survey reliability α=0.95 with CI. (p. 5, 5.1.3 Data Collection, "139 students"; p. 5, 5.1.3 Data Collection, "98 indicated"; p. 6, 5.1.3 Data Collection, "α = 0.95")
- Outcomes: 2,733 responses; score distribution (2: 64%, 0: 19.3%, 1: 16.7%); no significant trend over chunk index; inline feedback mostly positive but negative focused on inaccurate feedback; survey shows majorities agree task helped learning/easy/relevant/accurate. (p. 6, 5.2 Results, "produced 2,733"; p. 6, 5.2 Results, "64% (n = 1,749)"; p. 6, 5.2 Results, "no significant effect")

### 6. Discussion

- Reiterates main outcomes: GPT-3.5 generates sensible questions/answers but struggles to control question type; suggests future improvements via prompting or newer models. (p. 7, 6. Discussion, "performed no better than random chance"; p. 7, 6. Discussion, "different prompting strategies")
- Justifies model choice: LLaMa2 accuracy vs latency tradeoff; ensemble chosen due to different adversarial failure modes. (p. 7, 6. Discussion, "unacceptably increased feedback latency"; p. 7, 6. Discussion, "different error profiles")
- User experience: generally positive; negatives mostly about accuracy; requests include more complex questions, more frequency/variety, clearer guidance/hints when wrong. (p. 7, 6. Discussion, "more than four fifths"; p. 7, 6. Discussion, "provide more clear formative feedback")

### 7. Conclusion

- Claims pipeline is sufficient for integration into learning technologies like iTELL and supports the generation-effect rationale for interaction/learning. (p. 7, 7. Conclusion, "sufficient for integration"; p. 7, 7. Conclusion, "will contribute to the generation effect")
- Lists limitations and future work: needs stronger evidence on learning outcomes; plans RCT A/B (with/without constructed responses). (p. 8, 7. Conclusion continuation, "further evaluate the impact"; p. 8, 7. Conclusion continuation, "randomized controlled trials")
- Notes limitations of feedback explanations: current model can’t explain why wrong; proposes using generative LLMs for step-by-step hints. (p. 8, 7. Conclusion continuation, "not capable of clearly explaining"; p. 8, 7. Conclusion continuation, "giving hints or suggestions")
- Notes deployment strategy limitation: one-third random chunk deployment may not be optimal; suggests using reading behavior or summary similarity to choose where to require questions. (p. 8, 7. Conclusion continuation, "deploys the questions randomly"; p. 8, 7. Conclusion continuation, "analyzing reading behavior")

---

## D) System explained

### What the learner sees (UI/components)

- An iTELL page where only the first chunk is visible and subsequent chunks are blurred until revealed. (p. 5, 5.1.2 Integrating Constructed Responses, "only the first chunk is visible")
- Occasional constructed-response questions embedded during reading (one-third of chunks, random). (p. 5, 5.1.2 Integrating Constructed Responses, "On one third of the chunks")
- A scoring/feedback UI that supports thumbs up/down feedback with optional tags and text explanations. (p. 5, 5.1.2 Integrating Constructed Responses, "thumbs up or thumbs down")

### What the learner does (actions)

- Clicks to reveal each next chunk and progresses chunk-by-chunk through the page. (p. 5, 5.1.2 Integrating Constructed Responses, "prompted to click on a button")
- When a question appears, attempts an answer before moving forward. (p. 5, 5.1.2 Integrating Constructed Responses, "required to attempt an answer")
- If told their answer is incorrect, chooses to reveal the correct answer, skip, or revise and resubmit. (p. 5, 5.1.2 Integrating Constructed Responses, "reveal the correct answer, skip")
- Optionally gives inline feedback (thumbs + tags + short explanation). (p. 5, 5.1.2 Integrating Constructed Responses, "select one or more tags")

### What the system observes (signals/logs)

- Student constructed responses and their scores (0/1/2 via ensemble). (p. 5, 5. Efficacy Testing, "student submits their answer"; p. 4, 4.2 Results, "records a score of 0")
- Inline thumbs up/down and tag selections (if provided). (p. 6, 5.2 Results, "167 feedback responses"; p. 6, 5.2 Results, "tags provided")
- (Future trigger candidates suggested) reading behavior like skipping/reading quickly, and similarity between chunks and end-of-chapter summaries. (p. 8, 7. Conclusion continuation, "requiring users to answer"; p. 8, 7. Conclusion continuation, "comparing their similarity")

### What the system outputs (content/feedback/artifacts)

- During content preparation: generates questions and reference correct answers and stores them in a database. (p. 5, 5. Efficacy Testing, "saved to a database")
- During use: returns a score (0/1/2) and feedback message encouraging revise/move on depending on ensemble agreement. (p. 4, 4.2 Results, "student is told"; p. 4, 4.2 Results, "encouraged to revise")

### What persists over time (storage/caching/notebook/history)

- Questions and reference answers are stored in a database after content preparation. (p. 5, 5. Efficacy Testing, "saved to a database")

---

## E) Content architecture

### Units

- Page divided into chunks (several paragraphs on a subtopic) created by a content editor. (p. 2, 3.1 Method, "segments each page ... into 'chunks'")
- Constructed response question + reference correct answer generated per eligible chunk during content preparation. (p. 2, 3.1 Method, "generates constructed response questions"; p. 3, 3.2 Results, "reference answers")
- Student constructed response submitted at runtime and scored. (p. 5, 5. Efficacy Testing, "student submits their answer"; p. 4, 4.2 Results, "scored by")
- Inline feedback metadata: thumbs up/down, tags, short explanation. (p. 5, 5.1.2 Integrating Constructed Responses, "thumbs up or thumbs down")

### Structure

- Page → sequential chunk reveal workflow; chunks are gated (blurred) until revealed. (p. 5, 5.1.2 Integrating Constructed Responses, "rest of the page is blurred")
- Chunk → sometimes prompts a constructed response (random one-third). (p. 5, 5.1.2 Integrating Constructed Responses, "On one third of the chunks")

### Attachment rules

- Some chunk types are excluded (objectives/glossaries/exercises). (p. 2, 3.1 Method, "learning objectives, glossaries, and exercises")
- For remaining chunks, the system generates Q/A during content creation; during reading, questions appear on one-third of chunks. (p. 2, 3.1 Method, "during content creation"; p. 5, 5.1.2 Integrating Constructed Responses, "determined at random")

### Lifecycle

- Create: GPT-3.5 generates questions/answers; content editor reviews/edits (“checked by hand”) and stores to DB. (p. 5, 5.1.1 Generating Intelligent Text, "checked by hand"; p. 5, 5. Efficacy Testing, "saved to a database")
- Show: question inserted at runtime on selected chunks; user must attempt before proceeding. (p. 5, 5.1.2 Integrating Constructed Responses, "presents a constructed response question")
- Evaluate: MPNet+BLEURT ensemble produces 0/1/2 scoring and feedback. (p. 4, 4.2 Results, "consensus voting ensemble"; p. 4, 4.2 Results, "records a score of 1")
- Revise: if incorrect/uncertain, user encouraged to revise; can resubmit. (p. 4, 4.2 Results, "encouraged to revise"; p. 5, 5.1.2 Integrating Constructed Responses, "revise and resubmit")

---

## F) Adaptation mechanics

### Triggers / signals observed

- IF a chunk is selected for question deployment (random one-third), THEN a constructed-response question is presented. (p. 5, 5.1.2 Integrating Constructed Responses, "On one third of the chunks")
- IF a student submits an answer, THEN the answer is scored by the constructed response scoring model (ensemble). (p. 5, 5.1.2 Integrating Constructed Responses, "scored by iTELL’s"; p. 4, 4.2 Results, "consensus voting ensemble")

### Adaptation actions taken

- IF a question is presented, THEN the student must attempt an answer before moving to the next chunk. (p. 5, 5.1.2 Integrating Constructed Responses, "required to attempt an answer")
- IF both models agree the response is incorrect, THEN score=0 and system tells student it is incorrect and encourages revision. (p. 4, 4.2 Results, "records a score of 0"; p. 4, 4.2 Results, "encouraged to revise")
- IF both models agree the response is correct, THEN score=2 and system tells student it is correct and encourages moving to next section. (p. 4, 4.2 Results, "records a score of 2"; p. 4, 4.2 Results, "encouraged to move")
- IF models disagree, THEN score=1 and system says “likely correct” and encourages revision. (p. 4, 4.2 Results, "records a score of 1"; p. 4, 4.2 Results, "likely correct")
- IF the student receives incorrect feedback, THEN UI offers reveal correct answer, skip, or revise/resubmit. (p. 5, 5.1.2 Integrating Constructed Responses, "reveal the correct answer, skip")

### Escalation ladder (hint → explanation → reflection)

- Not stated in provided text (implemented ladder beyond “encourage revise / reveal answer” is not specified as a multi-step policy). (p. 5, 5.1.2 Integrating Constructed Responses, "option to reveal the correct answer")

### Learner-initiated vs system-initiated

- System-initiated: question deployment is random one-third of chunks. (p. 8, 7. Conclusion continuation, "deploys the questions randomly")
- Learner-initiated: learner chooses to skip, reveal answer, or revise/resubmit. (p. 5, 5.1.2 Integrating Constructed Responses, "skip the question")

### Human-in-the-loop controls

- Human-in-the-loop is part of the generation pipeline (review/revision by content editor). (p. 1, 1. Introduction, "review and revision by a content editor")

---

## G) Evaluation

### Setting/context

- System context: pipeline is a component of iTELL, which converts static texts into intelligent texts. (p. 1, Abstract, "component of a larger framework"; p. 7, 6. Discussion, "converting static informative texts")

### Study 1 (Question generation evidence)

- Source: OpenStax Principles of Macroeconomics; 523 subsections; mean length ~333 words. (p. 2, 3.1 Method, "OpenStax"; p. 2, 3.1 Method, "523 subsections")
- Sample: 20 subsections; 3 question types; 60 questions; ratings 0/1/2 for question quality/type; answers rated 0/1. (p. 2–3, 3.1 Method, "randomly sampled 20"; p. 3, 3.1 Method, "generated sixty questions")
- Results: Cohen’s kappa 0.65; 100% coherent/relevant; 35% wrong type; answers all correct; decision to drop explicit type prompts. (p. 3, 3.2 Results, "Cohen’s Kappa of 0.65"; p. 3, 3.2 Results, "100% of cases")

### Study 2 (Scoring evidence)

- Dataset: MultiRC; 456 sources, 5,130 questions, 20,422 answers; 44.1% correct labels; split by sources to avoid leakage. (p. 3, 4.1.1 Dataset, "Sources 456"; p. 3, 4.1.1 Dataset, "44.1%")
- Model results: LLaMa2 accuracy .85; Longformer .71; MPNet .81; BLEURT .79; choose ensemble due to latency + adversarial vulnerabilities. (p. 4, 4.2 Results, "accuracies of .85"; p. 4, 4.2 Results, "weak against")

### Efficacy testing (deployment evidence)

- Content: Think Python first four chapters adapted; chunked pages; Q/A checked by hand. (p. 5, 5.1.1 Generating Intelligent Text, "Think Python"; p. 5, 5.1.1 Generating Intelligent Text, "checked by hand")
- Participants: 139 students invited; 98 consented; 82 outtake survey responses; α=0.95. (p. 5, 5.1.3 Data Collection, "139 students"; p. 6, 5.1.3 Data Collection, "82 provided responses")
- Usage outcomes: 2,733 constructed responses; score distribution 64% score2, 19.3% score0, 16.7% score1; no significant trend in proportions by chunk index. (p. 6, 5.2 Results, "2,733 constructed responses"; p. 6, 5.2 Results, "64% (n = 1,749)")
- UX outcomes: 167 inline feedback items from 38 students; 75.4% positive; negative feedback mostly “inaccurate feedback.” (p. 6, 5.2 Results, "167 feedback responses"; p. 6, 5.2 Results, "inaccurate feedback")
- Survey outcomes: 81.7% agree tasks improved learning; 84.1% easy; 86.6% relevant; 73.1% accurate scoring. (p. 6, 5.2 Results, "81.7% (n = 67)"; p. 6, 5.2 Results, "73.1% (n = 60)")

---

## H) Limitations and failure modes

- Limitation: this is preliminary; they need further evaluation of learning-outcome impact. (p. 8, 7. Conclusion continuation, "considered preliminary work")
- Limitation: model feedback and accuracy concerns—system cannot clearly explain why an answer failed. (p. 8, 7. Conclusion continuation, "not capable of clearly explaining")
- Limitation: random one-third question deployment likely not optimal; future work should use behavioral signals or chunk difficulty to decide deployments. (p. 8, 7. Conclusion continuation, "unlikely to be the optimal strategy")
- Limitation: current scoring compares student answer to a distilled reference answer; may work for lower-order skills but not for higher-order inference/logic beyond the text. (p. 8, 7. Conclusion continuation, "may work for lower order"; p. 8, 7. Conclusion continuation, "higher order thinking")

---

# PROJECT RELEVANCE

## I) Where this overlaps with our project (“What’s already been done that is similar?”)

| Paper feature/idea | Evidence (citation) | Closest match to our project component | Notes on mapping to SQL learning |
|---|---|---|---|
| Chunk-level content units created during content prep | (p. 2, 3.1 Method, "segments each page ... into 'chunks'") | 2) intelligent/adaptive textbook artifact | Treat SQL concepts/FAQ snippets as “chunks” attachable to tasks/errors. |
| Automated generation of questions + reference answers (with editor review) | (p. 5, 5. Efficacy Testing, "generate questions and correct"; p. 1, 1. Introduction, "review and revision") | 1) adaptive instructional content beyond hints | Generate “check-understanding” prompts for SQL concepts and store them as reusable units. |
| Runtime scoring + feedback + revise loop | (p. 4, 4.2 Results, "encouraged to revise"; p. 5, 5.1.2, "revise and resubmit") | 3) escalation from hints to explanations | Use scoring to decide when to keep hint-level vs escalate to deeper explanation. |
| Inspectable scoring rule (0/1/2) based on ensemble agreement | (p. 4, 4.2 Results, "records a score of 0"; p. 4, 4.2 Results, "records a score of 1") | 5) trace-to-content mapping / learning-from-logs | Similar to using multiple signals (error type + retries + time) to compute confidence and decide actions. |
| Future idea: deploy questions based on behavior (skip/fast read) or summary similarity | (p. 8, 7. Conclusion continuation, "analyzing reading behavior"; p. 8, 7. Conclusion continuation, "assigning readers") | 5) trace-to-content mapping / learning-from-logs | Direct analog: use SQL traces (rapid guessing, repeated syntax errors) to trigger targeted practice or notes. |

## J) Where the paper falls short for our needs

- Persistent learner-facing notebook (“My Notes/My Textbook”) with dedup/reordering is not described; only Q/A storage is mentioned. (p. 5, 5. Efficacy Testing, "saved to a database")
- Escalation is limited to short feedback and options (revise/reveal/skip); a structured escalation ladder (hint → explanation → reflective artifact) is suggested as future work but not implemented as a policy. (p. 5, 5.1.2, "reveal the correct answer"; p. 8, 7. Conclusion continuation, "giving hints or suggestions")

## K) How our idea is different

- Our idea differs because… we aim to produce a persistent, reorganized “My Notes/My Textbook” artifact across many SQL attempts, while this paper focuses on constructed-response questions embedded in text chunks (with Q/A stored to a DB). (p. 5, 5. Efficacy Testing, "saved to a database")
- Our idea differs because… our primary triggers come from problem-solving traces (SQL errors/retries/hint use), whereas this system currently deploys questions randomly and only suggests behavior-based deployment as future work. (p. 8, 7. Conclusion continuation, "deploys the questions randomly")
- Our idea differs because… we plan policy comparisons via offline replay over logs; this paper proposes future RCTs but does not present offline replay. (p. 8, 7. Conclusion continuation, "randomized controlled trials")
- Our idea differs because… we plan offline replay comparisons among strategies on the same trace logs; this paper proposes future RCTs but does not present offline replay. (p. 8, 7. Conclusion continuation, "randomized controlled trials")

---

## L) Actionable “steal-this” design patterns

### Chunked content + gated reveal for pacing + logging

- Chunked content + gated reveal for pacing + logging  
- What it does: shows content in chunks and gates progression, producing clean interaction checkpoints. (p. 5, 5.1.2 Integrating Constructed Responses, "rest of the page is blurred")

### Three-way confidence scoring from model agreement (0/1/2)

- Three-way confidence scoring from model agreement (0/1/2)  
- What it does: turns uncertain model cases into an intermediate state (“likely correct”) rather than binary. (p. 4, 4.2 Results, "records a score of 1")  
- How to implement in SQL: combine multiple signals (parser error type + retries + time) into low/medium/high confidence for whether a learner “gets it,” then choose hint vs explanation vs reflective note.

### Revise loop with explicit options (revise / reveal / skip)

- Revise loop with explicit options (revise / reveal / skip)  
- What it does: gives learners agency after feedback instead of forcing one path. (p. 5, 5.1.2 Integrating Constructed Responses, "reveal the correct answer, skip")  
- How to implement in SQL: after repeated errors, offer “Try again,” “Show worked solution,” or “Add to My Notes,” and record which path they choose.

### Behavior-aware deployment as a future adaptive trigger

- Behavior-aware deployment as a future adaptive trigger  
- What it does: suggests moving from random deployments to trace-driven deployments (skip/fast read; chunk-summary mismatch). (p. 8, 7. Conclusion continuation, "requiring users to answer"; p. 8, 7. Conclusion continuation, "similarity with the summaries")  
- How to implement in SQL: trigger targeted practice or a note snippet when traces show skipping hints, rapid retries, or repeated same error.

### Inline feedback tagging for debugging feedback quality

- Inline feedback tagging for debugging feedback quality  
- What it does: collects thumbs up/down plus tags to categorize feedback issues (accuracy, clarity, etc.). (p. 5, 5.1.2 Integrating Constructed Responses, "select one or more tags")  
- How to implement in SQL: collect “helpfulness” + reason tags (“too vague,” “wrong,” “too long”) for generated notes/hints to iterate policies.

---

## M) Final takeaway

- This paper demonstrates a concrete way to add constructed-response practice into an intelligent textbook by chunking content, generating questions and reference answers during authoring, then scoring student answers automatically and providing feedback with a revise loop. (p. 1, Abstract, "automatically generating questions"; p. 5, 5. Efficacy Testing, "saved to a database"; p. 5, 5.1.2, "revise and resubmit")
- It also highlights practical tradeoffs that matter for adaptive textbook systems: privacy/cost push toward local scoring, feedback latency matters for uptake, and “random deployment” is a baseline that the authors expect to improve by using behavioral signals in future adaptations. (p. 3, 4.1.1 Dataset, "run locally"; p. 4, 4.2 Results, "feedback latency"; p. 8, 7. Conclusion continuation, "unlikely to be the optimal")

# Paper 4

## Instruction-fit notes

- Page numbers and section headings are visible (p. 1–22), so the required citation format is feasible throughout. (p. 1, Abstract, "This study develops Natural Language Processing models")
- This paper is primarily about how to score summaries + generate formative feedback inside an intelligent textbook (iTELL), so “content architecture” is centered on end-of-section summary artifacts and their feedback pipeline. (p. 2, Introduction, "students can write summaries directly")
- Adaptation is present as gating + revision prompts (e.g., rewriting required before moving on when below threshold), not as a multi-step “hint → explanation” ladder. (p. 16, Application, "asked to rewrite their summary before moving on")

---

## A) Full citation

- Morris, W., Crossley, S., Holmes, L., Ou, C., Dascalu, M., & McNamara, D. (2025). Formative Feedback on Student-Authored Summaries in Intelligent Textbooks Using Large Language Models. International Journal of Artificial Intelligence in Education, 35, 1022–1043. (p. 1, Header, "International Journal of Artificial Intelligence in Education (2025)")
- DOI: 10.1007/s40593-024-00395-0. (p. 1, Header, "<https://doi.org/10.1007/s40593-024-00395-0>
")
- Acceptance/publication metadata: Accepted 5 Feb 2024; Published online 28 Mar 2024. (p. 1, Header, "Accepted: 5 February 2024")

---

## B) Summary

- The paper develops LLM-based models that automatically score student-written end-of-section summaries in an intelligent textbook and uses those scores to produce qualitative formative feedback for learners. (p. 1, Abstract, "provide feedback to students about the quality")
- They compress a 7-criterion human rubric into two dimensions (Content and Wording) using PCA, then train encoder-only LLMs (not generative chat) to predict those dimensions, reporting stronger performance when the model includes both summary + source text. (p. 1, Abstract, "two principal components – content and wording"; p. 11, Results, "both the summary and the source")

---

## C) Section-by-section reading

### Abstract

- The motivation is to make intelligent textbooks more interactive by having students generate knowledge (summaries) and receiving feedback on that output. (p. 1, Abstract, "ask students to generate knowledge")
- The technical contribution is automated feedback on summary quality using LLM-based scoring models. (p. 1, Abstract, "automatically provide feedback")
- The paper reports PCA-based score distillation into Content/Wording and model performance in explained variance (R²), plus a robustness test on Prolific data. (p. 1, Abstract, "principal component analysis"; p. 1, Abstract, "dataset ... Prolific")
- The models are released publicly (HuggingFace) and intended to support real-time formative feedback in intelligent textbooks. (p. 1, Abstract, "freely available on HuggingFace")

### Introduction

- Intelligent textbooks are framed as growing in popularity, with advantages like multimedia and interactive features, and the paper argues an intelligent textbook should be interactive and adaptive to user needs. (p. 2, Introduction, "should be interactive and adapt")
- The work is explicitly part of iTELL, described as converting machine-readable text into an interactive web app where students write summaries and receive LLM-driven feedback. (p. 2, Introduction, "iTELL converts any type of machine-readable text")
- The goal is to report automated summary evaluation models integrated into iTELL and describe how feedback is provided to users. (p. 2, Introduction, "goal of this current study is to report")
- The paper positions models as helping learners reflect, correct misconceptions, review missed topics, and prepare for upcoming materials (as described by the authors). (p. 2, Introduction, "reflect on and guide their learning")

### Related Work — Intelligent Textbooks

- The paper sketches historical roots (hypertext; early web-based interactive textbooks like ELM-ART) and more recent behavior-mining/adaptive recommendation approaches. (p. 3, Related Work, "hypertext"; p. 3, Related Work, "ELM-ART")
- It notes intelligent textbooks can use learner behavior (e.g., comprehension question failure) to adaptively recommend remedial material. (p. 3, Related Work, "remediate comprehension gaps")
- It describes additional NLP-enabled structures like semantic maps and embedded question generation in intelligent textbooks. (p. 4, Related Work, "construct semantic maps"; p. 4, Related Work, "question generation tools")

### Related Work — Summarization and Reading Comprehension

- Summarization is presented as both a learning tool and a reading comprehension assessment, with writing framed as increasing cognitive demands and knowledge reconstruction. (p. 4, Summarization and Reading Comprehension, "actively reconstruct knowledge")
- The scaling problem is instructor time: feedback on summaries is time-consuming, motivating automated approaches. (p. 4, Summarization and Reading Comprehension, "time-consuming for educators")

### Related Work — Automated Summary Evaluation

- Earlier automated evaluation compared to reference summaries (e.g., word/phrase overlap) but requires expert reference summaries and is impractical for iTELL-generated textbooks. (p. 4–5, Automated Summary Evaluation, "require the use of reference summaries")
- The paper motivates using LLM approaches and references prior work (in-paper) that predicts summary scores from rubric-derived labels. (p. 5, Automated Summary Evaluation, "With the rise of LLMs")

### Current Study

- The paper states it expands prior work by (1) reducing rubric scores into two PCA components and (2) testing domain adaptation effects. (p. 5, Current Study, "consolidated the scores into two principal components")

### Methods

- Four datasets are used: a labeled training set, Commonlit for domain adaptation, and two post-hoc test sets (OpenStax textbook summaries and Prolific participant summaries). (p. 5, Methods, "Four different datasets")
- Table 1 lists dataset roles and sizes (sources + summary counts). (p. 5, Methods, "Table 1 List of datasets")

### Data

- The training corpus contains 4,690 summaries across 101 source texts, collected 2018–2021 from multiple sources (e.g., Mechanical Turk, undergraduates, high school). (p. 6, Data, "comprises 4,690 summaries")
- The sources cover diverse academic topics, and the summaries average ~75 words (with mean/SD reported). (p. 6, Data, "average of 75.18 words")
- The authors describe cleaning/normalization as a major step and state they ensured each summary matched one properly formatted source. (p. 6, Data, "cleaning and normalization")

### Summary Scoring (human rubric + reliability)

- Two expert raters score each summary using a 0–4 analytic rubric with 7 criteria (main point/gist, details, language beyond source, paraphrasing/wording, objective language, cohesion, length). (p. 6, Summary Scoring, "0–4 scaled analytic rubric")
- Raters are normed and reliability targets are described (including reported final reliability thresholds). (p. 6–7, Summary Scoring, "Final inter-rater reliability was acceptable")

### Dimensionality Reduction (PCA)

- PCA is chosen to reduce seven rubric criteria into fewer constructs instead of training many models or a multitask model. (p. 7, Dimensionality Reduction, "conduct a principal component analysis")
- A 2-component solution is selected and explained (Content vs Wording), with text length removed. (p. 8, Dimensionality Reduction, "The first component was related to Content")

### Summary Scoring Model (LLMs + training)

- Two encoder-only models are tested: RoBERTa (summary-only due to token limit) and Longformer (summary + source possible due to longer sequence length). (p. 3, Introduction, "predict scores based only on the summary"; p. 9, Summary Scoring Model, "max sequence length from 512 tokens to 4,096")
- Longformer attention is modified by giving global attention to the entire summary and shortening the sliding window to conserve compute (as claimed). (p. 9, Summary Scoring Model, "global attention for the entire summary")
- Data splits and training setup (train/val/test sizes; epochs; batch size; learning rate; MSE) are specified. (p. 10, Summary Scoring Model, "We trained each model for six epochs")

### Post-Hoc Analysis

- Post-hoc validity is tested with OpenStax Macroeconomics 2e professional summaries (matched vs mismatched pairing), plus a Prolific study collecting 113 summaries from 60 participants with human scoring. (p. 10–11, Post-Hoc Analysis, "Openstax website"; p. 11, Post-Hoc Analysis, "recruit 60 participants")

### Results

- The paper reports that including source text (Longformer) improves explained variance (R²) over summary-only (RoBERTa), presented in Table 4. (p. 11, Results, "achieved higher accuracy"; p. 11, Table 4, "Longformer (pretrained)")
- Domain adaptation helps RoBERTa slightly but hurts Longformer relative to non-domain-adapted Longformer (as reported). (p. 12, Domain Adaptation, "performed worse than the non-domain adapted")
- Post-hoc matched vs unmatched professional summaries differ significantly with large effect sizes (reported), and Prolific generalization is strong for Content but weaker for Wording. (p. 13, Post-hoc Tests, "statistically significant (p<.001)"; p. 13, Post-hoc Tests, "Wording ... r(123)=0.29")

### Discussion

- The paper argues performance gains vs prior work likely come from cleaned training data and PCA aggregation into Content/Wording. (p. 14, Discussion, "result of using cleaned training data")
- It interprets Longformer’s advantage as coming from longer input and access to source + summary, especially for Wording. (p. 14, Discussion, "source divided by a separator token")
- It explains the mixed domain adaptation result as possibly due to Commonlit having many summaries but only six sources, risking overfitting/catastrophic forgetting (as framed). (p. 14, Discussion, "only included six sources"; p. 14, Discussion, "catastrophic forgetting")

### Application

- The models are integrated into iTELL with a filter-and-feedback pipeline that enforces length, topic similarity, low copying, and non-offensive language before scoring. (p. 15, Application, "summaries go through a filter component")
- Users receive written qualitative feedback (not numeric scores), and below-threshold summaries trigger rewrite prompts before moving on. (p. 16, Application, "user receives written qualitative feedback"; p. 16, Application, "asked to rewrite")
- Keyphrases missing from the summary are surfaced using KeyBART and learners are directed to paragraphs/subsections to revise. (p. 16, Application, "key phrases ... using KeyBART")

### Conclusion

- The paper concludes Content scoring is strong enough for iTELL inclusion (especially Longformer), while Wording needs more validation on real-world textbook data. (p. 17, Conclusion, "Content models were strong enough")
- It lists limitations: transfer to target domains, need to test whether feedback increases learning, and interpretability / need for granular actionable explanations. (p. 17, Conclusion, "more testing in target domains"; p. 17, Conclusion, "feedback ... should explain")

### Appendix A

- The paper provides the scoring rubric used for human ratings (criteria and level descriptors). (p. 18, Appendix A, "Appendix A – Scoring Rubric")

---

## D) System explained

### What the learner sees (UI/components)

- An intelligent textbook section with a place to write an end-of-section summary inside the application. (p. 2, Introduction, "write summaries directly in the application")
- Written qualitative feedback about summary quality along dimensions including Content/Wording and additional checks (e.g., topic similarity/borrowing), illustrated in a screenshot figure. (p. 16, Application, "user receives written qualitative feedback"; p. 16, Application, "Figure 5 displays a screenshot")
- A list of key phrases from the source text missing in the learner’s summary, plus guidance to specific paragraphs/subsections. (p. 16, Application, "provided with a list of key phrases")

### What the learner does (actions)

- Writes a summary at the end of a textbook section (no cut-and-paste allowed). (p. 15, Application, "students cannot cut and paste")
- If prompted due to low scores, revisits the section and rewrites the summary before moving on. (p. 16, Application, "rewrite their summary before moving on")

### What the system observes (signals/logs)

- The submitted summary text and the corresponding source text for scoring (for Longformer variants). (p. 10, Summary Scoring Model, "summary and the source text ... concatenated")
- Filter signals: word count, topic similarity (Doc2Vec), n-gram overlap borrowing score, and offensive language detection. (p. 15, Application, "between 50 and 200 words"; p. 15, Application, "semantic similarity measure using Doc2Vec")

### What the system outputs (content/feedback/artifacts)

- Predicted scores for Content and Wording are computed (back end), then transformed into written qualitative feedback shown to the learner. (p. 16, Application, "numerical scores are calculated"; p. 16, Application, "user receives written qualitative feedback")
- Actionable revision support: missing keyphrases + pointers to paragraphs/subsections to revisit. (p. 16, Application, "directed to specific paragraphs")

---

## E) Content architecture

### Units

- Section of an intelligent textbook (source text) + end-of-section student summary as the main learner-produced artifact. (p. 15, Application, "summaries written at the end of chapter sections")
- Formative feedback message (qualitative text) delivered to learners after scoring/filtering. (p. 16, Application, "written qualitative feedback")
- Keyphrase list identifying missing concepts/phrases from the source. (p. 16, Application, "list of key phrases")

### Structure (how units connect)

- Section (source) → student summary → filters → scoring models → qualitative feedback → possible rewrite loop. (p. 15, Application, "before that summary is passed"; p. 16, Application, "asked to rewrite")

### Attachment rules (task→unit, concept→unit, etc.)

- Summary is paired with its corresponding source section; the paper explicitly constructs matched vs unmatched pairings for validity tests. (p. 11, Post-Hoc Analysis, "summaries are matched"; p. 11, Post-Hoc Analysis, "summaries are randomized")
- Keyphrases are extracted from the source text and compared against the summary to find missing phrases. (p. 16, Application, "key phrases ... not present")

### Lifecycle (create → show → evaluate → revise → store)

- Create: learner writes summary in-app; system blocks cut-and-paste. (p. 15, Application, "students cannot cut and paste")
- Evaluate: summary passes through filters, then models produce Content/Wording scores. (p. 15, Application, "go through a filter component"; p. 11, Results, "predict scores")
- Feedback: learner receives qualitative guidance; below-threshold triggers rewrite before moving on. (p. 16, Application, "encouraged to revisit"; p. 16, Application, "rewrite their summary")

---

## F) Adaptation mechanics

### Triggers/signals observed

- IF a summary is submitted, THEN it is checked by a filter component before being scored by LLMs. (p. 15, Application, "before that summary is passed")
- IF summary length is outside 50–200 words, THEN it is filtered out (as described by the filter ensuring length). (p. 15, Application, "between 50 and 200 words")
- IF a summary is off-topic per Doc2Vec similarity, THEN it is rejected prior to LLM analysis. (p. 15, Application, "assesses whether the summary is on topic")
- IF a summary heavily borrows from the source or contains offensive language, THEN it is rejected without LLM analysis. (p. 15, Application, "rejected without being analyzed")

### Adaptation actions taken

- IF a summary passes filters, THEN it is scored by the LLMs and used to develop formative feedback. (p. 16, Application, "Summaries are then run through the LLMs")
- IF scores are below a threshold, THEN the learner is encouraged to revisit the section and rewrite before moving on. (p. 16, Application, "If the scores are below a certain threshold")
- IF keyphrases from the source are missing in the summary, THEN the system lists those phrases and directs learners to specific paragraphs/subsections for revision. (p. 16, Application, "provided with a list of key phrases")

### Escalation ladder (hint→explanation→reflection)

### Learner-initiated vs system-initiated

- Learner-initiated: writing and rewriting summaries; revisiting sections to revise. (p. 16, Application, "asked to rewrite their summary")
- System-initiated: filter gating; threshold-based rewrite requirement; keyphrase-based redirection. (p. 15, Application, "filter ensures"; p. 16, Application, "below a certain threshold")

### Human-in-the-loop controls

- Human scoring exists for training labels (expert raters), but instructor-facing review/approval of live feedback is not described. (p. 6, Summary Scoring, "Two expert raters scored each summary")

---

## G) Evaluation

### Setting/context (domain/content source)

- The training corpus contains summaries from a range of topics and writer populations (high school, university, adult writers) and is intended to support domain-agnostic scoring. (p. 6, Data, "high school, university, and adult writers")
- Post-hoc testing uses professional OpenStax Macroeconomics section summaries and Prolific-written summaries for those sections. (p. 10–11, Post-Hoc Analysis, "Openstax website"; p. 11, Post-Hoc Analysis, "Prolific crowdsourcing")

### Design (datasets and comparisons)

- Four datasets are used for finetuning, domain adaptation, and post-hoc testing (Table 1). (p. 5, Methods, "Table 1 List of datasets")
- Core model comparison: summary-only (RoBERTa) vs summary+source (Longformer) for Content/Wording scoring. (p. 11, Results, "both the summary and the source")
- Domain adaptation test: unsupervised pretraining on Commonlit summaries, then finetuning again. (p. 10, Summary Scoring Model, "domain-adapted the Longformer")
- Validity test: matched vs unmatched (randomly paired) professional summaries to see if matched scores are higher. (p. 11, Post-Hoc Analysis, "matched to the appropriate section")

### Participants and procedure (human scoring)

- Training labels: two expert raters score summaries with a 0–4 analytic rubric; norming and reliability procedures are described, and average scores are used. (p. 6–7, Summary Scoring, "Raters were initially normed")
- Prolific study: 60 participants write 113 summaries; two expert raters score with the same rubric; reported QWK is 0.576. (p. 11, Post-Hoc Analysis, "recruit 60 participants"; p. 11, Post-Hoc Analysis, "QWK=0.576")

### Measures

- Outcome variables: PCA-derived Content and Wording component scores used as model targets. (p. 8, Dimensionality Reduction, "related to Content"; p. 8, Dimensionality Reduction, "designated as Wording")
- Performance metrics: correlation with human judgments and explained variance (R²). (p. 10, Summary Scoring Model, "correlation ... and explained variance (R2)")

### Analysis methods (only what is explicitly stated)

- PCA diagnostics include eigenvalue criteria (Jolliffe), KMO, and Bartlett’s test with reported statistics. (p. 7, Dimensionality Reduction, "overall KMO score=0.87"; p. 7, Dimensionality Reduction, "Bartlett’s test")
- Model training includes finetuning + optional domain adaptation via masked language modeling with specified epochs and learning rates. (p. 10, Summary Scoring Model, "trained each model for six epochs"; p. 10, Summary Scoring Model, "domain adapt ... for eight epochs")

### Key results (exact reported numbers)

- Dataset sizes (Table 1): Training 101 sources / 4,690 summaries; Commonlit 6 sources / 93,484 summaries; Textbook 94 sources / 94 summaries; Prolific 4 sources / 113 summaries. (p. 5, Methods, "Table 1 List of datasets")
- PCA: 2-component solution explains ~73% shared variance; overall KMO=0.87; Bartlett χ²(4690)=11,513.99, p<.001. (p. 7, Dimensionality Reduction, "KMO score=0.87"; p. 7, Dimensionality Reduction, "χ2 (4690)=11,513.99")
- Model results on held-out test set (Table 4): Longformer pretrained Content r=0.91, R²=0.82; Wording r=0.87, R²=0.70; RoBERTa pretrained Content r=0.82, R²=0.67; Wording r=0.64, R²=0.36. (p. 11, Table 4, "Longformer (pretrained)"; p. 11, Table 4, "RoBERTa (pretrained)")
- Note (paper-internal inconsistency): the narrative text states RoBERTa Wording explains 41% variance, while Table 4 shows R²=0.36 for RoBERTa pretrained Wording. (p. 11, Results, "70% versus 41%"; p. 11, Table 4, "0.36")
- Domain adaptation: domain-adapted Longformer performs worse than non-domain-adapted Longformer (Content R² 0.72; Wording R² 0.60). (p. 11, Table 4, "Longformer (domain adapted)"; p. 12, Domain Adaptation, "performed worse")
- Matched vs unmatched professional summaries: differences significant p<.001; effect sizes d=1.56 (Content) and d=0.938 (Wording). (p. 13, Post-hoc Tests, "p<.001"; p. 13, Post-hoc Tests, "d=1.56")
- Prolific generalization: Content r(123)=0.70, p<.001; Wording r(123)=0.29, p=.001. (p. 13, Post-hoc Tests, "r(123)=0.70"; p. 13, Post-hoc Tests, "r(123)=0.29")

---

## H) Limitations and failure modes

- Transfer risk: more testing in target domains is needed to ensure accuracy transfers across academic topics, especially for Wording. (p. 17, Conclusion, "more testing in target domains is necessary")
- Learning impact is not established: models should be tested on intelligent textbook users to see whether feedback increases learning. (p. 17, Conclusion, "leads to increase learning")
- Interpretability: the paper notes numerical scores need more granular explanations and actionable suggestions, motivating explainable AI methods. (p. 17, Conclusion, "feedback ... should explain at a granular level")
- Prolific study reliability: inter-rater agreement is lower than the original dataset, and the paper attributes this partly to missing access to original rater training procedures. (p. 11, Post-Hoc Analysis, "inter-rater reliability was lower"; p. 15, Discussion, "did not have access")

---

# PROJECT RELEVANCE

## I) Where this overlaps with our project (“What’s already been done that is similar?”)

| Paper feature/idea | Evidence (citation) | Closest match to our project component | Notes on mapping to SQL learning |
|---|---|---|---|
| Reflective learner artifact: student-authored summaries with formative feedback | (p. 2, Introduction, "students can write summaries"; p. 16, Application, "written qualitative feedback") | 4) reflective/accumulative learning artifacts | Analog: student-authored “My Notes” after SQL attempts with feedback on completeness/clarity. |
| Gated progression based on quality threshold (rewrite before moving on) | (p. 16, Application, "rewrite their summary before moving on") | 1) adaptive instructional content beyond hints | Analog: require brief reflection after repeated SQL errors before revealing deeper explanation. |
| Trace-to-action via filters (length, topic similarity, borrowing, offensive language) | (p. 15, Application, "between 50 and 200 words"; p. 15, Application, "Doc2Vec") | 5) trace-to-content mapping / learning-from-logs | Analog: validate “My Notes” units for relevance to the SQL concept/error before storing/surfacing. |
| Missing-keyphrase diagnosis + pointers to source subsections | (p. 16, Application, "key phrases ... not present"; p. 16, Application, "directed to specific paragraphs") | 2) intelligent/adaptive textbook artifact | Analog: identify missing SQL concepts (e.g., JOIN keys, GROUP BY) and link to targeted mini-notes/examples. |
| Domain-agnostic scoring model trained across topics | (p. 3, Introduction, "iTELL is designed to be domain agnostic") | 5) trace-to-content mapping / learning-from-logs | Supports the idea of reusable evaluation/feedback layers across different SQL topics/problems. |

## J) Where the paper falls short for our needs

- It focuses on reading comprehension via summarization, not problem-solving traces like SQL errors/retries/hint use. (p. 15, Application, "assess reading comprehension via end-of-section summarization")
- Explicit escalation ladder (hint → explanation → reflection) is not specified; adaptation is mainly rewrite gating + keyphrase guidance. (p. 16, Application, "rewrite their summary"; p. 16, Application, "key phrases")
- Human-in-the-loop oversight for live-generated explanations (beyond summary scoring) is not covered; the system focuses on scoring + feedback. (p. 2, Introduction, "scores which inform qualitative feedback")

## K) How our idea is different

- Our idea differs because… our primary triggers are problem-solving interaction traces (errors, retries, hint-use), whereas this paper’s trigger is a submitted summary and its filter/score pipeline. (p. 15, Application, "After students produce a summary")
- Our idea differs because… we want escalation beyond hints only when needed; this paper’s adaptive action is mainly “rewrite before moving on” plus keyphrase-based guidance. (p. 16, Application, "rewrite their summary before moving on")

---

## L) Actionable “steal-this” design patterns

### Filter-first gating before expensive/impactful feedback

- Filter-first gating before expensive/impactful feedback  
- What it does: rejects low-effort or invalid submissions (length/off-topic/borrowing/offensive) before scoring. (p. 15, Application, "filter ensures"; p. 15, Application, "rejected without being analyzed")  
- How to implement in SQL adaptive textbook: validate “My Notes” entries (relevance to current SQL concept/error, minimum content) before storing or using them to drive adaptation.

### Threshold-based revision loop (don’t let learners advance until they engage)

- Threshold-based revision loop (don’t let learners advance until they engage)  
- What it does: below-threshold summary scores prompt revisiting and rewriting before moving to the next section. (p. 16, Application, "rewrite their summary before moving on")  
- How to implement in SQL: after repeated failures, require a short reflection (“What was wrong with my query?”) before showing a full worked solution, to preserve reflective/on-demand delivery.

### Missing-keyphrase feedback as “coverage gap” detector

- Missing-keyphrase feedback as “coverage gap” detector  
- What it does: extracts keyphrases from the source and shows which ones are missing from the learner’s summary, then points to where to review. (p. 16, Application, "key phrases ... not present"; p. 16, Application, "directed to specific paragraphs")  
- How to implement in SQL: map SQL errors/concepts to “required terms/ideas” (e.g., join keys, grouping) and show what’s missing in the learner’s explanation, linking to targeted note units.

### Source+response joint modeling improves scoring fidelity

- Source+response joint modeling improves scoring fidelity  
- What it does: includes both source text and summary in the Longformer input and reports better performance than summary-only. (p. 11, Results, "both the summary and the source"; p. 11, Table 4, "R2")  
- How to implement in SQL: evaluate learner explanations against both (a) the prompt/task and (b) reference solution principles, not the explanation alone.

### Matched vs mismatched pairing as a sanity-check validation

- Matched vs mismatched pairing as a sanity-check validation  
- What it does: tests whether professional summaries score higher when paired with the correct section than when paired with a random section. (p. 11, Post-Hoc Analysis, "matched ... randomized"; p. 13, Post-hoc Tests, "matched to the correct sources")  
- How to implement in SQL: test whether “note units” score higher when paired with the correct error/concept than with mismatched ones (a lightweight validity check for trace-to-content mapping).

---

## M) Final takeaway

- This paper shows a concrete way an intelligent textbook can make learning more interactive by requiring students to write end-of-section summaries and then giving immediate, personalized formative feedback derived from LLM-based scoring models. (p. 15, Application, "assess reading comprehension via end-of-section summarization"; p. 16, Application, "written qualitative feedback")
- Beyond model training, the key “product” insight is the feedback loop: validate the summary first, score it, give actionable qualitative guidance, and—when needed—gate progression by asking students to rewrite and by pointing them to missing keyphrases and relevant subsections to review. (p. 15, Application, "filter ensures"; p. 16, Application, "rewrite their summary"; p. 16, Application, "directed to specific paragraphs")

# Paper 5

## Instruction-fit notes

- Page numbers and section headings are visible in the PDF, so the required citation format is feasible throughout. (p. 1, Abstract, "How to Improve the Explanatory Power")
- This paper’s “adaptation” is primarily on-demand, user-driven explanation expansion (clickable terms + question-answering + expandable overviews), not trace-triggered escalation from hints. (p. 1, Abstract, "on-demand, expandable explanations")
- The core “content organization” contribution is a pipeline that extracts questions/answers from texts, ranks/filters them (DoX + thresholds), and presents them as interactive explanatory overviews. (p. 14, Intelligent Explanation Generator, "workflow ... consists of the following steps")

---

## A) Full citation

- Sovrano, F., Ashley, K., Brusilovsky, P. L., & Vitali, F. (2025). How to Improve the Explanatory Power of an Intelligent Textbook: a Case Study in Legal Writing. International Journal of Artificial Intelligence in Education, 35, 987–1021. (p. 1, Header, "Int J Artif Intell Educ (2025) 35:987–1021")
- DOI: 10.1007/s40593-024-00399-w. (p. 1, Header, "<https://doi.org/10.1007/s40593-024-00399-w>
")
- Published online: 6 May 2024; Accepted: 29 Feb 2024. (p. 1, Header, "Published online: 6 May 2024")

---

## B) Summary

- The paper builds YAI4Edu, an interactive/adaptive e-book system that generates on-demand, expandable explanations by extracting a knowledge graph from a collection of texts and choosing “useful implicit questions” to organize explanations. (p. 1, Abstract, "interactive and adaptive textbook"; p. 1, Abstract, "extracting a specialized knowledge graph")
- In a legal-writing case study, they run a within-subjects user study (102 valid student submissions) comparing YAI4Edu’s question-selection strategy vs random and generic baselines, reporting higher student ratings for YAI4Edu’s explanations. (p. 22, Discussion: Results and Limitations, "102 valid submissions were collected"; p. 5, Introduction, "students rated YAI4Edu’s explanations the highest")

---

## C) Section-by-section reading

### Abstract

- The problem: explaining complex/large textbook/library content in an intuitive, user-centered way remains challenging because people want different kinds of information than static exposition provides. (p. 1, Abstract, "different people may search for and request")
- The approach: an interactive/adaptive textbook (YAI4Edu) that generates on-demand, expandable explanations using question-answering and a knowledge graph extracted from a collection of resources. (p. 1, Abstract, "question-answering technology"; p. 1, Abstract, "specialized knowledge graph")
- The evaluation: within-subjects study with >100 students; YAI4Edu’s explanations rated highest; differences statistically better than baselines. (p. 1, Abstract, "within-subjects user study with more than 100"; p. 1, Abstract, "P values below .005")

### Introduction

- The paper motivates AI-in-education as still developing, and frames the challenge as harnessing large written knowledge for user-centered explanation. (p. 2, Introduction, "yet to be fully understood"; p. 2, Introduction, "automatically explaining ... is still an open problem")
- It argues static documents are sub-optimal because relevant information can be sparse/scattered across many pages. (p. 2, Introduction, "sparse and scattered over hundreds")
- They propose enhancing textbooks by reducing sparsity of relevant info and linking to a knowledge graph extracted from supplementary materials. (p. 2, Introduction, "linking it to a knowledge graph")
- Hypothesis 1: useful implicit questions are those “best answered by the collection as a whole,” avoiding too-specific or too-general questions. (p. 3, Introduction, "best answered in the collection as a whole")
- Contributions include a pipeline + an “Intelligent Explanation Generator” for identifying questions best answered by a collection of texts. (p. 3, Introduction, "main contribution is a novel pipeline")

### Related Work

- The paper situates intelligent textbooks as focusing on progress modeling, domain modeling, personalization via questions, quizzes/exercises, and authoring tools. (p. 6, Related Work, "open learner models"; p. 6, Related Work, "associating ... quizzes and exercises")
- It claims fully automatic generation of interactive e-books is under-explored, contrasting with approaches that annotate PDFs with videos. (p. 6, Related Work, "seems to be underexplored"; p. 6, Related Work, "annotating the PDF")
- Their approach explicitly avoids quiz/exercise question generation; instead uses questions as a criterion to organize/categorize explanations, and argues some questions are more useful than others. (p. 6, Related Work, "not interested in ... quizzes"; p. 6, Related Work, "some questions are more useful")

### Background

- The paper adopts an “Ordinary Language Philosophy” account where explaining is an illocutionary question-answering act intended to produce understanding, not just template filling. (p. 7, Explanations According to Ordinary Language Philosophy, "Explaining is an illocutionary act")
- It defines “archetypal questions” (why/how/what/etc. and derivatives) and links these to linguistic theories (AMR and discourse relations). (p. 8, Definition 2, "interrogative particles"; p. 8, Archetypal Questions in Linguistic Theories, "Abstract Meaning Representation")
- It introduces Degree of Explainability (DoX) as a metric based on how well text can answer archetypal questions, computed via pertinence scoring and a graph of extracted triplets. (p. 9, How to Measure the Degree of Explainability, "DoX scores are computed")
- It defines Explanatory AI (YAI) and describes YAI4Hu’s interaction modes: open-ended questioning and overviewing via annotated words/tabs. (p. 9, Explanatory Artificial Intelligence, "open-ended questioning"; p. 9, Explanatory Artificial Intelligence, "overviewing")

### YAI4Edu: a YAI for Improving the Explanatory Power of an Intelligent Textbook

- YAI4Edu transforms static e-books (PDF/XML/HTML) into interactive intelligent textbooks using open-ended questioning and overviewing. (p. 10, YAI4Edu, "transform static educative e-books")
- User interaction includes clickable word glosses (overview) and a search box for open-ended questions. (p. 10, YAI4Edu, "word glosses ... clicked"; p. 10, YAI4Edu, "search box")
- The system reorganizes content on-demand and connects it with external resources (e.g., encyclopedia) to provide more useful explanations. (p. 10, YAI4Edu, "reorganize, on-demand"; p. 10, YAI4Edu, "connect it with external")
- It releases source code and anonymized evaluation data (but not copyrighted textbook excerpts). (p. 11, YAI4Edu, "release the source code"; p. 11, YAI4Edu, "cannot release ... copyrighted")

### Automated Question Extraction for Intelligent Overviewing

- The system extracts discourse- and AMR-based question-answer pairs from sentences/paragraphs using a deep model based on T5, fine-tuned on QAMR and QADiscourse. (p. 12, Automated Question Extraction, "based on T5"; p. 12, Automated Question Extraction, "fine-tune T5")
- They emphasize the fine-tuning data are unrelated to their legal textbooks; they do not do legal-domain fine-tuning and expect extraction errors may propagate. (p. 13, Automated Question Extraction, "do not refine T5 on legal texts"; p. 13, Automated Question Extraction, "questions ... can be imperfect")
- They report five-epoch fine-tuning and an average loss of 0.4098. (p. 13, Automated Question Extraction, "five epochs"; p. 13, Automated Question Extraction, "average loss was 0.4098")

### Intelligent Explanation Generator (key algorithm)

- The generator is designed to replace generic archetypal questions with more domain-specific questions extracted from the corpus, guided by Hypothesis 1. (p. 14, Intelligent Explanation Generator, "instead of using predefined generic"; p. 14, Intelligent Explanation Generator, "Hypothesis 1")
- Step 1: compute DoX for snippets about an aspect and keep top-k snippets/questions. (p. 14, Intelligent Explanation Generator, "top k snippets with the highest DoX")
- Step 2: retrieve answers whose pertinence exceeds threshold p. (p. 14, Intelligent Explanation Generator, "pertinence threshold p")
- Step 3: filter/clean questions and answers (length L, grammar correction, similarity threshold s, answer length bounds, keep top-q questions and top-a answers). (p. 14, Intelligent Explanation Generator, "exceeds a threshold L"; p. 14, Intelligent Explanation Generator, "similarity score ... threshold s")
- They analyze complexity: Step 1 reduces worst-case quadratic selection in |S| to O(|S|). (p. 15, Intelligent Explanation Generator, "worst-case ... O(|S|^2)"; p. 15, Intelligent Explanation Generator, "reduces ... to O(|S|)")

### Smart annotation mechanism

- The system annotates only concepts that are explainable by the knowledge graph, skipping stopwords and requiring cumulative pertinence above a threshold. (p. 15, Intelligent Explanation Generator, "checks whether the word is a stop word"; p. 15, Intelligent Explanation Generator, "cumulative pertinence score")
- The goal is to reduce noisy/distracting annotations so readers focus on central concepts. (p. 15, Intelligent Explanation Generator, "remove noisy annotations and distractors")

### Answer Retrieval / Knowledge graph construction

- A dependency parser extracts grammatical clauses into “template-triplets” (subject/template/object) as edges of the knowledge graph. (p. 16, Answer Retrieval, "dependency parser detects"; p. 16, Answer Retrieval, "template-triplets")
- The graph is formatted as RDF, with URIs/labels, provenance links back to sources, and subclass relations for composite concepts. (p. 16–17, Answer Retrieval, "formatted it as an RDF"; p. 17, Answer Retrieval, "subClassOf")
- Retrieval ranks candidate answers by cosine similarity between embeddings of <information unit, source paragraph> and the question; uses a pre-trained model specialized for answer retrieval. (p. 17, Answer Retrieval, "cosine similarity"; p. 17, Answer Retrieval, "specialized in answer retrieval")
- They note compositionality enables manual correction and merging graphs, and they add ~10 manual RDF triplets to fill gaps (e.g., memo ≈ memorandum). (p. 19, Case Study, "about ten manually added"; p. 19, Case Study, "compositional nature of RDF")

### Case Study: legal memoranda

- Materials: 22 pages of a legal-language textbook excerpt + 5,407 open access webpages + 11,198 BVA legal cases (16,606 documents total). (p. 18, Case Study, "22 pages excerpted"; p. 18, Case Study, "11,198 legal cases")
- The textbook is used in a University of Pittsburgh course and the scenario targets writing a legal memorandum for PTSD disability claims. (p. 18, Case Study, "used in ... University of Pittsburgh"; p. 4, Introduction, "PTSD disability claim")
- They report large extracted KGs (e.g., ~52,987,778 RDF triplets from cases). (p. 19, Case Study, "52,987,778 RDF triplets")
- They specify hyperparameters for concise explanations: k=10, p=.57, L=50, s=.95, answer length 150–1000, q=4, a=2. (p. 20, Case Study, "k = 10"; p. 20, Case Study, "p = .57")

### Experiment

- The experiment isolates “presentation logic” (question selection/reorganization) rather than testing the whole e-book interface. (p. 20, Experiment, "evaluating the presentation logic")
- Within-subjects: students rate explanation quality 0–5 stars; baselines differ only in how they choose questions. (p. 21, Experiment, "within-subjects user study"; p. 21, Experiment, "step ... selecting the explanatory questions")
- Baselines: random question selector vs YAI4Hu-style generic archetypal questions (“what/how/where/why”). (p. 21–22, Experiment, "randomly selects q = 4"; p. 22, Experiment, "same four questions")
- Topics tested: (1) proper form of a legal memorandum; (2) effects of a disability; (3) elements of legal standard for PTSD disability claim. (p. 22, Experiment, "Topic 1"; p. 22, Experiment, "Topic 3")

### Discussion: Results and Limitations

- Data: 130 recruited; 28 discarded; 102 valid submissions. (p. 22, Discussion: Results and Limitations, "gathered 130 participants"; p. 22, Discussion: Results and Limitations, "102 valid submissions")
- Outcome: intelligent explainer rated highest; generic second; random worst; tested with one-sided Mann–Whitney U tests, significance discussed. (p. 22, Discussion: Results and Limitations, "highest rates"; p. 22, Discussion: Results and Limitations, "Mann-Whitney U-tests")
- Topic nuance: strong evidence for first two topics, weaker for third; authors suspect cases are “harder to explain” and contain jargon/long sentences. (p. 22, Discussion: Results and Limitations, "not enough statistical evidence"; p. 24, Discussion: Results and Limitations, "harder to explain")

### Limitations and Future Work

- Scope limits: brief 10-minute study and 102 participants; concerns about generalizability; no direct learning-outcome measures. (p. 25, Limitations and Future Work, "brief 10-minute period"; p. 25, Limitations and Future Work, "without directly measuring changes")
- Qualitative feedback suggests improvements: avoid long/redundant explanations; avoid/explain legal jargon; avoid generic/incomplete info; etc. (p. 25, Limitations and Future Work, "Avoid long and redundant"; p. 25, Limitations and Future Work, "Avoid or explain legal jargon")
- They propose generative AI (e.g., ChatGPT) as a way to make retrieved info more concise/coherent, while noting risks like memory limits and inaccurate/copyrighted content. (p. 26, Limitations and Future Work, "introduction of generative AI"; p. 26, Limitations and Future Work, "risk of generating inaccurate")

### Conclusion

- The paper claims explanatory power improves by reorganizing books interactively to help readers find critical questions and retrieve answers, using the Intelligent Explanation Generator. (p. 27, Conclusion, "explanatory power ... improved by reorganizing")
- They restate the evaluation setup (legal-memo textbook + web pages + legal cases; within-subjects study; results favor Intelligent Explanation Generator). (p. 27, Conclusion, "within-subjects user study"; p. 27, Conclusion, "always in favor")

---

## D) System explained

### What the learner sees (UI/components)

- A reading interface with an input box for open-ended questions and underlined (annotated) words that can be clicked for overviews. (p. 20, Fig. 4 caption, "input for open-ended questioning"; p. 20, Fig. 4 caption, "Clicking on underlined words")
- A modal/overview view that presents relevant questions and answers as explanations, with expandable details and clickable terms to shift the topic. (p. 4, Fig. 1 caption, "scrollspy showing relevant questions and answers"; p. 14, Intelligent Explanation Generator, "can also be expanded")

### What the learner does (actions)

- Types any open-ended English question into the search box to retrieve answers. (p. 10, YAI4Edu, "allows the reader to get answers")
- Clicks an underlined term to get an overview of that aspect/topic. (p. 20, Fig. 4 caption, "Clicking on underlined words opens")
- Expands archetypal answers to increase detail. (p. 14, Intelligent Explanation Generator, "expanded, increasing the level")

### What the system observes (signals/logs)

- The explicit user question text (for open-ended QA). (p. 10, YAI4Edu, "user can ask questions")
- The clicked “aspect of the explanandum” chosen for overviewing. (p. 12, Fig. 3 caption, "user decides which aspect")

### What the system outputs (content/feedback/artifacts)

- Retrieved answers from the knowledge graph for open-ended questions. (p. 17, Answer Retrieval, "retrieve answers"; p. 10, YAI4Edu, "get answers")
- An “intelligent overview” consisting of selected archetypal questions plus filtered pertinent answers ordered by estimated pertinence. (p. 9, Explanatory Artificial Intelligence, "questions ... and their respective answers ordered"; p. 14, Intelligent Explanation Generator, "sorted by ... pertinence")

---

## E) Content architecture

### Units (what content chunks exist)

- Annotated term / concept (clickable word) that serves as an entry point to an overview. (p. 10, YAI4Edu, "word glosses that can be clicked")
- Overview: a set of archetypal questions with answers, presented as an explanation for an aspect. (p. 14, Intelligent Explanation Generator, "set of relevant archetypal answers")
- Question–answer pairs extracted from text (discourse-based and AMR-based). (p. 12, Automated Question Extraction, "discourse relation ... question-answer"; p. 12, Automated Question Extraction, "AMR-based questions")
- Snippets/paragraphs used as candidate explanation sources and ranked by DoX. (p. 14, Intelligent Explanation Generator, "snippets with the highest DoX")
- Knowledge graph nodes/edges represented as RDF triplets with provenance to sources. (p. 16, Answer Retrieval, "formatted it as an RDF"; p. 17, Answer Retrieval, "keep track of the sources")

### Structure (how units connect)

- Text collection → question extraction + triplet extraction → RDF knowledge graph → answer retrieval + DoX estimation → filtered questions/answers → interactive overview UI. (p. 10, Fig. 2 caption, "main components"; p. 14, Intelligent Explanation Generator, "Step 1 ... Step 3")

### Attachment rules (how content links)

- A clicked annotated word determines the “aspect to overview,” which scopes snippets/questions and the resulting overview. (p. 12, Fig. 3 caption, "clicking on an annotated word")
- Answers are kept only if pertinence exceeds threshold p and pass length constraints; questions are de-duplicated by similarity threshold s. (p. 14, Intelligent Explanation Generator, "pertinence threshold p"; p. 14, Intelligent Explanation Generator, "similarity ... threshold s")
- Annotation of a word occurs only if (a) not a stopword and (b) overview’s cumulative pertinence exceeds a threshold. (p. 15, Intelligent Explanation Generator, "word is a stop word"; p. 15, Intelligent Explanation Generator, "if greater than a given threshold")

### Lifecycle (create → show → revise → store)

- Create: extract questions and template-triplets from texts; build RDF graph with provenance. (p. 16–17, Answer Retrieval, "dependency parser detects"; p. 17, Answer Retrieval, "added special triplets")
- Show: user asks questions or clicks terms; system generates overview using DoX + retrieval + filters. (p. 12, Fig. 3 caption, "obtain an intelligent overview"; p. 14, Intelligent Explanation Generator, "filters the pertinent answers")

### Dedup/reuse (caching, re-serving, versioning)

- The algorithm removes “questions that are too similar,” prioritizing high-DoX origins and shorter questions (a form of deduplication at generation time). (p. 14, Intelligent Explanation Generator, "questions that are too similar are removed")

---

## F) Adaptation mechanics

### Triggers / signals

- IF the user types a question, THEN the system performs open-ended answer retrieval and returns one or more relevant answers. (p. 13, Intelligent Explanation Generator, "Open-ended Question-Answering"; p. 17, Answer Retrieval, "retrieve answers")
- IF the user clicks an annotated word, THEN the system generates an overview for that aspect using the Intelligent Explanation Generator. (p. 12, Fig. 3 caption, "clicking on an annotated word"; p. 14, Intelligent Explanation Generator, "workflow ... consists")

### Adaptation actions

- IF generating an overview, THEN the system selects top-k DoX snippets, extracts questions from them, retrieves pertinent answers above threshold p, and filters by length/similarity to keep top-q questions and a answers. (p. 14, Intelligent Explanation Generator, "top k snippets"; p. 14, Intelligent Explanation Generator, "pertinence threshold p")
- IF a question has grammatical errors, THEN it is automatically corrected (Gramformer) during filtering. (p. 14, Intelligent Explanation Generator, "corrected via Gramformer")
- IF a word is a stopword, THEN it is not annotated; ELSE annotate only if cumulative pertinence exceeds a threshold. (p. 15, Intelligent Explanation Generator, "If so, the word is not annotated"; p. 15, Intelligent Explanation Generator, "if greater than a given threshold")

### Learner-initiated vs system-initiated

- Learner-initiated: selecting topics via clicking and asking open-ended questions. (p. 10, YAI4Edu, "user can ask questions"; p. 20, Fig. 4 caption, "Clicking on underlined words")
- System-initiated: automatic question extraction, DoX ranking, filtering thresholds, and smart annotation decisions. (p. 14, Intelligent Explanation Generator, "filters the pertinent answers"; p. 15, Intelligent Explanation Generator, "smart annotation mechanism")

### Human-in-the-loop controls

- The system supports manual knowledge graph patching (adding RDF triplets) to fill gaps found in testing. (p. 19, Case Study, "about ten manually added RDF triplets")

---

## G) Evaluation

### Setting/context

- Domain: legal writing (legal memorandum) with supplementary legal encyclopedia pages and PTSD disability claim cases. (p. 4, Introduction, "legal memorandum"; p. 18, Case Study, "11,198 legal cases")

### Design

- Within-subjects user study: students rate explanation quality 0–5 stars for multiple topics; explanations shown in random order. (p. 21, Experiment, "within-subjects user study"; p. 28, Appendix A, "provided in random order")
- Conditions compared: Intelligent Explanation Generator vs random-question explainer vs generic archetypal-question explainer (YAI4Hu-style). (p. 5, Introduction, "two baseline algorithms"; p. 22, Experiment, "YAI4Hu’s generic")

### Participants and procedure

- Recruitment: Prolific; 130 participants gathered; 28 discarded; 102 valid submissions; ages 19–38; paid £1. (p. 22, Discussion: Results and Limitations, "gathered 130 participants"; p. 27, Appendix A, "each paid £1")
- Screening/filters include speed and skipping topics; also English proficiency checks; requirements include student status and residency in English-speaking countries. (p. 28, Appendix A, "spent less than 4 minutes"; p. 28, Appendix A, "resident in English-speaking countries")
- Study duration: 10 minutes, chosen partly due to participant pay constraints. (p. 22, Experiment, "maximum of 10 minutes"; p. 25, Limitations and Future Work, "brief 10-minute period")

### Measures

- Primary: participant star ratings of “how well they adequately explain a given topic.” (p. 21, Experiment, "rate explanations ... how well")
- Secondary: optional qualitative feedback; 81% provided feedback. (p. 25, Limitations and Future Work, "notable 81% of users provided")

### Analysis methods (only what is explicitly stated)

- One-sided Mann–Whitney U-tests used to assess differences; Table 3 reports U, p-value, CLES, and rank-biserial correlation. (p. 22, Discussion: Results and Limitations, "Mann-Whitney U-tests"; p. 29, Appendix B, "U statistic, the p-value")
- Multiple-comparison discussion includes Dunn–Šidák correction and a suggested adjusted threshold (~.017). (p. 31, Appendix B, "Dunn-Šidák correction"; p. 31, Appendix B, ".017")

### Key results (exact reported numbers)

- Valid N=102 after discarding 28 of 130. (p. 22, Discussion: Results and Limitations, "28 participants were discarded"; p. 22, Discussion: Results and Limitations, "102 valid submissions")

**Table: Key results reported in Table 3**

| Comparison | All topics | Topic “Memorandum” | Topic “Disability” | Topic “Elements of Legal Standard” |
|---|---:|---:|---:|---:|
| Random vs Intelligent | p < .001 | p < .001 | p = 0.0008 | p = 0.068 |
| Generic vs Intelligent | p = 0.0027 | p = 0.0007 | p = 0.118 | p = 0.327 |
| Random vs Generic | p = 0.036 | p = 0.491 | p = 0.026 | p = 0.142 |

(p. 30, Table 3, "Random vs Intelligent ... < 0.001"; p. 30, Table 3, "0.0027"; p. 30, Table 3, "0.491"; p. 30, Table 3, "0.118"; p. 30, Table 3, "0.327")

---

## H) Limitations and failure modes

- Limited scope: 10-minute duration and 102 participants, raising concerns about generalizability. (p. 25, Limitations and Future Work, "brief 10-minute period"; p. 25, Limitations and Future Work, "relatively small group of 102")
- No direct learning outcomes measured; results are based on ratings and qualitative feedback. (p. 25, Limitations and Future Work, "without directly measuring changes")
- Explanations can be too long/repetitive/disjointed; legal jargon can be unexplained; organization could be improved. (p. 26, Limitations and Future Work, "lengthy, repetitive, and disjointed"; p. 25, Limitations and Future Work, "Avoid or explain legal jargon")
- Dependency on well-written/logically coherent source texts due to lack of commonsense/domain-general knowledge integration. (p. 26, Limitations and Future Work, "highly dependent on well-written")
- Risk of errors from imperfect extraction (T5 question extraction errors can propagate). (p. 13, Automated Question Extraction, "errors that could propagate")
- If integrating generative AI, they flag memory limitations and risk of inaccurate/copyrighted output. (p. 26, Limitations and Future Work, "memory limitations"; p. 26, Limitations and Future Work, "risk of generating inaccurate")

---

# PROJECT RELEVANCE

## I) Where this overlaps with our project (“What’s already been done that is similar?”)

| Paper feature/idea | Evidence (citation) | Closest match to our project component | Notes on mapping to SQL learning |
|---|---|---|---|
| Interactive, adaptive textbook delivering on-demand expandable explanations | (p. 1, Abstract, "interactive and adaptive textbook"; p. 14, Intelligent Explanation Generator, "can also be expanded") | 2) intelligent/adaptive textbook artifact | SQL “My Textbook” could offer expandable concept overviews for terms like JOIN/GROUP BY. |
| Question-centered organization of explanations (implicit questions) | (p. 3, Introduction, "implicit questions"; p. 6, Related Work, "organize and categorize the content") | 1) adaptive instructional content beyond hints | Use “implicit questions” to structure SQL misconception notes (e.g., “Why does GROUP BY require…”). |
| Knowledge-graph-backed retrieval + provenance to source paragraphs | (p. 17, Answer Retrieval, "keep track of the sources"; p. 17, Answer Retrieval, "source paragraph") | 5) trace-to-content mapping / learning-from-logs | SQL notes could cite canonical explanations/examples tied to schema/problem statements. |
| Rule/threshold-based selection + filtering (DoX, pertinence, length, similarity) | (p. 14, Intelligent Explanation Generator, "pertinence threshold p"; p. 14, Intelligent Explanation Generator, "questions that are too similar") | 1) adaptive instructional content beyond hints | Analogous to rule-based policy for which note units to surface after repeated errors. |
| Offline-style comparison of “presentation logic” via baselines | (p. 20, Experiment, "evaluating the presentation logic"; p. 22, Experiment, "two baselines") | 5) trace-to-content mapping / learning-from-logs | Mirrors our need for controlled comparisons of adaptive strategies (but with traces). |

## J) Where the paper falls short for our needs

- The paper’s adaptation is not driven by learner interaction traces like errors/retries/hint use; it’s primarily driven by user questions/clicks and corpus-driven question selection. (p. 10, YAI4Edu, "user can ask questions"; p. 12, Fig. 3 caption, "clicking on an annotated word")
- The evaluation measures perceived explanatory quality, not learning gains or performance improvement. (p. 25, Limitations and Future Work, "without directly measuring changes")
- The content domain is legal writing; transfer to SQL problem-solving requires new concept mapping and error taxonomy not covered here. (p. 18, Case Study, "legal memorandum"; p. 22, Experiment, "PTSD disability claim")

## K) How our idea is different

- Our idea differs because… our triggers are SQL interaction traces (errors, retries, timing, hint-use), whereas this paper triggers explanation generation from user queries/clicks and corpus-derived question selection. (p. 10, YAI4Edu, "user can ask questions"; p. 12, Fig. 3 caption, "clicking on an annotated word")
- Our idea differs because… we require an explicit escalation policy (hint → explanation → reflective note) tied to struggle signals; this paper focuses on organizing explanatory overviews rather than an escalation ladder. (p. 14, Intelligent Explanation Generator, "overviewing"; p. 21, Experiment, "selecting the explanatory questions")
- Our idea differs because… we plan offline replay comparisons over logged traces; this paper evaluates strategies with a live user rating study rather than trace replay. (p. 21, Experiment, "within-subjects user study")

---

## L) Actionable “steal-this” design patterns

### Balance specificity vs generality via corpus-wide “best-answered” questions

- Balance specificity vs generality via corpus-wide “best-answered” questions  
- What it does: selects implicit questions that represent the corpus as a whole, avoiding too-specific/too-generic questions. (p. 3, Introduction, "neither too detailed ... nor too general")  
- SQL implementation: generate “core questions” per concept from validated resources; prefer questions that appear across many tasks/errors.

### Two-stage pruning: rank candidate snippets, then run expensive QA selection

- Two-stage pruning: rank candidate snippets, then run expensive QA selection  
- What it does: uses DoX to pick top-k snippets first to reduce complexity before answer retrieval and filtering. (p. 14, Intelligent Explanation Generator, "top k snippets"; p. 15, Intelligent Explanation Generator, "reduces the complexity")  
- SQL implementation: first pick top candidate concept notes based on trace evidence frequency, then retrieve/generate the final learner note.

### Similarity-based deduplication for generated question sets

- Similarity-based deduplication for generated question sets  
- What it does: removes questions that are “too similar,” prioritizing shorter questions and those from high-DoX snippets. (p. 14, Intelligent Explanation Generator, "questions that are too similar are removed")  
- SQL implementation: dedup “misconception notes” that repeat the same idea across multiple problems; keep the clearest/shortest.

### Smart annotation thresholding to prevent UI overload

- Smart annotation thresholding to prevent UI overload  
- What it does: annotate only if word is explainable and the overview has sufficient cumulative pertinence. (p. 15, Intelligent Explanation Generator, "cumulative pertinence score"; p. 15, Intelligent Explanation Generator, "annotates the word")  
- SQL implementation: surface only a few high-confidence concept links in the notebook UI after an error burst.

### Editable knowledge backbone via compositional graphs + manual patches

- Editable knowledge backbone via compositional graphs + manual patches  
- What it does: RDF compositionality allows merging/fixing graphs; they add manual triplets for gaps. (p. 19, Case Study, "compositional nature of RDF"; p. 19, Case Study, "manually added RDF triplets")  
- SQL implementation: allow instructors to patch concept links (e.g., synonyms: “inner join” ↔ “join”) and update mappings without retraining.

---

## M) Final takeaway

- This paper demonstrates an “intelligent textbook” approach where explanation quality is improved by reorganizing a large corpus into interactive, on-demand explanatory overviews built from automatically extracted questions and retrieved answers. (p. 27, Conclusion, "improved by reorganizing it interactively"; p. 14, Intelligent Explanation Generator, "set of relevant archetypal answers")
- Its key lesson for adaptive textbooks is that content structure matters: selecting the right questions to organize information (and filtering/deduplicating them) can measurably improve perceived explanatory power compared to random or generic question strategies. (p. 22, Discussion: Results and Limitations, "intelligent explainer received the highest"; p. 6, Related Work, "some questions are more useful")

# Paper 6

## Instruction-fit notes

- The paper provides explicit content-organization mechanisms (hierarchical drill-down maps, child maps, information panel, caching) that match your “content architecture + adaptation” focus. (p. 3, Section 3, "hierarchical drill-down navigation")
- “Adaptation” here is mainly learner-driven depth navigation and AI-generated expansion (infinite drill-down), plus instructor regeneration/refinement (human-in-the-loop), rather than trace-triggered escalation. (p. 5, Section 3.2, "generate an extended concept map")
- The paper includes concrete system artifacts (file-based storage, prompt requirements, UI components, survey numbers), so your “no guessing + cite everything” rule is workable. (p. 7, Section 6, "meta.json file, a root concept map")

---

## A) Full citation

- Sergiy Tytenko. 2025. AI-driven Interactive Hierarchical Concept Maps for Digital Learning Environments and Intelligent Textbooks. iTextbooks’25: Sixth Workshop on Intelligent Textbooks, July 26, 2025, Palermo, Italy. CEUR Workshop Proceedings. (p. 1, Title/Footer, "iTextbooks'25: Sixth Workshop")
- License/venue metadata: CC BY 4.0; CEUR Workshop Proceedings; ISSN 1613-0073. (p. 1, Footer, "Creative Commons License Attribution 4.0")

---

## B) Summary

- The paper presents a working system that uses AI (an LLM) to generate interactive hierarchical concept maps for courses, letting students drill down into subtopics and view explanations in an information panel, while instructors refine content through human-in-the-loop workflows. (p. 1, Abstract, "hierarchical drill-down navigation")
- In two university courses, student surveys report high satisfaction and strong perceived usefulness of clickable nested maps for review and engagement. (p. 10, Section 7.2, "average score of 8.91 out of 10")

---

## C) Section-by-section reading

### Abstract

- The paper focuses on AI-driven interactive concept maps as components of intelligent textbooks, emphasizing hierarchical drill-down navigation and educator oversight. (p. 1, Abstract, "hierarchical drill-down navigation")
- It claims to present a working system architecture and UI supporting scalable knowledge exploration via AI-assisted generation and human refinement. (p. 1, Abstract, "working system architecture and user interface")
- It reports positive student feedback and questionnaires indicating perceived benefits for comprehension and engagement. (p. 1, Abstract, "Positive student feedback")

### 1. Introduction

- Traditional concept maps help connect ideas but are often static and don’t scale well; the paper aims to add interactivity and AI support. (p. 1, Introduction, "lack interactivity and scalability")
- The system generates initial maps with AI, then uses human-in-the-loop refinement for pedagogical accuracy and relevance. (p. 1, Introduction, "refined through human-in-the-loop")
- Learners explore concepts at varying depth via a custom interface, intended to support structured learning in intelligent textbooks. (p. 1, Introduction, "varying levels of depth")

### 2. Related work

- The paper reviews prior work on concept maps and navigable maps in learning systems, emphasizing visualization for comprehension and navigation. (p. 2, Related work, "navigable concept maps")
- It highlights evidence (as cited by the paper) that concept maps can improve learning outcomes and engagement, including interactive variants. (p. 2, Related work, "meta-analysis ... 142 studies")
- It situates this work as needing LLM-generated maps that enable nested exploration and immediate access to concept info plus student feedback in real contexts. (p. 3, End of Related work, "nested exploration and immediate access")

### 3. Interactive drill-down interface for hierarchical concept maps

- The interface supports layered drill-down navigation, on-demand concept generation, and in-context information display for intelligent textbooks. (p. 3, Section 3, "layered, LLM-augmented design")
- It contrasts with prior LLM concept-map construction work by emphasizing production-ready UI/UX and avoiding cognitive overload via hierarchy. (p. 3, Section 3, "overlooks the cognitive overload")

#### 3.1 Main map of the course and information panel

- The “Main Map” gives a hierarchical overview where nodes can be expanded to subtopics for “big picture” + detail on demand. (p. 3, Section 3.1, "central, interactive overview")
- An information panel/window shows explanations, examples, or supporting materials without leaving the map interface. (p. 3, Section 3.1, "displayed a concise explanation")

#### Child concept map (described in Section 3.1 area)

- Clicking a parent concept opens a child map with subtopics and related ideas, preserving interaction features like zoom/drag/click. (p. 4, Child concept map, "opens a dedicated map showing")
- The hierarchy is intended to deepen understanding without overwhelming the learner with a large flat map. (p. 4, Child concept map, "without overwhelming the learner")

#### 3.2 Infinite drill-down AI-based domain exploration

- When a learner reaches a terminal node and wants more, the system can generate new sub-maps dynamically using AI. (p. 5, Section 3.2, "generating new sub-maps dynamically")
- This enables exploration beyond predefined course content and supports personalized, self-directed inquiry, but introduces risks discussed later. (p. 5, Section 3.2, "introduces certain risks")

### 4. AI-Driven concept map generation with human-in-the-loop refinement

- The system generates maps by querying an LLM (example: GPT-4o-mini) using course metadata (course description + prompt-tuning commands). (p. 5, Section 4, "such as GPT-4o-mini")
- The paper lists an 8-step workflow covering course metadata creation, initial map generation, regeneration, concept information generation, refinement, and child map generation. (p. 6, Section 4, "end-to-end concept map development")
- It states submaps are automatically cached when creators navigate up to ~three nested levels, but refinement requires manual review for relevance and accuracy. (p. 6, Section 4, "submaps are automatically cached")

### 5. Limitations of Generic LLM-generated Concept Maps

- Limitation: generating from only title/metadata risks shallow or misaligned content for specialized domains; future work suggests RAG with course materials. (p. 7, Section 5, "risk of shallow or misaligned")
- Infinite drill-down risks: user disorientation and topic drift; proposed mitigations include depth limits and UX orientation cues. (p. 7, Section 5, "Disorientation"; p. 7, Section 5, "Topic Drift")
- Submap consistency issue: independently generated submaps may not match parent-map structure, causing gaps; needs tooling/validation. (p. 7, Section 5, "lack of continuity")

### 6. Architectural design of an AI-powered interactive concept map system

- Backend: Python server handles HTTP requests, calls OpenAI GPT-4o-mini API, stores course content in a file-based structure. (p. 7, Section 6, "backend, built in Python")
- Storage format per course includes meta.json, root concept map .txt, node description .txt files, and cached submaps. (p. 7, Section 6, "meta.json file, a root concept map")
- Frontend: Vis.js renders clickable maps; selecting a node shows info panel; drill-down navigation via parent-child links; instructor can edit generated content. (p. 7, Section 6, "frontend uses Vis.js")

#### 6.1 Prompt-Engineered Generation of Concept Maps

- Prompts combine user navigation inputs (topic/description/course code) with stored metadata and prompt-tuning instructions to define scope + output format. (p. 8, Section 6.1, "topic, a description, and a course code")
- The prompt instructs the LLM to produce a tree-like map (≥15 nodes, single root, no cycles) formatted as Vis.js-compatible JavaScript with labeled edges. (p. 8, Section 6.1, "Generate at least 15 nodes")
- Generated maps are cached as plain text; future requests reuse local files; instructors can delete/regenerate maps. (p. 8, Section 6.1, "served directly from the local file system")

#### 6.2 Prompt-Engineered Generation of Concept Pages

- Clicking a node triggers generation of a concept “page” as an HTML fragment (not a full document) using semantic tags and structured formatting rules. (p. 9, Section 6.2, "Generate a valid HTML fragment")
- Pages are cached and can be regenerated; the goal is consistent formatting and domain-specific detail. (p. 9, Section 6.2, "generated pages are cached")

#### 6.3 Content Management Panel

- Instructor-facing panel manages courses as folders (metadata, root map, nested maps, concept info files) and supports regeneration/editing. (p. 9, Section 6.3, "each represented as a folder")
- It supports editing via a UI and allows using third-party LLMs to refine content and align with instructor perspective. (p. 9, Section 6.3, "use third-party LLMs")

### 7. Evaluation: student feedback analysis

#### 7.1 Survey design

- Two courses used the tool; the paper reports counts of concept maps/pages generated per course and student survey participation. (p. 10, Section 7.1, "42 concept maps and 117")
- The survey includes satisfaction, engagement, review preference (text vs maps vs both), learning-new-content usefulness, and navigation usefulness questions. (p. 10, Section 7.1, "Overall, how satisfied")

#### 7.2 Survey results and analysis

- Reported averages: satisfaction 8.91/10; usefulness for learning new content 8.31/10; 91.4% said more engaging; 100% said clickable nested navigation helpful. (p. 10, Section 7.2, "average score of 8.91")
- Review preferences: 60% “both equally effective,” 34.3% prefer interactive maps, 5.7% prefer text-only. (p. 10, Section 7.2, "60% ... both")
- Open-ended feedback themes: valued clickability/depth navigation and visual structure; requested UI improvements and smoother interactions. (p. 11, Section 7.2, "Clickability and depth navigation")

### 8. Conclusion and future work

- The paper summarizes the platform as AI + prompt engineering + human-in-the-loop refinement on a Python + Vis.js architecture. (p. 12, Conclusion, "Python backend and a Vis.js")
- It reports totals across both courses: 69 concept maps and 245 concept descriptions, with survey results as evidence of perceived educational value. (p. 12, Conclusion, "69 AI-generated concept maps")
- Future work includes integrating RAG with course materials, improving UX orientation for deep drill-down, fixing submap consistency, and exploring agentic workflows. (p. 12, Conclusion, "integration of retrieval-augmented")

---

## D) System explained

### What the learner sees (UI/components)

- A main course concept map with clickable nodes and hierarchical structure. (p. 3, Section 3.1, "Main Map of the Course")
- A concept information panel/window showing explanations/examples for a selected node. (p. 3, Section 3.1, "displayed a concise explanation")
- Child concept maps that open when clicking/double-clicking a concept to drill into subtopics. (p. 4, Child concept map, "opens a dedicated map")

### What the learner does (actions)

- Clicks a node to view its concept explanation in the information panel. (p. 3, Section 3.1, "When a student clicked")
- Navigates deeper by opening child maps to explore subtopics at increasing depth. (p. 4, Child concept map, "progressively explore concepts")
- Uses “infinite drill-down” to request more subtopics beyond predefined content at terminal nodes. (p. 5, Section 3.2, "move beyond predefined content")

### What the system observes (signals/logs)

- Learner navigation events (node selection, drill-down actions) are implied by the interactive workflow and backend requests for map/pages. (p. 7, Section 6, "handles HTTP requests")
- Course metadata and prompt-tuning instructions that shape generation are stored and retrieved during map creation. (p. 6, Section 4, "course description and optional")

### What the system outputs (content/feedback/artifacts)

- Generated concept maps formatted as Vis.js-compatible JavaScript, cached locally for reuse. (p. 8, Section 6.1, "Format the output as JavaScript")
- Generated concept pages as HTML fragments (with code formatting and MathJax rules), cached locally. (p. 9, Section 6.2, "Return only the raw HTML")
- AI-generated submaps for infinite drill-down expansion. (p. 5, Section 3.2, "generate an extended concept map")

### What persists over time (storage/caching/notebook/history)

- Per-course files: meta.json, root map .txt, node description .txt files, and cached submaps in file storage. (p. 7, Section 6, "meta.json file")

---

## E) Content architecture

### Units

- Concept node (topic) as the primary unit in the map. (p. 3, Section 3.1, "Each concept was represented")
- Edge/relationship between concepts, with labeled semantics. (p. 8, Section 6.1, "Label all edges")
- Child concept map as a nested unit expanding a node into subtopics. (p. 4, Child concept map, "secondary, more focused map")
- Concept page/description shown in the information panel, generated as HTML fragment. (p. 9, Section 6.2, "one-page educational summary")

### Structure

- Hierarchy/tree-like map structure enabling drill-down navigation (root map → child maps). (p. 8, Section 6.1, "tree-like hierarchical structure")
- A map + information panel pairing for “in-context information display.” (p. 3, Section 3, "in-context information display")

### Attachment rules (concept → content)

- Clicking a concept node opens an information panel that fetches descriptive content via the LLM. (p. 6, Section 4, "Clicking a concept opens")
- Opening a node can generate subordinate maps enabling drill-down exploration. (p. 6, Section 4, "Generation of nested")

### Lifecycle (create → show → evaluate → revise → store)

- Create: instructor defines course metadata and triggers initial concept map generation via LLM. (p. 6, Section 4, "Initial concept map generation")
- Show: learner navigates map; selects nodes; reads info panel; drills down into child maps. (p. 3, Section 3.1, "When a student clicked")
- Revise: instructors can regenerate maps/pages or refine content using a standalone LLM and commit revisions. (p. 6, Section 4, "refinement using a standalone")
- Store: maps/pages/submaps are cached locally as text/HTML fragments in a file-based structure. (p. 8, Section 6.1, "cached as a plain text file")

### Dedup/reuse (caching, re-serving, versioning)

- Submaps are automatically cached during multi-level generation; repeated requests reuse local storage to avoid redundant API calls. (p. 6, Section 4, "submaps are automatically cached")

---

## F) Adaptation mechanics (not ML-heavy unless stated) — IF–THEN rules

### Triggers/signals observed

- IF an instructor provides course metadata and prompt-tuning instructions, THEN the system queries the LLM to generate a draft map. (p. 6, Section 4, "queries the LLM")
- IF a learner clicks a concept node, THEN the system opens an information panel and fetches concept info via LLM. (p. 6, Section 4, "Clicking a concept opens")
- IF a learner reaches a terminal node and requests deeper knowledge, THEN the system generates a new sub-map dynamically. (p. 5, Section 3.2, "generate an extended concept map")
- IF a previously generated map/submap is requested again, THEN it is served from local storage instead of calling the API. (p. 8, Section 6.1, "served directly from the local")

### Adaptation actions taken

- THEN the system provides hierarchical navigation (main map → child maps) so learners can choose depth on demand. (p. 4, Child concept map, "progressively explore concepts")
- THEN the system can expand the knowledge graph beyond predefined curriculum via infinite drill-down. (p. 5, Section 3.2, "move beyond predefined content")
- THEN instructors can delete/regenerate maps or regenerate concept pages when unsatisfactory. (p. 6, Section 4, "regenerate a new one")

### Learner-initiated vs system-initiated

- Learner-initiated: clicking nodes and drilling down to submaps at chosen depth. (p. 11, Section 7.2, "I can click and read")
- System-initiated: automatic caching and serving from file system; prompt rules enforcing tree/no cycles/format. (p. 8, Section 6.1, "avoiding redundant calls")

### Human-in-the-loop controls

- Instructors can refine maps and concept descriptions, including using a separate LLM interface (e.g., ChatGPT) and then committing changes. (p. 6, Section 4, "refinement using a standalone")
- The content management panel provides instructor edit access to map/page sources for oversight. (p. 9, Section 6.3, "Edit access to the source")

---

## G) Evaluation

### Setting/context

- Deployed in two university-level courses at American University Kyiv, used for end-of-course review/reflection. (p. 3, Section 3, "two university-level courses")

### Design

- Evaluation is based on student surveys (perception/usability/pedagogical value), not objective performance outcomes. (p. 11, Section 7.2, "focuses primarily on student perceptions")

### Participants and procedure

- Course 1 survey: 24 students; Course 2 survey: 11 students; total surveys: 35. (p. 10, Section 7.1, "24 students participated")
- The survey was administered at the final part of the course for recall and evaluation of map effectiveness. (p. 10, Section 7.1, "final part of the course")

### Measures

- Likert-style satisfaction (1–10) and usefulness for learning new content (1–10). (p. 10, Section 7.1, "Rated on a Likert scale")
- Engagement/enjoyment question and navigation usefulness question (click-to-related-map). (p. 10, Section 7.1, "learning more engaging")
- Review preference among text-only vs concept maps vs both. (p. 10, Section 7.1, "What do you think is more")
- Open-ended questions on useful features and improvements. (p. 10, Section 7.1, "What features of the app")

### Key results (include exact reported numbers)

- Satisfaction average 8.91/10; usefulness for learning new content average 8.31/10. (p. 10, Section 7.2, "average score of 8.91")
- 91.4% said the app made learning more engaging/enjoyable; 100% said nested-map navigation was helpful. (p. 10, Section 7.2, "91.4% agreed"; p. 10, Section 7.2, "100% of students")
- Review preference: 60% both equally effective; 34.3% interactive maps; 5.7% text-only. (p. 10, Section 7.2, "60% of students")
- Across both courses: 69 concept maps and 245 concept descriptions were created (reported in conclusion). (p. 12, Conclusion, "69 AI-generated concept maps")

---

## H) Limitations and failure modes

- Metadata-only generation can cause misalignment with instructor framing in specialized/rapidly evolving domains; future work proposes RAG with course materials. (p. 7, Section 5, "risk of shallow or misaligned")
- Infinite drill-down can cause disorientation and topic drift; future work proposes depth limits and UX cues. (p. 7, Section 5, "Disorientation"; p. 7, Section 5, "Topic Drift")
- Submap consistency problems can confuse concept progression because submaps are generated independently. (p. 7, Section 5, "Submap Consistency")
- Evaluation limitation: focuses on student perceptions rather than objective performance metrics. (p. 11, Section 7.2, "rather than objective performance")

---

# PROJECT RELEVANCE

## I) Where this overlaps with our project (“What’s already been done that is similar?”)

| Paper feature/idea | Evidence (citation) | Closest match to our project component | Notes on mapping to SQL learning |
|---|---|---|---|
| Hierarchical drill-down navigation for layered access to knowledge | (p. 1, Abstract, "hierarchical drill-down navigation") | 2) intelligent/adaptive textbook artifact | Could represent SQL concepts as hierarchical maps (SELECT → WHERE → GROUP BY → HAVING). |
| In-context info panel showing explanations/examples without leaving structure | (p. 3, Section 3.1, "displayed a concise explanation") | 1) adaptive instructional content beyond hints | Similar UI pattern for “My Notes” popovers anchored to error/concept nodes. |
| Human-in-the-loop refinement workflow with regeneration/editing | (p. 1, Abstract, "human-in-the-loop content refinement") | 2) intelligent/adaptive textbook artifact | Instructor review loop for generated SQL notes and concept pages. |
| Caching/reuse of generated submaps and serving from local files | (p. 6, Section 4, "submaps are automatically cached") | 5) trace-to-content mapping / learning-from-logs | Similar to caching per-concept note units reused across many trace events. |
| Expansion beyond predefined content via infinite drill-down | (p. 5, Section 3.2, "generate new sub-maps dynamically") | 1) adaptive instructional content beyond hints | Comparable to on-demand deeper explanations when learner requests more detail. |

## J) Where the paper falls short for our needs

- Offline replay evaluation over logged traces is not discussed; evaluation is survey-based perception. (p. 11, Section 7.2, "student perceptions")

## K) How our idea is different

- Our idea differs because… we adapt content from SQL interaction traces (errors/retries/hint use), while this system adapts mainly through hierarchical navigation and on-demand AI drill-down. (p. 5, Section 3.2, "on-demand expansion")
- Our idea differs because… we maintain a persistent learner-facing “My Notes/My Textbook” that accumulates and reorganizes; this paper describes caching system files but not learner-specific accumulation logic. (p. 7, Section 6, "stores course content in a file")
- Our idea differs because… our core control problem is escalation beyond hints only when needed; this paper focuses on concept-map exploration and information panels rather than hint-level interventions. (p. 3, Section 3.1, "just-in-time information")
- Our idea differs because… we plan offline strategy comparisons via replay; this paper evaluates perceived usefulness via surveys. (p. 11, Section 7.2, "student perceptions")

---

## L) Actionable “steal-this” design patterns

### Hierarchy to prevent cognitive overload (drill-down instead of flat maps)

- Hierarchy to prevent cognitive overload (drill-down instead of flat maps)
- What it does: keeps the “big picture” while allowing depth on demand via child maps. (p. 3, Section 3.1, "see the “big picture”")
- SQL implementation: organize SQL concepts/errors into layered maps; surface deeper subtopics only after repeated confusion.

### Info panel anchored to structure (in-context explanations/examples)

- Info panel anchored to structure (in-context explanations/examples)
- What it does: lets learners read explanations without leaving the map, preserving flow. (p. 3, Section 3.1, "without leaving the map")
- SQL implementation: show concise “why this error happened” + minimal example in a side panel linked to the error/concept node.

### Cache generated submaps to control cost/latency

- Cache generated submaps to control cost/latency
- What it does: stores generated submaps locally to avoid repeated LLM calls. (p. 8, Section 6.1, "avoiding redundant calls")
- SQL implementation: cache validated note units (templates/examples) keyed by concept+error subtype.

### Instructor “delete/regenerate” as a simple quality control primitive

- Instructor “delete/regenerate” as a simple quality control primitive
- What it does: gives a straightforward rollback path when generated structure/content is unsatisfactory. (p. 6, Section 4, "clear it and regenerate")
- SQL implementation: allow instructors (or QA pipeline) to invalidate a note unit and regenerate under controlled prompts.

### Explicit prompt constraints for structure correctness

- Explicit prompt constraints for structure correctness
- What it does: requires a single root, no cycles, and a specific output format compatible with the frontend. (p. 8, Section 6.1, "single root concept")
- SQL implementation: enforce structured output for notebook units (fields + concept tags + evidence links to traces).

---

## M) Final takeaway

- This paper shows how an “intelligent textbook” can become more interactive by turning course knowledge into a navigable hierarchy of concepts, where students can drill down into subtopics and read in-context explanations via an information panel. (p. 1, Abstract, "interactive concept maps"; p. 3, Section 3.1, "concise explanation")
- It also illustrates a pragmatic production approach: use LLMs to bootstrap structure quickly, cache outputs for reuse, and rely on human-in-the-loop refinement plus UI/UX design to keep navigation usable and content pedagogically aligned. (p. 6, Section 4, "human-in-the-loop refinement"; p. 8, Section 6.1, "served directly from the local")

# Paper 7

## Instruction-fit notes

- This paper is directly about metacognitive scaffolding cues (Understand–Plan–Reflect), which maps well to your focus on reflective/on-demand instructional artifacts rather than “ML-heavy tutoring.” (p. 1, Abstract, "understanding a task, planning a solution, and reflecting")
- The “adaptation” described is mainly cue type selection (U/P/R) + human review, with personalization based on student performance data framed as future work, not a current mechanism. (p. 2, Introduction, "human-in-the loop framework"; p. 10, Future Work, "personalized scaffolding cues based on student-level")
- The paper gives concrete content units, insertion anchors, and lifecycle (10 candidates → select top 3 → rubric scoring), so your “content architecture + policy” extraction is feasible. (p. 4, Scaffolding Cue Generation, "generate 10 candidate scaffolding cues")

---

## A) Full citation

- Durg, A., Kultur, C., Zhang, A., & Savelka, J. (2025). LLM-powered Framework for Automatic Generation of Metacognitive Scaffolding Cues for Introductory Programming in Higher Education. iTextbooks’25: Sixth Workshop on Intelligent Textbooks, July 26, 2025, Palermo, Italy. CEUR Workshop Proceedings. (p. 1, Title/Footer, "iTextbooks’25: Sixth Workshop on Intelligent Textbooks")
- License/venue metadata: CC BY 4.0; CEUR Workshop Proceedings; ISSN 1613-0073. (p. 1, Footer, "Creative Commons License Attribution 4.0")

---

## B) Summary

- The paper evaluates whether LLMs can generate instructional scaffolding cues for intro Python exercises that prompt students to Understand, Plan, and Reflect while coding. (p. 1, Abstract, "generate scaffolding cues ... understanding, planning, and reflecting")
- They generate 126 cues across 14 exercises using GPT-4 and TinyLlama, then evaluate (1) whether cues are recognizable as U/P/R and (2) whether cues meet rubric criteria (clarity, relevance, depth), reporting strong type recognition and higher quality for GPT-4. (p. 1, Abstract, "generate 126 scaffolding cues"; p. 8, GPT-4 vs TinyLlama, "GPT-4 ... mean rubric score of 0.83")

---

## C) Section-by-section reading

### Abstract

- Defines scaffolding cues as prompts guiding structured reasoning phases (Understand/Plan/Reflect) for programming exercises. (p. 1, Abstract, "guide students through structured reasoning phases")
- Describes generating 126 cues for 14 exercises using GPT-4 and TinyLlama and evaluating type correctness + instructional quality. (p. 1, Abstract, "generate 126 scaffolding cues ... for 14")
- Reports expert confirmation of intended reasoning type in 92% overall and notes reflective cues show more variation/harder evaluation. (p. 1, Abstract, "confirming the correctness ... in 92%")
- Claims GPT-4 cues more likely to meet quality criteria than TinyLlama, especially for Reflect cues. (p. 1, Abstract, "GPT-4 ... more likely to meet")

### 1. Introduction

- Motivates scaffolding cues as helping students “ask the right question” and support independent problem solving at scale. (p. 1, Introduction, "Finding the right answer ... asking the right question")
- Frames the main cost as manual authoring of multiple cues per task and argues LLMs could reduce instructor effort. (p. 2, Introduction, "may be prohibitively expensive"; p. 1, Abstract, "help reduce the time instructors spend")
- Introduces a human-in-the-loop framework using three reasoning-support types inspired by Polya: Understand, Plan, Reflect. (p. 2, Introduction, "human-in-the loop framework"; p. 2, Introduction, "inspired by ... Polya")
- States two research questions: RQ1 (semantic recognizability of type) and RQ2 (quality via clarity/relevance/depth). (p. 2, Introduction, "RQ1: To what degree"; p. 2, Introduction, "RQ2: How well")

### 2. Related Work

- Argues reasoning before/during/after coding matters and cites prior work on planning and reflection scaffolds in programming contexts. (p. 2, Related Work, "reason before, during, and after coding")
- Positions their novelty as focusing on cues explicitly categorized by reasoning types rather than general correctness/explanation quality. (p. 3, Related Work, "comparatively little work ... categorized")
- Describes Sail() as an online platform functioning as an interactive textbook with embedded exercises and cues. (p. 1, Introduction, "Sail(), an online platform")

### 3. Dataset

- Dataset: 14 coding exercises from “Practical Programming with Python” on Sail(), focusing on Unit 2 and Unit 3. (p. 3, Dataset, "dataset of 14 coding exercises")
- Unit scope includes tasks like Color Game and Data Structures-related task(s), chosen because exercises are small and suitable for inserting cues. (p. 3, Dataset, "relatively small and focused")
- Notes that exercises include embedded TODO comments, which serve as anchors for inserting scaffolding cues. (p. 4, Scaffolding Cue Generation, "embedded “TODO” comments")

### 4. Experiments

- The evaluation is two-part: RQ1 (type correctness) and RQ2 (rubric-based quality). (p. 3, Experiments, "two-part evaluation framework")

#### Scaffolding Cue Generation (pipeline)

- For each exercise and each reasoning type (U/P/R), the LLM prompt includes task description, code context, target type, and a rubric-aligned template (few-shot for GPT-4). (p. 4, Scaffolding Cue Generation, "prompt ... contained")
- Uses GPT-4 (gpt-4-0613 via OpenAI API) and TinyLlama (1.1B local), with few-shot vs simplified zero-shot prompting respectively. (p. 4, Scaffolding Cue Generation, "GPT-4 (gpt-4-0613)"; p. 4, Scaffolding Cue Generation, "TinyLlama (1.1B)")
- Generates 10 candidates per (exercise × type), then manually selects top 3 with constraints: 2 GPT-4 cues + 1 TinyLlama cue. (p. 4, Scaffolding Cue Generation, "generate 10 candidate"; p. 4, Scaffolding Cue Generation, "2 ... from GPT-4")
- Total dataset size computed as 14 exercises × 3 types × 3 cues = 126 cues. (p. 4, Scaffolding Cue Generation, "126 scaffolding cues in total")

#### 4.1 RQ1: Cue Type Correctness

- Samples 42 cues (one high-quality cue of each type per exercise from GPT-4 outputs), shuffles them, removes type indicators, then an author classifies each cue as U/P/R using Table 2 rubric definitions. (p. 6, RQ1, "randomly sampled"; p. 6, Annotation Procedure, "using only the rubric")
- Metric is accuracy comparing intended label (prompt) vs annotation; mistakes are reviewed. (p. 6, Evaluation Metrics, "We calculated accuracy")

#### 4.2 RQ2: Scaffolding Cue Quality

- Two authors score all 126 cues using a structured 9-item binary rubric (3 criteria per reasoning type), then aggregate to rubric score = (#Yes)/3. (p. 6, RQ2, "scored the full set of 126"; p. 6, Evaluation, "Rubric Score =")

### 5. Results

- Reports RQ1 classification accuracies by type and a confusion matrix; most errors occur between Plan and Understand. (p. 7, Results, "Most errors occurred between Plan and Understand")
- Reports RQ2 reviewer disagreements and trait-level differences; notes rubric needs improvement due to low agreement. (p. 8, RQ2, "very little agreement"; p. 9, Discussion, "rubric itself was still being refined")
- Compares GPT-4 vs TinyLlama mean rubric scores (0.83 vs 0.67) across all types/traits. (p. 8, GPT-4 vs TinyLlama, "mean rubric score of 0.83")

### 6. Discussion

- Interprets results as evidence that GPT-4 can generate cues aligned with intended reasoning types and generally meeting instructional criteria, but reflection-related traits are harder to score consistently. (p. 9, Discussion, "semantically distinct across reasoning types"; p. 9, Discussion, "harder to score consistently")
- Emphasizes need for human review and alignment with instructor intent, since instructors may value clarity/depth differently. (p. 9, Discussion, "importance of human review")

### 7. Conclusions

- Concludes LLMs (especially GPT-4) can help instructors generate reasoning-aligned cues to reduce manual effort and support student thinking in programming tasks. (p. 10, Conclusions, "reduce manual effort")
- Summarizes the dataset and evaluation approach (126 cues; 14 exercises; RQ1 type confirmation; RQ2 rubric scoring). (p. 10, Conclusions, "generated a dataset of 126")

### 8. Future Work

- Plans to test cues in real classrooms with outcome metrics and A/B tests comparing LLM vs expert cues, and refine the rubric to reduce scorer disagreement. (p. 10, Future Work, "real classrooms"; p. 10, Future Work, "A/B test")
- Mentions exploring whether cues can be personalized based on student-level performance data. (p. 10, Future Work, "personalized scaffolding cues")

### Declaration on Generative AI

- States they used ChatGPT-4 and TinyLlama to generate candidate cues and for writing support, with authors reviewing/editing and taking responsibility. (p. 10, Declaration, "used ChatGPT-4 and TinyLlama")

---

## D) System explained

### What the learner sees (UI/components)

- An interactive textbook-like platform (Sail()) with embedded programming exercises; cues are inserted at exercises (anchors via TODOs). (p. 1, Introduction, "functions as an interactive textbook"; p. 4, Scaffolding Cue Generation, "embedded “TODO” comments")
- Scaffolding cues presented as prompts asking questions aligned to Understand, Plan, or Reflect (examples shown for a specific function in Table 1). (p. 5, Table 1, "Understand, Plan, and Reflect scaffolding prompts")
- A coding exercise interface (Figure 1) where cues were “added at each exercise for evaluation.” (p. 4, Figure 1 caption, "Scaffolding cues were added")

### What the learner does (actions)

- Reads a cue and uses it to interpret the task, plan code structure, or reflect on implementation/testing. (p. 4, Scaffolding Cue Generation, "Helps the student interpret"; p. 4, Scaffolding Cue Generation, "Encourages the student to analyze")
- Writes code in an in-browser environment for small function-implementation exercises. (p. 3, Dataset, "implement functions directly in a simple in-browser")

### What the system observes (signals/logs)

- Uses the exercise’s task description and nearby code context around the TODO to prompt the LLM. (p. 4, Scaffolding Cue Generation, "code context around the exercise")
- Uses the requested reasoning type label (U/P/R) as an explicit control input to the generation prompt. (p. 4, Scaffolding Cue Generation, "target reasoning type (U/P/R)")

### What the system outputs (content/feedback/artifacts)

- Produces candidate natural-language scaffolding cues for each exercise and reasoning type, from GPT-4 and TinyLlama. (p. 4, Scaffolding Cue Generation, "generate 10 candidate scaffolding cues")
- Outputs a curated set of 3 cues per (exercise × type) after manual selection (2 GPT-4, 1 TinyLlama). (p. 4, Scaffolding Cue Generation, "selected the best three")

### What persists over time (storage/caching/notebook/history)

- Persistent storage/learner history integration is not described; the artifact described is a dataset of cues generated for evaluation. (p. 10, Conclusions, "generated a dataset of 126")

---

## E) Content architecture

### Units (chunk/page/node/hint/explanation/summary/etc.)

- Scaffolding cue: a short instructional prompt/question intended to guide reasoning. (p. 1, Abstract, "Scaffolding cues are instructional prompts")
- Reasoning type label: Understand vs Plan vs Reflect used to shape cue content. (p. 2, Introduction, "three reasoning-support types")
- Exercise anchor: TODO comments used as insertion points for cues inside programming exercises. (p. 4, Scaffolding Cue Generation, "embedded “TODO” comments")

### Structure (sequence/tree/graph/map; how units connect)

- For each exercise, there are three parallel cue sets aligned to U/P/R; cues are embedded “within problem statements” at exercise points. (p. 4, Scaffolding Cue Generation, "generated scaffolding cues targeting")
- The course is organized into instructional units (Unit 2, Unit 3) containing tasks and multiple coding exercises suitable for cue insertion. (p. 3, Dataset, "structured into eight instructional units")

### Attachment rules (task→unit, concept→unit, error→unit, etc.)

- Cues are attached to exercises via TODO anchors and guided by the specific task description and code context. (p. 4, Scaffolding Cue Generation, "code context around the exercise")
- Each cue is explicitly attached to a reasoning type category (U/P/R) in generation and evaluation. (p. 6, Annotation Procedure, "Understand, Plan, or Reflect")

### Lifecycle (create → show → evaluate → revise → store) if described

- Create: prompt LLM with task description + code context + type + template; generate 10 candidates per type per exercise. (p. 4, Scaffolding Cue Generation, "The prompt submitted ... contained"; p. 4, Scaffolding Cue Generation, "generate 10 candidate")
- Curate: an author selects the best 3 cues per type with a fixed 2:1 model mix constraint. (p. 4, Scaffolding Cue Generation, "selected the best three"; p. 4, Scaffolding Cue Generation, "2 scaffolding cues from GPT-4")
- Evaluate: RQ1 type recognizability via blinded classification; RQ2 quality via rubric scoring across 126 cues. (p. 6, RQ1, "randomly shuffled"; p. 6, RQ2, "scored the full set")
- Store: the output is presented as a dataset of 126 cues for analysis; long-term revision/versioning not specified. (p. 10, Conclusions, "generated a dataset of 126")

---

## F) Adaptation mechanics (not ML-heavy unless stated) — IF–THEN rules grounded in the paper

### Triggers/signals observed

- IF an exercise has a TODO anchor and associated task description + code context, THEN it can be used to prompt an LLM to generate cues. (p. 4, Scaffolding Cue Generation, "embedded “TODO” comments")
- IF a target reasoning type (Understand/Plan/Reflect) is specified, THEN the prompt requests a cue aligned to that reasoning type. (p. 4, Scaffolding Cue Generation, "target reasoning type (U/P/R)")

### Adaptation actions taken

- IF generating cues for an (exercise × type), THEN generate 10 candidates and manually select 3 “best” cues for the final set. (p. 4, Scaffolding Cue Generation, "generate 10 candidate"; p. 4, Scaffolding Cue Generation, "selected the best three")
- IF selecting final cues, THEN enforce the constraint of 2 GPT-4 cues and 1 TinyLlama cue. (p. 4, Scaffolding Cue Generation, "2 scaffolding cues from GPT-4")

### Escalation ladder (hint→explanation→reflection)

- An explicit hint→explanation escalation ladder is not stated; the scaffold types are Understand/Plan/Reflect prompts rather than multi-step hinting. (p. 4, Scaffolding Cue Generation, "Understand ... Plan ... Reflect")

### Learner-initiated vs system-initiated

- Learner-initiated selection of cue types is not described; cues are “added at each exercise for evaluation.” (p. 4, Figure 1 caption, "added at each exercise")
- System-/author-initiated generation and selection is described as a human-AI pipeline. (p. 5, Figure 2 caption, "generation was fully automated"; p. 5, Figure 2 caption, "selection was manual")

### Human-in-the-loop controls

- Human review is built in: an author selects the best cues, and experts score/validate type and quality; authors emphasize human oversight due to rubric disagreement and instructional intent. (p. 4, Scaffolding Cue Generation, "reviewed these and selected"; p. 9, Discussion, "importance of human review")

---

## G) Evaluation

### Setting/context (course/platform/domain/content source)

- Domain is an introductory Python programming course delivered on Sail(), described as an interactive textbook platform. (p. 3, Dataset, "introductory Python programming"; p. 1, Introduction, "functions as an interactive textbook")
- Exercises come from Unit 2 (Control Flow and String Manipulation) and Unit 3 (Data Structures). (p. 3, Dataset, "Unit 2 ... Unit 3")

### Design (conditions/baselines/randomization) if any

- RQ1: blinded classification of 42 cues sampled from GPT-4 outputs (one per type per exercise), shuffled with type indicators removed. (p. 6, RQ1, "randomly sampled"; p. 6, RQ1, "randomly shuffled")
- RQ2: rubric scoring of all 126 cues by two reviewers independently using a 9-item binary rubric (3 criteria per type). (p. 6, RQ2, "scored the full set"; p. 6, Rubric-Based Evaluation, "structured 9-item binary rubric")

### Participants and procedure

- “Expert annotators” evaluate correctness of reasoning type and quality via rubric; RQ1 uses one author; RQ2 uses two other authors as reviewers. (p. 1, Abstract, "expert annotators"; p. 6, Annotator Assignment, "Two authors")
- Live classroom testing of cue impact is not performed in this paper. (p. 9, Limitations, "did not test ... in live instructional")

### Measures (learning, UX, artifact quality, logs)

- RQ1 metric: classification accuracy of cue type based on rubric definitions. (p. 6, Evaluation Metrics, "We calculated accuracy")
- RQ2 metric: rubric score = (#Yes on relevant criteria)/3, averaged by cue type and trait. (p. 6, Evaluation, "Rubric Score =")

### Analysis methods (stats/tests/models) only if explicitly stated

- For RQ2, they analyze reviewer differences and report raw results due to low agreement; they interpret variance as insight into differing pedagogical lenses. (p. 8, RQ2, "report the raw results"; p. 8, RQ2, "differences in reviewer interpretation")

### Key results (include exact reported numbers)

- Dataset size: 14 exercises × 3 cue types × 3 cues = 126 scaffolding cues. (p. 4, Scaffolding Cue Generation, "126 scaffolding cues in total")
- RQ1 accuracies: Understand 20/20 (100%); Plan 29/34 (85.3%); Reflect 32/34 (94.1%). (p. 7, Results, "Understand: 20/20 correct")
- Confusion matrix shows Plan misclassified as Understand (5), Reflect misclassified as Understand (2), and no Reflect misclassified as Plan. (p. 7, Table 3, "Plan 5 29 0"; p. 7, Results, "no Reflect ... misclassified as Plan")
- Reviewer agreement issue: “very little agreement” between two annotators, suggesting rubric needs improvement. (p. 8, RQ2, "very little agreement")
- Model comparison: GPT-4 cues (n=84) mean rubric score 0.83; TinyLlama cues (n=42) mean rubric score 0.67. (p. 8, GPT-4 vs TinyLlama, "mean rubric score of 0.83")

---

## H) Limitations and failure modes

- They did not test cues in live settings, so they do not claim impact on learning, engagement, or performance. (p. 9, Limitations, "cannot make claims ... impact")
- Limited scope: only 126 cues, 14 exercises, limited cue types and reviewers; more tasks/reviewers needed for broader validity. (p. 9, Limitations, "small dataset"; p. 9, Limitations, "Including more types")
- Human interpretation may bias selection, model completions, and rubric scoring. (p. 9, Limitations, "Bias may have influenced")
- Rubric immaturity: disagreement suggests need for clearer anchors/calibration, especially for Plan clarity and Reflective depth. (p. 9, Discussion, "rubric itself was still being refined"; p. 10, Future Work, "rubric refinement")

---

# PROJECT RELEVANCE

## I) Where this overlaps with our project (“What’s already been done that is similar?”)

| Paper feature/idea | Evidence (citation) | Closest match to our project component | Notes on mapping to SQL learning |
|---|---|---|---|
| Metacognitive prompts structured as Understand–Plan–Reflect | (p. 1, Abstract, "understanding a task, planning a solution, and reflecting") | 4) reflective/accumulative learning artifacts | Use U/P/R prompts after SQL attempts to build reflective “My Notes” entries. |
| Embedding cues directly into an “interactive textbook” next to exercises | (p. 1, Introduction, "functions as an interactive textbook") | 2) intelligent/adaptive textbook artifact | SQL problems in an interactive environment can embed cue prompts near query editor checkpoints. |
| Human-in-the-loop cue curation (quality control) | (p. 4, Scaffolding Cue Generation, "reviewed these and selected the best three") | 1) adaptive instructional content beyond hints | Similar to instructor-approved template libraries for SQL misconceptions and reflective prompts. |
| Rubric-driven evaluation of instructional artifact quality | (p. 6, Rubric-Based Evaluation, "structured 9-item binary rubric") | 5) trace-to-content mapping / learning-from-logs | We can score generated SQL notes/prompts using rubrics (clarity/relevance/depth) before surfacing. |
| Personalization via student-level performance data proposed | (p. 10, Future Work, "personalized scaffolding cues based on student-level") | 5) trace-to-content mapping / learning-from-logs | Directly aligns with adapting SQL “My Textbook” based on error/retry/hint-use signals. |

## J) Where the paper falls short for our needs

- It does not implement trace-triggered adaptation using logged errors/retries/timing/hint-use; personalization from performance data is future work only. (p. 10, Future Work, "personalized scaffolding cues"; p. 9, Limitations, "did not test ... live")
- Persistent learner notebook accumulation/dedup/reordering is not described (the artifact is a cue dataset and evaluation). (p. 10, Conclusions, "generated a dataset of 126")
- Escalation policy from hints to deeper explanations is not specified; the intervention is prompting reasoning via U/P/R cues. (p. 4, Scaffolding Cue Generation, "Understand ... Plan ... Reflect")
- Offline replay evaluation over interaction traces is not described; evaluation is expert review + rubric scoring of generated cues. (p. 6, RQ2, "scored the full set"; p. 9, Limitations, "did not test")

## K) How our idea is different

- Our idea differs because… we adapt “My Notes/My Textbook” from interaction traces (errors, retries, hint-use), while this paper generates cues from task + code context and evaluates offline without live trace-driven triggering. (p. 4, Scaffolding Cue Generation, "code context around the exercise"; p. 9, Limitations, "did not test ... live")
- Our idea differs because… we emphasize persistent accumulation and reorganization of learner-facing artifacts across many tasks; this paper focuses on per-exercise cue generation and rubric evaluation. (p. 10, Conclusions, "generated a dataset of 126")
- Our idea differs because… we want an escalation ladder (hint → explanation → reflection) where deeper content appears only when needed; this paper’s intervention is primarily reflective prompting (U/P/R) rather than escalated explanations. (p. 4, Scaffolding Cue Generation, "Encourages the student to analyze")
- Our idea differs because… we plan offline replay comparisons of multiple adaptive policies over the same logs; this paper compares models via rubric scores and type recognizability, not policy replay. (p. 6, RQ2, "rubric"; p. 8, GPT-4 vs TinyLlama, "mean rubric score")

---

## L) Actionable “steal-this” design patterns

### U/P/R as a minimal, inspectable “reflection ladder”

- U/P/R as a minimal, inspectable “reflection ladder”
- What it does: standardizes reflective support into three cue types tied to task interpretation, solution planning, and post-work reflection. (p. 2, Introduction, "Understand ... Plan ... Reflect")
- SQL implementation: map repeated SQL failures to “Plan” prompts; post-solution to “Reflect” prompts; new concept introductions to “Understand” prompts.

### TODO / checkpoint anchors for inserting prompts

- TODO / checkpoint anchors for inserting prompts
- What it does: uses embedded TODO comments as natural insertion points for cues within exercises. (p. 4, Scaffolding Cue Generation, "embedded “TODO” comments")
- SQL implementation: define checkpoints (after parse error, after wrong output, after hint request) as anchors to display reflective prompts or notebook entries.

### Generate-many → curate-few with explicit constraints

- Generate-many → curate-few with explicit constraints
- What it does: generates 10 candidates per (exercise × type), then selects 3 with a fixed mix across models. (p. 4, Scaffolding Cue Generation, "generate 10 candidate"; p. 4, Scaffolding Cue Generation, "2 ... GPT-4")
- SQL implementation: generate multiple candidate note snippets per error subtype; keep 1–2 after automated + human QA; log which candidate was chosen.

### Rubric-based artifact quality scoring

- Rubric-based artifact quality scoring
- What it does: evaluates cues with a 9-item binary rubric (3 criteria per type), aggregated into an interpretable score. (p. 6, Rubric-Based Evaluation, "structured 9-item binary rubric")
- SQL implementation: score generated “My Notes” units (clarity/relevance/depth) before storing/surfacing; use low scores to trigger regeneration or human review.

### Treat annotator disagreement as a design signal

- Treat annotator disagreement as a design signal
- What it does: reports reviewer disagreement and interprets it as reflecting different pedagogical lenses, motivating rubric refinement/calibration. (p. 8, RQ2, "very little agreement"; p. 9, Discussion, "different perspectives")
- SQL implementation: when instructors disagree on note quality, treat it as evidence the rubric or note templates need clearer anchors (especially for “depth”).

---

## M) Final takeaway

- This paper shows that LLMs can generate metacognitive scaffolding cues that prompt students to understand the task, plan their solution, and reflect on their work during programming exercises, and that experts can usually recognize the intended cue type from the prompt alone. (p. 1, Abstract, "align with their intended reasoning type"; p. 7, Results, "classification accuracy was promising")
- It also highlights a practical production lesson for intelligent/adaptive textbooks: cue quality needs rubric-driven evaluation and human oversight, especially for deeper reasoning prompts like reflective depth, where reviewers may disagree and rubrics may need refinement. (p. 8, RQ2, "very little agreement"; p. 9, Discussion, "importance of human review")

# Paper 8

## Instruction-fit notes

- Page numbers and section headings are visible, so your required citation format is feasible throughout. (p. 1, Abstract, "Improving Textbook Accessibility through AI Simplification")
- The “adaptation” here is student-initiated, on-demand text simplification (highlight → simplify → side-panel output), not trace-triggered escalation beyond hints. (p. 2, Introduction, "Students can highlight a passage of text and select "Simplify"")
- The paper provides concrete content-unit definitions, prompt constraints, and large-scale log analysis (54,371 interactions), which matches your “content organization + evidence” focus. (p. 1, Abstract, "analyzed 54,371 simplifier interactions")

---

## A) Full citation

- Benny G. Johnson, Bill Jerome, Jeffrey S. Dittel, and Rachel Van Campenhout. Improving Textbook Accessibility through AI Simplification: Readability Improvements and Meaning Preservation. iTextbooks’25: Sixth Workshop on Intelligent Textbooks, July 26, 2025, Palermo, Italy. CEUR Workshop Proceedings. (p. 1, Title/Footer, "iTextbooks'25: Sixth Workshop on Intelligent Textbooks")
- License/venue metadata: CC BY 4.0; CEUR Workshop Proceedings; ISSN 1613-0073. (p. 1, Footer, "Creative Commons License Attribution 4.0")

---

## B) Summary

- The paper studies an LLM-based “Simplify” feature embedded in a higher-ed eReader that lets students select a textbook passage and receive a simplified version in a side panel. (p. 1, Abstract, "select a textbook passage and receive a simplified version")
- Using 54,371 real student simplification events, it reports large readability gains while largely preserving meaning (semantic fidelity), positioning this as groundwork for future studies on student perception and comprehension outcomes. (p. 1, Abstract, "reduce complexity ... while maintaining meaning")

---

## C) Section-by-section reading

### Abstract

- The tool is an LLM-powered “simplifier” in an eReader that transforms selected textbook passages into simplified text. (p. 1, Abstract, "create a “simplifier” tool")
- The study analyzes large-scale authentic usage logs to compare original vs simplified passages on readability, simplification, and semantic fidelity. (p. 1, Abstract, "analyzed 54,371 simplifier interactions")
- Main finding: reduced complexity while maintaining meaning, with implications for textbook accessibility. (p. 1, Abstract, "reduce complexity ... while maintaining meaning")

### 1. Introduction

- The motivation is that students often do not read textbooks as expected, and some report needing scaffolding due to complexity and intimidation by language. (p. 1, Introduction, "students noted they needed scaffolding")
- The paper frames readability as an access/equity issue, arguing struggling readers lack equal access to course material. (p. 2, Introduction, "an equity issue")
- It argues LLMs can manipulate language “as directed,” making them promising for simplifying complex academic text at scale. (p. 2, Introduction, "ability to manipulate language as directed")
- The deployed feature: in VitalSource Bookshelf, students highlight a passage and click “Simplify” to get simplified text in a side chat panel. (p. 2, Introduction, "highlight a passage ... select "Simplify"")
- After simplification, the UI prompts the student to restate the content or request another simplification, but this study analyzes only the initial event. (p. 2, Introduction, "prompted to attempt to restate")
- Research questions: RQ1 readability improvement; RQ2 meaning preservation. (p. 4, Research Questions, "RQ1: To what extent")

### 2. Method

#### 2.1 Simplification Procedure

- Simplifications are generated with OpenAI GPT-4o in real time upon student request inside the eReader interface. (p. 4, Method 2.1, "generated using OpenAI GPT-4o")
- Parameters are set for determinism/consistency: temperature=0, top_p=1, max_tokens=4095. (p. 4, Method 2.1, "temperature = 0, top_p = 1")
- The prompt frames the model as a “helpful college professor,” reducing complexity and lowering reading level by ~4 grade levels while maintaining a positive tone. (p. 4, Method 2.1, "act as a helpful college professor")
- The prompt includes instructions to substitute specialized terms with simpler vocabulary, but does not specify target output length or explicitly prevent summarization beyond simplification. (p. 4, Method 2.1, "no explicit instructions ... target length")
- Context included: the selected passage plus surrounding content (paragraph + enclosing section/subsection), though extraction may not align perfectly due to textbook formatting. (p. 4, Method 2.1, "including the immediate paragraph")
- No post-simplification filters or fidelity checks are applied during real-time interactions. (p. 4, Method 2.1, "No additional post-simplification filters")

#### 2.2 Data Collection and Analysis

- Data spans Sep 1, 2024 to Apr 30, 2025 and includes 54,371 events from 11,689 students across 2,082 textbooks. (p. 4, Method 2.2, "54,371 events ... 11,689 students")
- The dataset is reported as publicly available in an open-source repository. (p. 4, Method 2.2, "publicly available ... open-source")
- Most usage is from US/Canada higher-ed institutions; no student demographics were collected. (p. 4, Method 2.2, "Almost 95% ... United States and Canada")
- Metrics are grouped into readability, lexical simplification, syntactic simplification, and semantic fidelity, computed for both original and simplified text. (p. 4, Method 2.2, "impact ... quantified along four dimensions")

### 3. Results and Discussion

- The paper summarizes outcomes in Table 1 (means, SDs, quartiles) across readability, lexical, syntactic, and semantic metrics. (p. 7, Results, "Table 1 presents descriptive statistics")

#### 3.1 Readability

- Before simplification, mean FKGL is 16.65; after simplification the mean FKGL decreases by 7.37 to 9.28. (p. 7, Results 3.1, "mean FKGL ... 16.65"; p. 7, Table 1, "Δ FKGL -7.37")
- Mean FRE increases by ~31 points, consistent with easier-to-read output. (p. 7, Results 3.1, "mean FRE increase ... 31"; p. 7, Table 1, "Δ FRE 31.34")

#### 3.2 Lexical Simplification

- Lexical simplification is measured using changes in content-word frequency via Δ log p and average word length. (p. 5, Method, "change in mean corpus log probability")
- Mean Δ log p is 1.02 (interpreted as replacing less frequent words with more common ones), and mean word length decreases by 0.41 characters per word. (p. 7, Table 1, "Δ log p 1.02"; p. 7, Table 1, "Δ chars / word -0.41")

#### 3.3 Syntactic Simplification

- Syntactic simplification is measured using dependency tree depth and sentence length changes. (p. 5, Method, "dependency tree depth")
- Mean dependency depth decreases by 0.98 and mean words per sentence decreases by 14.62. (p. 7, Table 1, "Δ dependency depth -0.98"; p. 7, Table 1, "Δ words / sentence -14.62")

#### 3.4 Semantic Fidelity

- Semantic fidelity is primarily evaluated by cosine similarity between embeddings of original and simplified text; mean cosine similarity is 0.85. (p. 5, Method, "cosine similarity"; p. 7, Table 1, "Cosine similarity .85")
- An empirical cosine-similarity threshold for acceptable fidelity is set at 0.7; 94.5% of pairs are above threshold. (p. 8, Results 3.4, "threshold ... at .7"; p. 8, Results 3.4, "94.5%")
- The paper analyzes low-similarity cases as potentially involving unintended summarization, elaboration, or inaccuracies, and recommends further investigation and prompt refinement if needed. (p. 8, Results 3.4, "unintended summarization, elaboration")

### 4. Conclusion

- The paper concludes simplifications can substantially improve readability “without sacrificing semantic fidelity,” but stops short of claiming comprehension gains. (p. 11, Conclusion, "improve readability without sacrificing")
- It frames this as a foundation for future work on student perceptions and learning outcomes, and suggests optional supports like glosses or tunable elaboration levels. (p. 12, Conclusion, "investigating how students perceive"; p. 12, Conclusion, "optional inline glosses")

### Acknowledgments / Declaration on Generative AI

- The authors thank publishers for enabling generative AI features and allowing open data release. (p. 12, Acknowledgments, "permission ... enable generative AI features")
- They report using OpenAI o3 and GPT-4.5 during writing for editing/paraphrasing and take responsibility for the content. (p. 12, Declaration, "used OpenAI o3 and GPT-4.5")

---

## D) System explained

### What the learner sees (UI/components)

- A “Simplify” option after highlighting text in the eReader interface (shown in Figure 1). (p. 3, Figure 1 caption, "highlighting textbook content and selecting")
- Simplified text appears in an interactive side chat panel next to the original content (Figure 2). (p. 2, Introduction, "interactive side panel chat window")
- A follow-up prompt to restate the content or request another simplification occurs after the initial output. (p. 2, Introduction, "prompted to attempt to restate")

### What the learner does (actions)

- Highlights a passage and selects “Simplify” to request an on-demand simplification. (p. 2, Introduction, "highlight a passage ... select "Simplify"")
- Optionally restates the content in their own words or requests further simplification (not analyzed here). (p. 2, Introduction, "restate the content in their own words")

### What the system observes (signals/logs)

- The selected passage plus extracted surrounding context (paragraph + enclosing section/subsection) are sent to the LLM. (p. 4, Method 2.1, "given the student-selected text")
- The system logs student-initiated simplification events (the dataset analyzed). (p. 4, Method 2.2, "student-initiated simplification events")

### What the system outputs (content/feedback/artifacts)

- A simplified version intended to reduce lexical/syntactic complexity and lower reading grade level, with a conversational positive tone. (p. 4, Method 2.1, "reduce sentence complexity")
- No post-processing fidelity checks or filters are applied in production at the time of logging. (p. 4, Method 2.1, "No additional post-simplification filters")

---

## E) Content architecture

### Units

- Selected passage (student-highlighted text) as the input unit. (p. 1, Abstract, "select a textbook passage")
- Simplified passage as the output unit displayed in the side panel. (p. 1, Abstract, "receive a simplified version")
- Interaction event as the logged unit for analysis (one “initial simplification event”). (p. 2, Introduction, "focuses specifically on analyzing")

### Structure (how units connect)

- Textbook → student highlights passage → Simplify request → LLM simplification → side-panel display (with optional restate/follow-up). (p. 2, Introduction, "highlight ... select "Simplify""; p. 2, Introduction, "displayed ... side panel")

### Attachment rules (task→unit, concept→unit, etc.)

- The simplified text is attached to the selected passage and its extracted local context (paragraph + enclosing section/subsection). (p. 4, Method 2.1, "including the immediate paragraph")

### Lifecycle (create → show → evaluate → revise → store)

- Create: on-demand GPT-4o generation with fixed parameters and a “helpful college professor” prompt. (p. 4, Method 2.1, "generated using OpenAI GPT-4o")
- Show: simplified passage is displayed in a side chat panel beside the original content. (p. 2, Introduction, "displayed ... side panel chat window")
- Evaluate: offline analysis computes readability/lexical/syntactic/semantic metrics for original vs simplified. (p. 4–5, Method 2.2, "impact ... quantified along four dimensions")

---

## F) Adaptation mechanics

### Triggers/signals observed

- IF a student highlights a passage and clicks “Simplify,” THEN the system generates a simplification in real time. (p. 2, Introduction, "highlight ... select "Simplify"")
- IF a simplification event occurs, THEN the system records it as a student-initiated event in the dataset. (p. 4, Method 2.2, "student-initiated simplification events")

### Adaptation actions taken

- IF triggered, THEN GPT-4o is prompted to reduce sentence complexity, lower reading level by ~4 grade levels, and simplify specialized terms while keeping a positive tone. (p. 4, Method 2.1, "decrease reading level by approximately")
- IF generating, THEN the LLM receives the selected text plus local surrounding context (paragraph + enclosing section/subsection). (p. 4, Method 2.1, "immediate paragraph ... enclosing")

### Learner-initiated vs system-initiated

- Learner-initiated: the student selects exactly which passage to simplify (“student-initiated”). (p. 4, Method 2.2, "student-initiated simplification events")
- System-initiated: the system adds context around the selection and applies a fixed prompt/parameterization. (p. 4, Method 2.1, "Context was determined by")

### Human-in-the-loop controls

- Human review/editing of simplifications during live use is not described; there are “no post-simplification filters or fidelity checks.” (p. 4, Method 2.1, "No additional post-simplification filters")

---

## G) Evaluation

### Setting/context (platform/domain/content source)

- Platform: VitalSource Bookshelf eReader with an embedded “Simplify” tool available in permitted textbooks. (p. 2, Introduction, "VitalSource Bookshelf platform introduced")
- Content domains reported via BISAC headings, with top domains including Social Science, Political Science, and Psychology. (p. 4, Method 2.2, "top subject domains ... Social Science")

### Design (what is compared)

- Observational log analysis comparing original student-selected passages vs simplified outputs on multiple automated metrics. (p. 1, Abstract, "compare the original ... and simplified")
- Two research questions: readability (RQ1) and meaning preservation (RQ2). (p. 4, Research Questions, "RQ1: To what extent")

### Participants and procedure

- Usage dataset: 54,371 events by 11,689 students across 2,082 textbooks, recorded Sep 1, 2024–Apr 30, 2025. (p. 4, Method 2.2, "54,371 events ... 11,689")
- Student demographics were not collected, limiting subgroup analysis. (p. 4, Method 2.2, "did not collect any student")

### Measures

- Readability: FKGL and FRE computed using NLTK readability module. (p. 5, Method, "Flesch–Kincaid Grade Level"; p. 5, Method, "NLTK library")
- Lexical simplification: Δ log p using spaCy frequency estimates and average word length change. (p. 5, Method, "spaCy's en_core_web_lg")
- Syntactic simplification: dependency depth change and sentence length change via spaCy dependency parser. (p. 5, Method, "dependency parser")
- Semantic fidelity: cosine similarity from sentence-transformers embeddings (all-mpnet-base-v2), plus compression ratio as a diagnostic. (p. 5–6, Method, "all-mpnet-base-v2"; p. 6, Method, "compression ratio (CR)")

### Analysis methods (only what is explicitly stated)

- Differences are analyzed as Δ = simplified – selected for each metric. (p. 5, Method 2.2, "Differences ... (Δ = simplified")
- Semantic fidelity threshold is empirically derived by sampling similarity bands and rating 40 pairs per band with OpenAI o3 using a 0–5 similarity scale; threshold set where all sampled pairs rate ≥4. (p. 6, Method, "40 original-simplified pairs"; p. 6, Method, "rated ... by OpenAI's o3")
- The paper uses Wilson-method power analysis for the “40 consecutive acceptable ratings” justification and reports the resulting CI bounds. (p. 6, Method, "Wilson method"; p. 6, Method, "95% CI of 95.6%")
- Non-prose readability outliers are excluded (FKGL>44 or FRE<-60.9), totaling n=634 (1.2%), and sensitivity analysis notes the impact on mean improvements. (p. 7, Method notes, "outliers (n = 634, 1.2%)")

### Key results (exact reported numbers)

- Readability: mean Δ FKGL = -7.37; mean Δ FRE = 31.34. (p. 7, Table 1, "Δ FKGL -7.37"; p. 7, Table 1, "Δ FRE 31.34")
- Original mean FKGL = 16.65; simplified FKGL = 9.28 (reported narrative). (p. 7, Results 3.1, "mean FKGL ... 16.65"; p. 7, Results 3.1, "to 9.28")
- Lexical: mean Δ log p = 1.02; mean Δ chars/word = -0.41. (p. 7, Table 1, "Δ log p 1.02"; p. 7, Table 1, "Δ chars / word -0.41")
- Syntactic: mean Δ dependency depth = -0.98; mean Δ words/sentence = -14.62. (p. 7, Table 1, "Δ dependency depth -0.98"; p. 7, Table 1, "Δ words / sentence -14.62")
- Semantic: mean cosine similarity = .85; mean compression ratio = 0.80. (p. 7, Table 1, "Cosine similarity .85"; p. 7, Table 1, "Compression ratio 0.80")
- Thresholding: acceptable semantic fidelity threshold set at .7; 94.5% above threshold; remaining 5.5% flagged for investigation. (p. 8, Results 3.4, "threshold ... at .7"; p. 8, Results 3.4, "94.5%")

---

## H) Limitations and failure modes

- The study does not assess student perceptions of simplified text, positioning this as a future step. (p. 2, Introduction, "does not assess students’ perceptions")
- The study does not directly assess cognitive load reduction, even though cognitive load theory motivates the tool. (p. 4, Research Questions, "does not directly assess cognitive load")
- Readability metrics can produce extreme values for non-prose formats; they exclude such outliers after manual inspection. (p. 7, Method notes, "do not deviate significantly from typical prose")
- The simplifier may unintentionally summarize or elaborate because the prompt does not constrain length or forbid summarization, and no post-checks are applied. (p. 4, Method 2.1, "no explicit instructions ... target length"; p. 4, Method 2.1, "No additional post-simplification")
- The paper explicitly “stops short” of claiming comprehension gains and calls for future outcome studies. (p. 11, Conclusion, "we stop short of claiming")

---

# PROJECT RELEVANCE

## I) Where this overlaps with our project (“What’s already been done that is similar?”)

| Paper feature/idea | Evidence (citation) | Closest match to our project component | Notes on mapping to SQL learning |
|---|---|---|---|
| On-demand transformation of learning content inside an intelligent textbook interface | (p. 2, Introduction, "embedded ereader interface") | 2) intelligent/adaptive textbook artifact | Similar UI pattern: let learners request “simplify this explanation/error message” in SQL notes. |
| Learner-initiated trigger for adaptive support (student selects what’s hard) | (p. 4, Method 2.2, "student-initiated simplification events") | 1) adaptive instructional content beyond hints | In SQL, allow “simplify/clarify” on confusing feedback after an attempt. |
| Large-scale log-based evaluation of an adaptive content feature | (p. 1, Abstract, "analyzed 54,371 simplifier interactions") | 5) trace-to-content mapping / learning-from-logs | Mirrors our need to evaluate policies using interaction traces rather than small lab studies only. |
| Explicit quality dimensions: readability/simplification + meaning preservation | (p. 4–5, Method 2.2, "Readability ... Semantic fidelity") | 1) adaptive instructional content beyond hints | For SQL notes, analogous metrics could be “brevity/clarity” + “semantic fidelity to correct concept.” |
| Future direction: tunable elaboration levels / inline glosses | (p. 12, Conclusion, "tunable elaboration levels") | 1) adaptive instructional content beyond hints | Aligns with adjustable depth of explanations in “My Textbook” based on learner needs. |

## J) Where the paper falls short for our needs

- It adapts based on student-selected text passages, not on errors/retries/hint-use timing signals from problem-solving traces. (p. 4, Method 2.2, "student-initiated simplification events")
- It does not define an escalation ladder (hint → explanation → reflection); the feature is a single-step simplification tool with optional follow-ups not analyzed. (p. 2, Introduction, "focuses specifically on analyzing")
- It evaluates readability/semantic fidelity metrics but does not test learning outcomes or comprehension improvements in this paper. (p. 11, Conclusion, "stop short of claiming")
- It applies no post-generation fidelity checks during production usage, which is a risk if repurposed for high-stakes conceptual correctness. (p. 4, Method 2.1, "No additional post-simplification")

## K) How our idea is different

- Our idea differs because… we use SQL interaction traces (errors, retries, hint-use) to drive what content is added/surfaced, while this tool is triggered by the student highlighting text. (p. 2, Introduction, "highlight a passage"; p. 4, Method 2.2, "student-initiated")
- Our idea differs because… we aim to build a persistent “My Notes/My Textbook” that accumulates and reorganizes across tasks (p. 12, Conclusion, "Future iterations may also explore")
- Our idea differs because… our escalation goal is “beyond hints only when needed,” whereas this paper focuses on simplifying language complexity (and sometimes accidentally summarizing/elaborating). (p. 2, Introduction, "reduce lexical and syntactic")
- Our idea differs because… we plan offline replay comparisons across strategies; this paper is a single-feature log analysis, not multi-policy replay. (p. 1, Abstract, "analyzed ... interactions")

---

## L) Actionable “steal-this” design patterns

### User-selected difficulty targeting

- User-selected difficulty targeting  
- What it does: the learner chooses what to simplify by highlighting, enabling targeted support without guessing. (p. 2, Introduction, "Students can highlight a passage")  
- SQL implementation: allow “simplify” on any feedback/explanation segment inside “My Notes” to keep interventions learner-driven.

### Context-bounded generation

- Context-bounded generation  
- What it does: sends selected text plus local context (paragraph + enclosing section) to reduce hallucination risk and improve relevance. (p. 4, Method 2.1, "including the immediate paragraph")  
- SQL implementation: for a confusing SQL error, include the task prompt + schema + learner query + relevant hint text as bounded context for rewriting notes.

### Deterministic generation settings for consistency

- Deterministic generation settings for consistency  
- What it does: uses temperature=0, top_p=1 to reduce variability in simplifications. (p. 4, Method 2.1, "temperature = 0, top_p = 1")  
- SQL implementation: for notebook-unit rewriting (simplify/clarify), use deterministic settings so the same trigger yields reproducible outputs.

### Semantic-fidelity thresholding as a diagnostic

- Semantic-fidelity thresholding as a diagnostic  
- What it does: defines an empirical cosine similarity threshold (.7) and uses it to flag potentially risky rewrites for review. (p. 8, Results 3.4, "threshold ... at .7")  
- SQL implementation: compute similarity between original concept explanation and simplified note; flag low-similarity rewrites for regeneration or human review.

### Compression ratio + similarity jointly to detect summarization vs elaboration

- Compression ratio + similarity jointly to detect summarization vs elaboration  
- What it does: interprets CR with cosine similarity to diagnose over-summarization or over-elaboration (not strict rules). (p. 6, Method, "compression ratio (CR)"; p. 7, Method notes, "diagnostic guidelines")  
- SQL implementation: if a “simplify” request produces much shorter text, warn the learner it may omit details; if much longer, treat as elaboration mode.

---

## M) Final takeaway

- This paper shows that an intelligent textbook feature can make content more accessible by letting students request on-demand simplification of difficult passages and delivering the rewrite directly inside the reading interface. (p. 1, Abstract, "select a textbook passage"; p. 2, Introduction, "embedded ereader interface")
- Using large-scale real usage logs, it finds the tool substantially lowers estimated reading grade level while maintaining high semantic fidelity for most outputs, but it emphasizes that learning benefits are not yet proven and require future studies focused on student perceptions and comprehension outcomes. (p. 7, Results 3.1, "lowered FKGL"; p. 11, Conclusion, "stop short of claiming")
