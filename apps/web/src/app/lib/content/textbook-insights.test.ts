import { describe, expect, it } from 'vitest';
import { buildTextbookInsights, type SortMode } from './textbook-insights';
import { getKnownSqlEngageSubtypes } from '../../data/sql-engage';
import type { InstructionalUnit, InteractionEvent } from '../../types';
const subtypes = getKnownSqlEngageSubtypes().slice(0, 5);
const error = (id: string, subtype = subtypes[0], timestamp = 1000): InteractionEvent => ({ id, eventType: 'error', timestamp, sqlEngageSubtype: subtype } as InteractionEvent);
const build = (interactions: InteractionEvent[]) => buildTextbookInsights({ units: [], interactions, nowTimestamp: 100000000 });
describe('reader error evidence and review order', () => {
  it('does not label help-only activity or unknown errors as repeated errors', () => {
    expect(build([ { ...error('a'), eventType: 'hint_view' }, { ...error('b'), eventType: 'explanation_view' }, error('c','unknown-subtype'), error('d','unknown-subtype') ]).misconceptionCards).toEqual([]);
  });
  it('counts each error ID once without mutating evidence', () => {
    const events = [error('a'),error('a'),error('b')];
    const before = JSON.stringify(events);
    const result = build(events);
    expect(result.misconceptionCards[0].count).toBe(2);
    expect(result.misconceptionCards[0].evidenceIds).toEqual(['a','b']);
    expect(JSON.stringify(events)).toBe(before);
    expect(build(events.slice(0,2)).spacedReviewPrompts).toEqual([]);
  });
  it('selects oldest due reviews before display limits and breaks ties by subtype', () => {
    const events = subtypes.flatMap((subtype,index) => Array.from({length:index === 4 ? 2 : 5},(_,n) => error(`${index}-${n}`,subtype,index === 4 ? 0 : 100000000)));
    const result=build(events);
    expect(result.misconceptionCards).toHaveLength(4);
    expect(result.misconceptionCards.some(c=>c.subtype===subtypes[4])).toBe(false);
    expect(result.spacedReviewPrompts).toHaveLength(3);
    expect(result.spacedReviewPrompts[0].title).toBe(`Review ${subtypes[4]}`);
    expect(result.spacedReviewPrompts[0].dueAt).toBe(86400000);
    expect(result.spacedReviewPrompts[1].title.localeCompare(result.spacedReviewPrompts[2].title)).toBeLessThan(0);
  });
  it.each<SortMode>(['quality','newest','oldest','prerequisite'])('orders tied notes deterministically in %s without blocking notes',sortMode=>{
    const unit = {conceptId:'joins',title:'same',addedTimestamp:1000,qualityScore:0.5} as InstructionalUnit;
    const units=[{...unit,id:'b'},{...unit,id:'a'}];
    const result=buildTextbookInsights({units,interactions:[],sortMode});
    expect(result.orderedUnits.map(u=>u.id)).toEqual(['a','b']);
    expect(result.blockedUnits).toEqual([]);
    expect(units[0].id).toBe('b');
  });
});
