# SQL-Adapt Architecture Diagrams

## Overview
This document contains detailed visual diagrams of three core SQL-Adapt systems:
1. **Hints Mechanism (Guidance Ladder)**
2. **Textbook Note Design Flow**
3. **Log Usage for Cross-Feature Integration**

---

## 1. Hints Mechanism (Guidance Ladder)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              GUIDANCE LADDER FLOW                                        │
│                    Progressive Hint Escalation System                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────────────────────────────────────────────────────────┐
│   Student    │     │                    LEARNING INTERFACE                           │
│   Writes     │────▶│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│    SQL       │     │  │   SQL Editor    │───▶│  SQL Executor   │───▶│  Error?     │  │
└──────────────┘     │  │  (Monaco)       │    │  (sql.js WASM)  │    │  (Subtype)  │  │
                     │  └─────────────────┘    └─────────────────┘    └──────┬──────┘  │
                     └────────────────────────────────────────────────────────┼─────────┘
                                                                              │
                                                                              ▼ Error Detected
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              HINT SYSTEM INITIALIZATION                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                                                              │
          ┌───────────────────────────────────────────────────────────────────┘
          ▼
┌─────────────────────┐
│ HintSystem.tsx      │
│ Props:              │
│ - learnerId         │
│ - problemId         │
│ - errorSubtypeId    │
│ - recentInteractions│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         ENHANCED HINT SERVICE (useEnhancedHints.ts)                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
           │
           ├──────────────────────────────────────────────────────────┐
           ▼                                                          ▼
┌────────────────────────────┐                           ┌─────────────────────────────┐
│ checkAvailableResources()  │                           │   generateEnhancedHint()    │
├────────────────────────────┤                           ├─────────────────────────────┤
│ Resources Checked:         │                           │ Input:                      │
│ • sqlEngage: true (always) │                           │ - learnerId, problemId      │
│ • textbook: has units?     │                           │ - errorSubtypeId            │
│ • llm: Ollama available?   │                           │ - rung (1|2|3)              │
│ • pdfIndex: has index?     │                           │ - recentInteractions        │
└────────────┬───────────────┘                           └──────────────┬──────────────┘
           │                                                          │
           ▼                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              RESOURCE-BASED STRATEGY SELECTION                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘

     ┌────────────────────┐        ┌────────────────────┐        ┌────────────────────┐
     │  LLM Available     │        │  Textbook Only     │        │  SQL-Engage Only   │
     │  + Textbook        │        │  (No LLM)          │        │  (Fallback)        │
     └─────────┬──────────┘        └─────────┬──────────┘        └─────────┬──────────┘
               │                             │                             │
               ▼                             ▼                             ▼
┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐
│ generateLLMEnhancedHint()│  │ generateTextbookEnhanced │  │ generateSqlEngageFallback│
│                          │  │ Hint()                   │  │ Hint()                   │
├──────────────────────────┤  ├──────────────────────────┤  ├──────────────────────────┤
│ • Adaptive progression   │  │ • SQL-Engage base hint   │  │ • SQL-Engage dataset     │
│ • L1: Subtle nudge       │  │ • Add textbook refs      │  │ • 3 progressive levels   │
│ • L2: Guiding question   │  │ • "See also in Textbook" │  │ • Deterministic hints    │
│ • L3: Explicit direction │  │                          │  │ • Concept-tagged         │
└────────────┬─────────────┘  └────────────┬─────────────┘  └────────────┬─────────────┘
             │                             │                             │
             └─────────────────────────────┼─────────────────────────────┘
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              GUIDANCE LADDER PROGRESSION                                 │
│                              (Linear L1 → L2 → L3 → Explanation)                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

     ┌────────────────────────────────────────────────────────────────────────────────┐
     │                           RUNG 1 (L1) - SUBTLE NUDGE                            │
     │  ┌─────────────────────────────────────────────────────────────────────────┐   │
     │  │ • Vague pointer to error area                                          │   │
     │  │ • "Check your WHERE clause..."                                         │   │
     │  │ • Max 100 chars                                                        │   │
     │  │ • Source: SQL-Engage or LLM                                            │   │
     │  └─────────────────────────────────────────────────────────────────────────┘   │
     │                                    │                                             │
     │                                    ▼ Student clicks "Next Hint"                 │
     │                           ┌──────────────┐                                      │
     │                           │ hint_view    │ ◄── Logged to storage               │
     │                           │ eventType    │     (InteractionEvent)              │
     │                           └──────┬───────┘                                      │
     │                                  │                                               │
     │                                  ▼                                               │
     │  ┌─────────────────────────────────────────────────────────────────────────┐   │
     │  │                           RUNG 2 (L2) - GUIDING QUESTION                │   │
     │  │ • Specific question pointing to fix                                    │   │
     │  │ • "Did you forget to join tables?"                                     │   │
     │  │ • Max 250 chars                                                        │   │
     │  │ • Shows source references (if available)                               │   │
     │  └─────────────────────────────────────────────────────────────────────────┘   │
     │                                    │                                             │
     │                                    ▼ Student clicks "Next Hint"                 │
     │                           ┌──────────────┐                                      │
     │                           │ hint_view    │ ◄── Logged with rung=2              │
     │                           │ rung: 2      │                                     │
     │                           └──────┬───────┘                                      │
     │                                  │                                               │
     │                                  ▼                                               │
     │  ┌─────────────────────────────────────────────────────────────────────────┐   │
     │  │                           RUNG 3 (L3) - EXPLICIT DIRECTION              │   │
     │  │ • Clear statement of what needs fixing                                 │   │
     │  │ • "Use JOIN instead of comma-separated tables"                         │   │
     │  │ • Max 500 chars                                                        │   │
     │  │ • Full source grounding with PDF citations                             │   │
     │  └─────────────────────────────────────────────────────────────────────────┘   │
     │                                    │                                             │
     │                                    ▼ Student clicks "Explain" OR                │
     │                           Auto-escalation after L3                              │
     │                           (500ms delay to show hint first)                      │
     │                                    │                                             │
     │                           ┌──────────────┐                                      │
     │                           │ guidance_    │                                      │
     │                           │ escalate     │ ◄── trigger: "auto_escalation_      │
     │                           │ fromRung: 3  │     eligible"                       │
     │                           └──────┬───────┘                                      │
     └──────────────────────────────────┼─────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              EXPLANATION MODE (Post-L3)                                  │
