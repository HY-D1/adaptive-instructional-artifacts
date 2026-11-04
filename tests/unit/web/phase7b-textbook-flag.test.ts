import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// D2: "textbook off" must stop every textbook write path, not just hide chat.
describe('textbookDisabled gates all textbook writes', () => {
  const source = readFileSync('apps/web/src/app/pages/LearningInterface.tsx', 'utf8');

  it('disables background auto-creation and restarts analysis when the flag changes', () => {
    expect(source).toContain('enableAutoCreation: !textbookDisabled');
    expect(source).toContain('}, [learnerId, sessionId, textbookDisabled]);');
    expect(source).not.toContain('enableAutoCreation: true');
  });

  it('skips the error-time add_to_textbook decision', () => {
    expect(source).toContain("decision.decision === 'add_to_textbook' && resolvedSubtype && !textbookDisabled");
  });

  it('returns before persisting an explanation or a manual note', () => {
    const escalate = source.slice(source.indexOf('const handleEscalate ='));
    const guard = escalate.indexOf('if (textbookDisabled) {');
    const persist = escalate.indexOf("persistGeneratedUnit('explanation.v1'");
    expect(guard).toBeGreaterThan(0);
    expect(persist).toBeGreaterThan(guard);
    // The manual "Save to Notes" handler is the last notebook_unit.v1 write.
    const manualAt = source.lastIndexOf("'notebook_unit.v1'");
    const manualHandler = source.slice(source.lastIndexOf('collectNoteEvidenceIds([], { maxInteractions: 12 })', manualAt) - 200, manualAt);
    expect(manualHandler).toContain('if (textbookDisabled) {');
  });
});
