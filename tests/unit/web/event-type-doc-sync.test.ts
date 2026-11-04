import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const typesSource = readFileSync(resolve(root, 'apps/web/src/app/types/index.ts'), 'utf8');
const loggingDoc = readFileSync(resolve(root, 'docs/research/LOGGING.md'), 'utf8');

function quoted(text: string): string[] {
  return [...text.replace(/\/\/.*$/gm, '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

function unionMembers(): string[] {
  const helpLine = typesSource.match(/export type HelpEventType = ([^;]+);/);
  expect(helpLine, 'HelpEventType not found').not.toBeNull();
  const start = typesSource.indexOf('eventType:');
  const end = typesSource.indexOf('problemId: string;', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  // `HelpEventType` is referenced by name inside the union; expand it.
  return [...new Set([...quoted(typesSource.slice(start, end)), ...quoted(helpLine![1])])];
}

function documentedTypes(): string[] {
  const heading = '### Canonical Event Types (web `eventType` union)';
  const start = loggingDoc.indexOf(heading);
  expect(start, 'canonical section missing from LOGGING.md').toBeGreaterThan(-1);
  const rest = loggingDoc.slice(start + heading.length);
  const next = rest.search(/^#{1,3} /m);
  const section = next === -1 ? rest : rest.slice(0, next);
  return [...section.matchAll(/^\|\s*`([a-z_]+)`\s*\|/gm)].map((m) => m[1]);
}

describe('event type documentation sync', () => {
  it('parses a plausible union', () => {
    expect(unionMembers().length).toBeGreaterThan(30);
  });

  it('documents every eventType union member in LOGGING.md', () => {
    const documented = new Set(documentedTypes());
    const missing = unionMembers().filter((t) => !documented.has(t));
    expect(missing).toEqual([]);
  });

  it('lists only types that exist in the eventType union', () => {
    const union = new Set(unionMembers());
    const extra = documentedTypes().filter((t) => !union.has(t));
    expect(extra).toEqual([]);
  });

  it('has no duplicate rows in the canonical section', () => {
    const docs = documentedTypes();
    expect(new Set(docs).size).toBe(docs.length);
  });
});
