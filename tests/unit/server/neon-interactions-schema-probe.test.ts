/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../apps/server/src/db/neon.js', () => ({}));
vi.mock('../../../apps/server/src/db/sections.js', () => ({}));

import {
  interactionEventSchema,
} from '../../../apps/server/src/routes/neon-interactions.js';
import { validateResearchEvent } from '../../../apps/server/src/db/index.js';

const baseEvent = {
  id: 'probe-event-1',
  learnerId: 'probe-learner',
  sessionId: 'probe-session',
  timestamp: new Date(0).toISOString(),
  problemId: 'probe-problem',
};

const events = {
  run: {
    ...baseEvent,
    eventType: 'execution',
    code: 'SELECT 1;',
    successful: true,
    timeSpent: 1200,
    conceptIds: ['select-basics'],
    policyVersion: 'probe-policy',
  },
  error: {
    ...baseEvent,
    eventType: 'error',
    code: 'SELECT missing;',
    error: 'unknown column',
    errorSubtypeId: 'unknown-column',
    sqlEngageSubtype: 'schema-reference',
    policyVersion: 'probe-policy',
  },
  hint_view: {
    ...baseEvent,
    eventType: 'hint_view',
    hintId: 'probe-hint',
    hintText: 'Check the selected columns.',
    hintLevel: 1,
    templateId: 'probe-template',
    sqlEngageSubtype: 'projection',
    sqlEngageRowId: 'probe-row',
    policyVersion: 'probe-policy',
    helpRequestIndex: 1,
    inputs: { hint_count: 1 },
    outputs: {
      llm_model: null,
      hint_source: 'static',
      prompt_version: 'probe-prompt',
    },
  },
  concept_view: {
    ...baseEvent,
    eventType: 'concept_view',
    conceptId: 'select-basics',
    source: 'problem',
  },
};

describe('neon interaction schema probe', () => {
  it.each(Object.entries(events))('reports current validation for %s', (name, event) => {
    const result = interactionEventSchema.safeParse(event);
    const issues = result.success ? [] : result.error.issues.map((issue) => issue.message);
    const research = validateResearchEvent(event);

    console.info(`[schema-probe] ${name} schema=${result.success ? 'pass' : 'fail'} research=${research.valid ? 'pass' : 'fail'} issues=${issues.join('; ') || 'none'} missing=${research.missing.join('; ') || 'none'}`);

    expect(result.success).toBe(true);
    expect(research.valid).toBe(true);
  });
});