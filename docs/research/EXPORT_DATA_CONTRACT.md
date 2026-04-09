# Research Export Data Contract

**Version:** 1.0.0  
**Last Updated:** 2026-04-08  
**Status:** Active

---

## Overview

This document defines the contract for research data exports from the Adaptive Instructional Artifacts system. It specifies field semantics, ordering guarantees, and reproducibility requirements for all research endpoints.

---

## Export Endpoints

| Endpoint | Method | Format | Purpose |
|----------|--------|--------|---------|
| `/api/research/summary` | GET | JSON/CSV | Class-level summary with interactions |
| `/api/research/learners` | GET | JSON | Learner list with summary stats |
| `/api/research/aggregates` | GET | JSON | Aggregated class statistics |
| `/api/instructor/export` | GET | JSON/NDJSON | Paginated learner data export |

---

## Field Preservation Contract

The following fields are guaranteed to be preserved in all exports:

### Core Identity Fields
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique interaction identifier (UUID) |
| `learnerId` | string | Reference to users.id |
| `sectionId` | string \| null | Reference to course_sections.id |
| `sessionId` | string | Session identifier for replay grouping |
| `timestamp` | ISO 8601 | Event timestamp (UTC) |
| `createdAt` | ISO 8601 | Record creation timestamp |

### Event Fields
| Field | Type | Description |
|-------|------|-------------|
| `eventType` | string | Type of interaction event |
| `problemId` | string | Reference to problem being attempted |
| `problemSetId` | string \| null | Parent problem set identifier |
| `problemNumber` | number \| null | Position within problem set |

### Content Fields
| Field | Type | Description |
|-------|------|-------------|
| `code` | string \| null | SQL code submitted (if applicable) |
| `error` | string \| null | Error message (if applicable) |
| `errorSubtypeId` | string \| null | Categorized error identifier |
| `hintId` | string \| null | Hint identifier (if hint shown) |
| `hintText` | string \| null | Hint content (if captured) |
| `hintLevel` | number \| null | Hint escalation level |

### Adaptive System Fields
| Field | Type | Description |
|-------|------|-------------|
| `hdi` | number \| null | Help Dependency Index value |
| `hdiLevel` | string \| null | HDI category (low/medium/high) |
| `hdiComponents` | object \| null | Detailed HDI calculation inputs |
| `profileId` | string \| null | Assigned learner profile |
| `assignmentStrategy` | string \| null | How profile was assigned |
| `banditState` | object \| null | Thompson sampling state (if used) |

### Replay Fields
| Field | Type | Description |
|-------|------|-------------|
| `payload` | object \| null | Complete event payload for reconstruction |
| `sourceInteractionIds` | string[] \| null | References to triggering events |
| `triggerReason` | string \| null | Why this event occurred |

---

## Ordering Guarantees

### Interaction Events
- **Primary sort:** `timestamp DESC` (newest first)
- **Secondary sort:** `id ASC` (for deterministic tie-breaking)

### Learner Lists
- **Primary sort:** `name ASC` (alphabetical by display name)
- **Secondary sort:** `id ASC` (for deterministic tie-breaking)

### Export Reproducibility
All exports include:
1. `exportedAt`: ISO 8601 timestamp of export generation
2. `exportMetadata.actorRole`: Who initiated the export
3. `exportMetadata.actorId`: Identifier of exporting user
4. `exportMetadata.sectionIds`: Sections included in export

---

## Pagination Contract

### Request Parameters
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `perPage` | integer | 50 | 200 | Items per page |

### Response Metadata
```json
{
  "pagination": {
    "page": 1,
    "perPage": 50,
    "total": 150,
    "hasMore": true
  }
}
```

### Streaming Mode
For large exports, use `?stream=true`:
- Returns NDJSON (newline-delimited JSON)
- Each line is a complete JSON object
- No in-memory array construction on server
- Client processes stream incrementally

---

## Memory Safety Limits

| Resource | Limit | Behavior When Exceeded |
|----------|-------|------------------------|
| Learners per summary | 100 | HTTP 400 with error code |
| Interactions per learner | 10,000 | Warning in response, truncated |
| Estimated payload size | 100MB | HTTP 413, suggest streaming |
| Learners per page | 200 | Hard cap enforced |

---

## Date Range Filtering

All date parameters accept ISO 8601 format:
- `startDate`: Inclusive lower bound
- `endDate`: Inclusive upper bound

Examples:
- `2026-04-01` (date only, assumes midnight)
- `2026-04-01T00:00:00Z` (explicit UTC)
- `2026-04-01T12:00:00-07:00` (with timezone)

---

## Event Type Taxonomy

Guaranteed event types for filtering:

| Type | Description |
|------|-------------|
| `code_change` | SQL code modified |
| `code_execute` | Query executed |
| `hint_request` | Learner requested hint |
| `hint_show` | Hint displayed to learner |
| `explanation_request` | Learner requested explanation |
| `explanation_show` | Explanation displayed |
| `guidance_escalate` | Escalation triggered |
| `problem_solved` | Problem completed successfully |
| `problem_skip` | Problem skipped |
| `bandit_arm_selected` | Adaptive arm chosen |
| `bandit_reward_observed` | Reward signal captured |
| `textbook_unit_created` | Note added to textbook |

---

## CSV Export Format

When `?format=csv` is specified:

1. Header row with field names (snake_case)
2. One row per interaction
3. JSON objects are stringified in cells
4. Newlines in content are escaped as `\n`
5. UTF-8 encoding guaranteed

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-08 | Initial contract |

---

## Verification Commands

```bash
# Verify export endpoint responds
npm run research:validate

# Check export format compliance
node scripts/export/export-policies.mjs

# Verify data integrity
node scripts/replay-checksum-gate.mjs
```