│                              Content Generation & Textbook                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────┐        ┌──────────────────────────────────────────┐   │
│  │  generateExplanation()  │───────▶│  Build Retrieval Bundle                  │   │
│  │  (content-generator.ts) │        │  • SQL-Engage templates                  │   │
│  └─────────────────────────┘        │  • Textbook units (if any)               │   │
│                                     │  • PDF passages (if indexed)             │   │
│                                     └────────────────────┬─────────────────────┘   │
│                                                          │                         │
│                                                          ▼                         │
│                                     ┌──────────────────────────────────────────┐   │
│                                     │  LLM.generateWithOllama() OR             │   │
│                                     │  Fallback: Template-based explanation    │   │
│                                     └────────────────────┬─────────────────────┘   │
│                                                          │                         │
│                                                          ▼                         │
│                                     ┌──────────────────────────────────────────┐   │
│                                     │  Generated Explanation                   │   │
│                                     │  ├─ Title                                │   │
│                                     │  ├─ Concept explanation                  │   │
│                                     │  ├─ Common mistakes                      │   │
│                                     │  └─ Minimal example                      │   │
│                                     └────────────────────┬─────────────────────┘   │
│                                                          │                         │
│                                                          ▼                         │
│                                     ┌──────────────────────────────────────────┐   │
│                                     │  Student clicks "Save to My Textbook"    │   │
│                                     │  ─────────────────────────────────────   │   │
│                                     │  Log: textbook_add event                 │   │
│                                     │  Call: storage.saveToTextbook()          │   │
│                                     └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Textbook Note Design Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TEXTBOOK NOTE LIFECYCLE                                        │
│                    Creation → Deduplication → Update → Retrieval                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CREATION TRIGGERS                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────────┐
  │  Manual Save        │      │  Explanation View   │      │  Background Analysis    │
  │  (Student Action)   │      │  (Auto-suggested)   │      │  (Auto-created)         │
  └──────────┬──────────┘      └──────────┬──────────┘      └────────────┬────────────┘
             │                            │                              │
             └────────────────────────────┼──────────────────────────────┘
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              UNIT CREATION INPUT                                         │
│                              (CreateUnitInput type)                                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Input Fields:                                                                        │
│  ├─ learnerId: string        ← Who owns this note                                    │
│  ├─ sessionId: string        ← Session context                                       │
│  ├─ conceptIds: string[]     ← Linked concepts (dedupe key)                          │
│  ├─ type: 'explanation' | 'example' | 'common_mistake' | 'hint_tip'                  │
│  ├─ title: string            ← Note title                                            │
│  ├─ content: string          ← Main content (Markdown)                               │
│  ├─ summary?: string         ← Brief summary                                         │
│  ├─ commonMistakes?: string[]← List of common errors                                 │
│  ├─ minimalExample?: string  ← Code example                                          │
│  ├─ sourceRefIds?: string[]  ← Citation IDs                                          │
│  ├─ sourceInteractionIds:    ← Evidence events                                       │
│  │   string[]                                                                          │
│  ├─ errorSubtypeId?: string  ← Context                                               │
│  └─ autoCreated?: boolean    ← Flag for auto-created units                           │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DEDUPLICATION & UPSERT LOGIC                                │
│                              (textbook-units.ts)                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

     ┌────────────────────────────────────────────────────────────────────────────────┐
     │  STEP 1: Generate Dedupe Key                                                    │
     │  ─────────────────────────────────                                              │
     │  Key = sorted(conceptIds).join(',') + "::" + type                               │
     │                                                                                 │
     │  Example: "aggregation_functions,group_by::explanation"                         │
     └─────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
                                       ▼
     ┌────────────────────────────────────────────────────────────────────────────────┐
     │  STEP 2: Check for Existing Unit                                                │
     │  ───────────────────────────────                                                │
     │  existing = findExistingUnit(units, dedupeKey)                                  │
     │                                                                                 │
     │  ┌─────────────┐                                                                │
     │  │   Found?    │                                                                │
     │  └──────┬──────┘                                                                │
     │         │                                                                       │
     │    ┌────┴────┐                                                                  │
     │    ▼         ▼                                                                  │
     │   YES       NO ──▶ STEP 5: Create New Unit                                      │
     │    │                                                                              │
     │    ▼                                                                              │
     │  STEP 3: Should Update?                                                          │
     └────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
     ┌────────────────────────────────────────────────────────────────────────────────┐
     │  STEP 4: Quality-Based Competition                                              │
     │  ─────────────────────────────────────                                          │
     │                                                                                 │
     │  ┌────────────────────────┐     ┌────────────────────────┐                     │
     │  │  Existing Unit         │     │  New Content           │                     │
     │  │  ├─ qualityScore: 0.6  │ vs  │  ├─ qualityScore: 0.8  │                     │
     │  │  ├─ revisionCount: 2   │     │  └─ (fresh content)    │                     │
     │  └────────────────────────┘     └────────────────────────┘                     │
     │                                                                                 │
     │  Quality Score Formula:                                                         │
     │  ├─ sourceRichness: (uniqueSources / 5) * 0.4                                  │
     │  ├─ hasSummary: 0.2                                                            │
     │  ├─ hasExamples: 0.2                                                           │
     │  └─ hasMistakes: 0.2                                                           │
     │                                                                                 │
     │  Decision:                                                                      │
     │  ├─ New > Old + 0.2  ──▶ REPLACE                                                │
     │  ├─ Within 0.1       ──▶ UPDATE (merge sources)                                 │
     │  └─ New < Old - 0.1  ──▶ KEEP OLD                                               │
     │                                                                                 │
     │  Max Revisions: 10 (then create new unit)                                       │
     └─────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │   REPLACE    │  │   UPDATE     │  │  CREATE NEW  │
            │  (new wins)  │  │  (merge)     │  │              │
            └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                   │                 │                 │
                   ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              STEP 5: BUILD UNIT OBJECT                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  InstructionalUnit Structure:                                                         │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │  Core Fields                                                                    │ │
