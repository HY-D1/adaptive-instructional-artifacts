# Enhanced Hint System with LLM & Textbook Integration

**Branch:** `feature/enhanced-hints-llm-integration`  
**Status:** In Development  
**Version:** `enhanced-hint-v1.0.0`

## Overview

The Enhanced Hint System intelligently leverages available learning resources to provide personalized, context-aware hints to students practicing SQL problems. It implements a **multi-source decision matrix** that dynamically selects the best hint generation strategy based on connected resources.

## Design Inspiration

Based on research in LLM-powered educational systems:

1. **PELICAN** (Personalized Education via LLM) - Adaptive tutoring frameworks
2. **LPITutor** - LLM-based personalized intelligent tutoring
3. **Adaptive Scaffolding Theory** - Theory-driven AI pedagogical agents
4. **Grounded Generation** - Source-cited explanations for trustworthiness

## Decision Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESOURCE AVAILABILITY CHECK                           │
├─────────────────────────────────────────────────────────────────────────┤
│  SQL-Engage CSV (always ✓)  │  Textbook units?  │  LLM available?      │
└─────────────────────────────┴───────────────────┴───────────────────────┘
           │                           │                    │
           ▼                           ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CASE 1: LLM Available                                                   │
│  ├── Textbook connected → Full LLM with textbook context                 │
│  └── No Textbook        → LLM with SQL-Engage + PDF only                 │
│  Confidence: 0.9 (high)                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  CASE 2: No LLM + Textbook Available                                     │
│  └── Enhanced SQL-Engage with textbook references                        │
│  Confidence: 0.7 (medium-high)                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  CASE 3: SQL-Engage Only (fallback)                                      │
│  └── Progressive hints from CSV dataset                                  │
│  Confidence: 0.5 (medium)                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Enhanced Hint Service (`lib/enhanced-hint-service.ts`)

Core service that orchestrates hint generation:

```typescript
// Check available resources
const resources = checkAvailableResources(learnerId);
// Returns: { sqlEngage: true, textbook: true, llm: true, pdfIndex: false }

// Generate intelligent hint
const hint = await generateEnhancedHint({
  learnerId,
  problemId,
  rung: 2, // L1, L2, or L3
  errorSubtypeId: 'missing-where-clause',
  recentInteractions
});
```

**Features:**
- **Resource Detection**: Automatically checks Textbook, LLM, and PDF availability
- **Smart Fallbacks**: Graceful degradation when resources unavailable
- **Relevance Scoring**: Finds most relevant textbook units by concept + keyword matching
- **Confidence Scoring**: 0.3-0.9 scale based on source richness

### 2. React Hook (`hooks/useEnhancedHints.ts`)

```typescript
const {
  generateHint,
  checkResources,
  getStrategyDescription,
  isGenerating,
  lastHint,
  availableResources
} = useEnhancedHints({ learnerId, problemId, sessionId, recentInteractions });
```

### 3. UI Component (`components/HintSourceStatus.tsx`)

Visual indicator showing which resources power the hints:

- **Compact view**: Badge showing "3 hint sources active" or "Standard hints"
- **Expanded view**: Full breakdown with status icons
- **Auto-refresh**: Checks every 30 seconds for resource changes

## Textbook Relevance Algorithm

When a learner has saved textbook units, the system scores each unit:

```typescript
// Scoring criteria (max ~6.5 points)
const score = 
  conceptMatch ? 3 : 0 +           // Same concept ID: +3
  keywordMatches * 1 +             // Keyword in content: +1 each
  recentUnit ? 0.5 : 0;           // Within 7 days: +0.5

// Returns top 3 most relevant units
```

## LLM Prompt Enhancement

When LLM is available, the retrieval bundle includes:

```
Standard Bundle:
- Error subtype
- Problem context
- PDF passages (if available)

Enhanced Bundle (with Textbook):
- All of above +
- Relevant textbook units (top 3)
- Previous hint history
- Escalation context
```

