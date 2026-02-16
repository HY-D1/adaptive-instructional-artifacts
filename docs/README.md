# Adaptive Instructional Artifacts (SQL)

## Research Vision

This project explores how instructional content for SQL learning can be assembled and adapted dynamically from learner interaction data, rather than delivered through static textbooks or fixed hint sequences.

### Core Outcome

An **"automatic adaptive textbook"** that:
- Accumulates, reorganizes, and surfaces explanations, examples, and summaries
- Responds to how learners interact with SQL problems, where they struggle, and when short hints are insufficient
- Delivers instructional content reflectively and on demand
- Avoids pre-authored chapters or real-time interruptions

---

## Core Research Components

### 1. Adaptive Content Orchestration
Design logic for escalation decisions:
- When to remain at the hint level
- When to escalate to deeper explanations
- When to aggregate content into reflective instructional notes

**Inputs**: Error patterns, retry counts, timing, engagement indicators

### 2. Automatic Textbook Prototype
Dynamic assembly system:
- Instructional units (explanations, examples, summaries)
- Personalized "My Notes / My Textbook" view per learner
- Concept coverage tracking through implicit interaction

### 3. HintWise Integration
- Hints as lowest-level instructional units
- Escalation policies from hints to textbook-style content
- HintWise outputs repurposed in automatic textbook pipeline

### 4. SQL-Engage Knowledge Backbone
- Concept node definitions
- Error subtype to concept mapping
- Validated feedback template retrieval

### 5. Controlled LLM Use
- Retrieval-first, generation-second architecture
- Templated prompts with constrained tone and scope
- No free-form or unconstrained generation

### 6. Offline Replay and Comparison
- Trace replay for policy comparison
- Hint-only vs adaptive textbook strategies
- Evidence generation for publishable claims about instructional adaptation

---

## Expected Deliverables

| Deliverable | Description |
|-------------|-------------|
| Working Prototype | Automatic textbook with dynamic content assembly |
| Experimental Results | Comparative analysis of adaptive strategies |
| Publication Package | Figures, system descriptions, method components |

---

## Weekly Roadmap

| Week | Focus | Key Deliverables |
|------|-------|------------------|
| Week 2 | MVP + Foundation | Hint ladder, escalation, My Notes, concept tracking, policy comparison dashboard |
| Week 3-4 | Enhancement | Full replay system, LLM integration refinements, experimental validation |
| Week 5-6 | Analysis | Comparative results, publication figures, system documentation |

---

## Quick Commands

```bash
# Build
npm run build

# Week 2 E2E tests
npm run test:e2e:week2

# Generate demo artifacts
npm run demo:week2

# Run replay
npm run replay:toy
npm run replay:gate

# Concept coverage check
npm run check:concept-map
```