│  │  ├─ id: string                    ← UUID                                         │ │
│  │  ├─ conceptId: string             ← Primary concept                              │ │
│  │  ├─ conceptIds: string[]          ← All related concepts                         │ │
│  │  ├─ type: UnitType                ← Category                                     │ │
│  │  ├─ title: string                 ← Display title                                │ │
│  │  ├─ content: string               ← Markdown content                             │ │
│  │  ├─ createdAt: number             ← Timestamp                                    │ │
│  │  ├─ updatedAt: number             ← Last modified                                │ │
│  │  └─ revisionCount: number         ← Version counter                              │ │
│  │                                                                                 │ │
│  │  Content Fields (from LLM)                                                      │ │
│  │  ├─ summary?: string              ← Brief explanation                           │ │
│  │  ├─ commonMistakes?: string[]     ← List of errors                              │ │
│  │  └─ minimalExample?: string       ← Code example                                │ │
│  │                                                                                 │ │
│  │  Quality & Status                                                               │ │
│  │  ├─ qualityScore: number          ← 0-1 calculated score                        │ │
│  │  ├─ isBestQuality: boolean        ← score >= 0.8                               │ │
│  │  ├─ status: 'primary' | 'alternative' | 'archived'                             │ │
│  │  └─ version: number               ← Content version                             │ │
│  │                                                                                 │ │
│  │  Source Tracking (Provenance)                                                   │ │
│  │  ├─ sourceRefIds: string[]        ← Citation IDs                                │ │
│  │  ├─ sourceInteractionIds:         ← Evidence events                             │ │
│  │  │   string[]                                                                    │ │
│  │  └─ provenance: {                                                               │ │
│  │       retrievedSourceIds: string[]                                              │ │
│  │       errorSubtypeId: string                                                    │ │
│  │       policyVersion: string                                                     │ │
│  │       hintLevel: number                                                         │ │
│  │     }                                                                           │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              STEP 6: PERSIST & LOG                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────┐          ┌──────────────────────────────────────┐
     │  storage.saveTextbookUnit()  │          │  Log Event: textbook_unit_upsert     │
     │  ─────────────────────────── │          │  ─────────────────────────────────   │
     │  • Save to localStorage      │          │  • unitId                            │
     │  • Handle quota exceeded     │          │  • action: 'created' | 'updated'     │
     │  • Memory fallback           │          │  • dedupeKey                         │
     │                              │          │  • revisionCount                     │
     └──────────────────────────────┘          │  • conceptIds                        │
                                               │  • timestamp                         │
                                               └──────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              RETRIEVAL & USAGE                                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────┐
     │  findRelevantTextbookUnits() │
     │  ─────────────────────────── │
     │  Input: learnerId,           │
     │         errorSubtypeId,      │
     │         conceptIds           │
     └──────────────┬───────────────┘
                    │
                    ▼
     ┌────────────────────────────────────────────────────────────────────────────────┐
     │  Scoring Algorithm                                                              │
     │  ─────────────────                                                              │
     │                                                                                 │
     │  For each unit:                                                                 │
     │  score = 0                                                                      │
     │                                                                                 │
     │  // Concept match                                                               │
     │  IF unit.conceptId IN conceptIds:                                               │
     │     score += 3                                                                  │
     │                                                                                 │
     │  // Keyword match                                                               │
     │  FOR keyword IN errorSubtype.keywords:                                          │
     │     IF unit.content.contains(keyword):                                          │
     │        score += 1                                                               │
     │                                                                                 │
     │  // Sort by score, return top N                                                 │
     └─────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
                                       ▼
     ┌──────────────────────────────┐      ┌──────────────────────────────┐
     │  Use in Hint Generation      │      │  Use in "Ask My Textbook"    │
     │  ───────────────────────     │      │  ─────────────────────────   │
     │  • Include as context        │      │  • RAG retrieval source      │
     │  • "Related from Textbook"   │      │  • Chat responses            │
     └──────────────────────────────┘      └──────────────────────────────┘