## API Reference

### Types

```typescript
type EnhancedHint = {
  content: string;
  rung: 1 | 2 | 3;
  sources: {
    sqlEngage: boolean;
    textbook: boolean;
    llm: boolean;
    pdfPassages: boolean;
  };
  conceptIds: string[];
  sourceRefIds?: string[];
  textbookUnits?: InstructionalUnit[];
  llmGenerated: boolean;
  confidence: number; // 0-1
};

type AvailableResources = {
  sqlEngage: boolean;  // Always true
  textbook: boolean;   // Has saved units
  llm: boolean;        // Ollama/configured
  pdfIndex: boolean;   // PDF index loaded
};
```

### Functions

| Function | Purpose |
|----------|---------|
| `checkAvailableResources(learnerId)` | Sync check of all resources |
| `generateEnhancedHint(options)` | Async hint generation with fallbacks |
| `findRelevantTextbookUnits(...)` | Content-based relevance search |
| `preloadHintContext(...)` | Predictive loading for responsiveness |
| `getHintStrategyDescription(...)` | Human-readable strategy string |

## Integration with Existing System

### HintSystem Component Updates

1. **Import enhanced dependencies**
2. **Add hook usage** for enhanced hint generation
3. **Add `generateEnhancedHintForRung`** async function
4. **Display `<HintSourceStatus />`** in hint panel
5. **Maintain backward compatibility** - falls back to existing logic

### Data Flow

```
Student Requests Hint
         │
         ▼
┌─────────────────────┐
│ Check Resources     │
│ (sync, cached)      │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌──────────┐
│ LLM +   │ │ SQL-      │
│ Textbook│ │ Engage   │
│ Path    │ │ Only     │
└────┬────┘ └────┬─────┘
     │           │
     ▼           ▼
┌─────────────────────┐
│ Return EnhancedHint │
│ with metadata       │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Log Interaction     │
│ (same schema)       │
└─────────────────────┘
```

## Backward Compatibility

The enhanced system maintains full backward compatibility:

- **Event Schema**: Unchanged - logs same `hint_view` events
- **SQL-Engage**: Still primary source when LLM unavailable
- **Progression Logic**: Same L1 → L2 → L3 → Escalation flow
- **Fallback Chain**: LLM → Textbook-enhanced → SQL-Engage → Generic

## Future Enhancements

1. **Concept Graph Traversal**: Use prerequisite relationships for better textbook unit matching
2. **Spaced Repetition**: Prioritize textbook units due for review
3. **Peer Learning**: Include hints from similar learners' textbook entries
4. **Multi-modal**: Support for code examples, diagrams in textbook references
5. **A/B Testing**: Compare LLM vs SQL-Engage hint effectiveness by concept

## Testing

### Unit Tests Needed

```typescript
describe('Enhanced Hint Service', () => {
  test('detects textbook availability', () => {});
  test('scores textbook unit relevance', () => {});
  test('fallback to SQL-Engage when LLM fails', () => {});
  test('enhances hint with textbook references', () => {});
  test('confidence scoring accuracy', () => {});
});
```

### E2E Tests Needed

```typescript
test('shows hint source status badge', () => {});
test('generates LLM hint when available', () => {});
test('includes textbook references at L2+', () => {});
test('graceful fallback when offline', () => {});
```

## Performance Considerations

- **Resource caching**: Checks cached for 30 seconds
- **Predictive loading**: Pre-fetch textbook units on error detection
- **Async LLM calls**: Non-blocking; shows loading state
- **Bundle size**: Dynamic import for LLM contracts

## Deployment Notes

1. No database migrations required
2. Uses existing `storage.getTextbook()` API
3. LLM availability auto-detected via env var
4. Gradual rollout: Start with 10% of learners

---

**Last Updated:** 2025-02-20  
**Author:** Feature Branch Development  
**Related:** [week3-report.md](week3-report.md), [progress.md](progress.md)
