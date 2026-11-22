import { describe, expect, it } from 'vitest';
import { CHAT_SYSTEM_PROMPT, deriveChatLearningSignals, findLastProblemError, rankUnitsForQuery, renderMarkdownToHtml } from './AskMyTextbookChat';
import type { InteractionEvent } from '../../../types';

describe('AskMyTextbookChat learning signals', () => {
  it('summarizes latest error, retries, hints, and stuck state for Groq prompts', () => {
    const interactions: InteractionEvent[] = [
      {
        id: 'exec-1',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_000,
        eventType: 'execution',
        problemId: 'problem-1',
        successful: false,
        errorSubtypeId: 'incorrect_results',
      },
      {
        id: 'hint-1',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_100,
        eventType: 'hint_request',
        problemId: 'problem-1',
      },
      {
        id: 'exec-2',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_200,
        eventType: 'execution',
        problemId: 'problem-1',
        successful: false,
        sqlEngageSubtype: 'missing_from',
      },
    ];

    const signals = deriveChatLearningSignals(interactions, 'problem-1', 'session-1');

    expect(signals.latestIssue).toBe('missing_from');
    expect(signals.failedRunCount).toBe(2);
    expect(signals.retryCount).toBe(1);
    expect(signals.hintCount).toBe(1);
    expect(signals.lastInteractionTypes).toEqual(['execution', 'hint_request', 'execution']);
    expect(signals.stuckReason).toBe('latest_execution_incorrect');
  });
});

describe('AskMyTextbookChat context scoping', () => {
  const base = { learnerId: 'learner-1', sessionId: 'session-1' } as const;
  const interactions: InteractionEvent[] = [
    { ...base, id: 'e-upper', timestamp: 1, eventType: 'error', problemId: 'upper-problem', sqlEngageSubtype: 'wrong_function' },
    { ...base, id: 'e-null', timestamp: 2, eventType: 'hint_request', problemId: 'null-problem' },
  ];

  it('does not use an error from another problem', () => {
    expect(findLastProblemError(interactions, 'null-problem', 'session-1')).toBeUndefined();
  });

  it('finds the latest failed run for the same problem', () => {
    const found = findLastProblemError(interactions, 'upper-problem', 'session-1');
    expect(found?.id).toBe('e-upper');
  });

  it('treats a failed execution as an error and ignores other sessions', () => {
    const more: InteractionEvent[] = [
      ...interactions,
      { ...base, id: 'x-old', sessionId: 'session-0', timestamp: 3, eventType: 'error', problemId: 'null-problem' },
      { ...base, id: 'x-fail', timestamp: 4, eventType: 'execution', problemId: 'null-problem', successful: false },
    ];
    expect(findLastProblemError(more, 'null-problem', 'session-1')?.id).toBe('x-fail');
  });

  it('keeps the chat on SQL topics and away from earlier questions', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/only answer questions about SQL/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Do not bring up earlier questions/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/NEVER give working SQL code/);
  });
});


describe('rankUnitsForQuery', () => {
  const units = [
    { title: 'SELECT basics', content: 'Pick columns from a table.', conceptId: 'select-basic' },
    { title: 'Handling NULL values', content: 'Use IS NULL and COALESCE for missing data.', conceptId: 'null-handling' },
    { title: 'GROUP BY', content: 'Group rows and count them.', conceptId: 'group-by' },
  ];

  it('puts the unit that matches the typed question first', () => {
    const ranked = rankUnitsForQuery(units, 'how do I use group by with count?');
    expect(ranked[0].title).toBe('GROUP BY');
  });

  it('keeps the original order when nothing matches', () => {
    const ranked = rankUnitsForQuery(units, 'zzzz qqqq');
    expect(ranked).toBe(units);
  });
});


describe('renderMarkdownToHtml', () => {
  it('wraps bullet and numbered lists in real lists', () => {
    const html = renderMarkdownToHtml('Steps:\n1. Look at the table\n2. Pick the column\n\n- one\n- two');
    expect(html).toContain('<ol');
    expect(html).toContain('<ul');
    expect(html.match(/<li>/g)?.length).toBe(4);
  });

  it('keeps snake_case and ___ placeholders as typed', () => {
    const html = renderMarkdownToHtml('Use employee_id and ___(name) here');
    expect(html).toContain('employee_id');
    expect(html).toContain('___(name)');
    expect(html).not.toContain('<em>');
  });

  it('does not add extra line breaks inside code blocks and escapes HTML', () => {
    const html = renderMarkdownToHtml('```sql\nSELECT a\nFROM t\n```\n<script>x</script>');
    expect(html).toContain('SELECT a\nFROM t');
    expect(html).not.toContain('<br/>');
    expect(html).not.toContain('<script>');
  });

  it('turns headings into bold lines and **bold** into strong', () => {
    const html = renderMarkdownToHtml('### Idea\nThis is **important**.');
    expect(html).toContain('font-semibold');
    expect(html).toContain('<strong');
  });
});