```

---

## 3. Log Usage for Cross-Feature Integration

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         INTERACTION LOG ARCHITECTURE                                     │
│                   Central Event Stream → Multi-Feature Consumption                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              EVENT PRODUCERS (Sources)                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
  │  Learning         │  │  Hint System      │  │  Textbook         │  │  Chat System      │
  │  Interface        │  │  (HintSystem.tsx) │  │  (AdaptiveTextbook)│  │  (AskMyTextbook)  │
  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘
            │                      │                      │                      │
            ▼                      ▼                      ▼                      ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                              INTERACTION EVENT TYPES                                     │
  │                              (Stored: sql-learning-interactions)                         │
  └─────────────────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │  Code/Execution Events                               Help/Guidance Events                │
  │  ─────────────────────                               ─────────────────                   │
  │  • code_change           ← Student types SQL         • hint_request                    │
  │  • execution             ← Runs query                • hint_view      ← L1/L2/L3       │
  │  • error                 ← SQL error                 • explanation_view                │
  │  • successful            ← Correct result            • guidance_request                │
  │                                                      • guidance_view                   │
  │  Textbook Events                                     • guidance_escalate ← L3→Exp      │
  │  ───────────────                                     • source_view      ← PDF citations│
  │  • textbook_add        ← Save to notes                                                         │
  │  • textbook_update     ← Edit notes                                                          │
  │  • textbook_unit_upsert ← Create/update unit                                              │
  │                                                                                          │
  │  Chat Events                                           PDF/LLM Events                    │
  │  ───────────                                           ────────────                      │
  │  • chat_interaction    ← Q&A with Textbook           • llm_generate                    │
  │                                                        • pdf_index_rebuilt             │
  │  Coverage Events                                       • pdf_index_uploaded            │
  │  ───────────────                                                                                     │
  │  • coverage_change     ← Concept mastered                                                           │
  │  • concept_extraction  ← Background analysis                                            │
  └─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              EVENT STORAGE (storage.ts)                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

     ┌────────────────────────────────────────────────────────────────────────────────┐
     │  InteractionEvent Structure                                                     │
     │  ─────────────────────────                                                      │
     │  ├─ id: string                    ← Unique event ID                             │
     │  ├─ sessionId?: string            ← Session grouping                            │
     │  ├─ learnerId: string             ← Who performed action                        │
     │  ├─ timestamp: number             ← When (Unix ms)                              │
     │  ├─ eventType: string             ← Event category                              │
     │  ├─ problemId: string             ← Context problem                             │
     │  ├─ code?: string                 ← SQL code (if applicable)                    │
     │  ├─ error?: string                ← Error message                               │
     │  ├─ errorSubtypeId?: string       ← Classified error type                       │
     │  ├─ hintLevel?: 1|2|3             ← Rung level                                  │
     │  ├─ hintText?: string             ← Content shown                               │
     │  ├─ conceptIds?: string[]         ← Related concepts                            │
     │  ├─ noteId?: string               ← Textbook reference                          │
     │  ├─ retrievedSourceIds?: string[] ← Source citations                            │
     │  └─ triggerInteractionIds?:       ← Causal chain                               │
     │     string[]                                                                      │
     └────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              LOG CONSUMERS (Features)                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │                                                                                      │
     │   ┌──────────────────────────────────────────────────────────────────────────┐     │
     │   │  1. ADAPTIVE ORCHESTRATOR (adaptive-orchestrator.ts)                      │     │
     │   │  ─────────────────────────────────────────────────                        │     │
     │   │                                                                             │     │
     │   │  Input: recentInteractions[]                                              │     │
     │   │                                                                             │     │
     │   │  Decision Logic:                                                          │     │
     │   │  ├─ Count errors by problem                                               │     │
     │   │  ├─ Count hint views                                                      │     │
     │   │  ├─ Check escalation thresholds                                           │     │
     │   │  │   ├─ adaptive-low:  5 errors → escalate                                │     │
     │   │  │   ├─ adaptive-med:  3 errors → escalate                                │     │
     │   │  │   └─ adaptive-high: 2 errors → escalate                                │     │
     │   │  └─ Return: decision (hint | escalate | aggregate)                        │     │
     │   │                                                                             │     │
     │   │  Used By: HintSystem.tsx for flow control                                  │     │
     │   └──────────────────────────────────────────────────────────────────────────┘     │
     │                                    ▲                                                 │
     │                                    │                                                 │
     │   ┌────────────────────────────────┼──────────────────────────────────────────┐     │
     │   │  2. TRACE ANALYZER (trace-analyzer.ts)           │                       │     │
     │   │  ────────────────────────────────────────────────┼────────────────────── │     │
     │   │                                                  │                       │     │
     │   │  Background Analysis (every 5 min):              │                       │     │
     │   │  ├─ analyzeInteractionTraces()                   │                       │     │
     │   │  │   ├─ Group errors by subtype                  │                       │     │
     │   │  │   ├─ Find patterns (>3 occurrences)          │                       │     │
     │   │  │   ├─ Detect concept gaps (no textbook unit)  │                       │     │
     │   │  │   └─ Generate recommendations                │                       │     │
     │   │  │                                               │                       │     │
     │   │  └─ Auto-create units (if >5 occurrences)      │                       │     │
     │   │      → Calls content-generator.ts              │                       │     │
     │   │                                                  │                       │     │
     │   │  Used By: ResearchDashboard for insights        │                       │     │
     │   └────────────────────────────────┼─────────────────┴───────────────────────┘     │
     │                                    │                                                 │
     │   ┌────────────────────────────────┼──────────────────────────────────────────┐     │
     │   │  3. CONCEPT COVERAGE (useLearningData.ts)        │                       │     │
     │   │  ────────────────────────────────────────────────┼────────────────────── │     │
     │   │                                                  │                       │     │
     │   │  Evidence Aggregation:                           │                       │     │
     │   │  ├─ successfulExecution → +score                 │                       │     │
     │   │  ├─ hintViewed          → +score                 │                       │     │
     │   │  ├─ explanationViewed   → +score                 │                       │     │
     │   │  ├─ errorEncountered    → +score                 │                       │     │
     │   │  └─ notesAdded          → +score                 │                       │     │
     │   │                                                  │                       │     │
     │   │  Confidence Levels:                              │                       │     │
     │   │  ├─ high:   score > 75                           │                       │     │
     │   │  ├─ medium: score 50-75                          │                       │     │
     │   │  └─ low:    score < 50                           │                       │     │
     │   │                                                  │                       │     │
     │   │  Used By: ConceptCoverage.tsx, Progress bars      │                       │     │
     │   └────────────────────────────────┼─────────────────┴───────────────────────┘     │
     │                                    │                                                 │
     │   ┌────────────────────────────────┼──────────────────────────────────────────┐     │
     │   │  4. INSTRUCTOR ANALYTICS (ResearchDashboard.tsx) │                       │     │
     │   │  ────────────────────────────────────────────────┼────────────────────── │     │
     │   │                                                  │                       │     │
     │   │  Metrics Calculated:                             │                       │     │
     │   │  ├─ Total interactions per learner               │                       │     │
     │   │  ├─ Error rate by problem                        │                       │     │
     │   │  ├─ Hint escalation patterns                     │                       │     │
     │   │  ├─ Textbook unit creation rate                  │                       │     │
     │   │  ├─ Concept coverage distribution                │                       │     │
     │   │  ├─ Strategy comparison (A/B style)              │                       │     │
     │   │  └─ Timeline visualization                       │                       │     │
     │   │                                                  │                       │     │
     │   │  Export: JSON/CSV with full trace               │                       │     │
     │   │                                                  │                       │     │
     │   │  Used By: Instructor role only                   │                       │     │
     │   └────────────────────────────────┼─────────────────┴───────────────────────┘     │
     │                                    │                                                 │
     │   ┌────────────────────────────────┼──────────────────────────────────────────┐     │
     │   │  5. POLICY REPLAY (replay-toy.mjs)               │                       │     │
     │   │  ────────────────────────────────────────────────┼────────────────────── │     │
     │   │                                                  │                       │     │
     │   │  Replay Engine:                                  │                       │     │
     │   │  ├─ Load interaction trace from export           │                       │     │
     │   │  ├─ Reconstruct decision points                  │                       │     │
     │   │  ├─ Apply different strategy thresholds          │                       │     │
     │   │  ├─ Compare outcomes (counterfactuals)           │                       │     │
     │   │  └─ Validate policy changes                      │                       │     │
     │   │                                                  │                       │     │
     │   │  Used By: Regression testing, Policy research    │                       │     │
     │   └──────────────────────────────────────────────────┴───────────────────────┘     │
     │                                                                                      │
     └─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW EXAMPLE                                           │
│                    Student Journey: Error → Hint → Textbook → Progress                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  Timeline ──────────────────────────────────────────────────────────────────────────────▶

  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
  │ Write   │───▶│  Error  │───▶│ Request │───▶│  View   │───▶│  Save   │───▶│  Next   │
  │ SQL     │    │ occurs  │    │ Hint    │    │  L1-L3  │    │  to TB  │    │ Problem │
  └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
       │              │              │              │              │              │
       ▼              ▼              ▼              ▼              ▼              ▼
  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
  │code_    │   │error    │   │hint_    │   │hint_view│   │textbook_│   │coverage_│
  │change   │   │event    │   │request  │   │rung: 1-3│   │add      │   │change   │
  └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
       │              │              │              │              │              │
       └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
                                         │
                                         ▼
                    ┌─────────────────────────────────────┐
                    │         Features Updated            │
                    ├─────────────────────────────────────┤
                    │ • Orchestrator: Error count +1      │
                    │ • Trace Analyzer: Pattern detected  │
                    │ • Coverage: Concept evidence +1     │
                    │ • Textbook: New unit created        │
                    │ • Dashboard: Stats recalculated     │
                    └─────────────────────────────────────┘
```

---

## Summary: Inter-Feature Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              FEATURE DEPENDENCY GRAPH                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │  INTERACTION    │
                              │     LOG         │
                              │  (Central Hub)  │
                              └────────┬────────┘
                                       │
          ┌────────────┬───────────────┼───────────────┬────────────┐
          ▼            ▼               ▼               ▼            ▼
   ┌────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌────────────┐
   │   Hint     │ │ Textbook │ │   Concept    │ │  Trace   │ │ Instructor │
   │  System    │ │  System  │ │   Coverage   │ │ Analyzer │ │ Dashboard  │
   └──────┬─────┘ └────┬─────┘ └──────┬───────┘ └────┬─────┘ └─────┬──────┘
          │            │              │              │             │
          │            │              │              │             │
          ▼            ▼              ▼              ▼             ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                         SHARED OUTPUTS                                │
   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
   │  │ Personalized │  │ Accumulated  │  │  Progress    │  │ Research  │ │
   │  │    Hints     │  │    Notes     │  │   Tracking   │  │   Data    │ │
   │  └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘ │
   └──────────────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**
1. **Single Source of Truth**: All features read from the same interaction log
2. **Immutable Events**: Events are appended, never modified (enables replay)
3. **Lazy Evaluation**: Analytics computed on-demand from event stream
4. **Decoupled Features**: Each feature consumes events independently
5. **Full Traceability**: Every output can be traced back to source events
