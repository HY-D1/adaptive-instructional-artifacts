import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import initSqlJs from 'sql.js';
import { CONCEPT_LESSON_TOPICS, getConceptLesson, getLessonReadTime, LESSON_VERSION, TOPIC_LABELS } from './concept-lessons';

const map = JSON.parse(readFileSync(resolve(process.cwd(), 'apps/web/public/textbook-static/concept-map.json'), 'utf8'));
const ids = Object.keys(map.concepts);

describe('authored concept lessons', () => {
  it('covers every shipped route with substantial lesson material and two distinct checks', () => {
    expect(LESSON_VERSION).toBe('concept-lessons-v1');
    expect(Object.keys(CONCEPT_LESSON_TOPICS).sort()).toEqual(ids.sort());
    for (const id of ids) {
      const lesson = getConceptLesson(id)!;
      expect(lesson, id).toBeDefined();
      expect(TOPIC_LABELS[lesson.topic], id).toBeTruthy();
      expect(lesson.explanation.join(' ').length, id).toBeGreaterThan(220);
      expect(lesson.objectives.length, id).toBeGreaterThanOrEqual(2);
      expect(lesson.mistakes[0].incorrect, id).not.toBe(lesson.mistakes[0].correct);
      expect(lesson.checks.length, id).toBeGreaterThanOrEqual(2);
      expect(new Set(lesson.checks.map(c => c.question)).size).toBe(lesson.checks.length);
      for (const check of lesson.checks) {
        expect(check.options[check.correctIndex], id).toBeDefined();
        expect(new Set(check.options.map(o => o.text)).size).toBe(check.options.length);
        for (const option of check.options) expect(option.feedback.length, id).toBeGreaterThan(25);
      }
      for (const linked of [...lesson.prerequisites, ...lesson.relatedConcepts, ...(lesson.nextConcept ? [lesson.nextConcept] : [])]) {
        expect(ids, `${id} links ${linked}`).toContain(linked);
      }
      expect(getLessonReadTime(lesson), id).toBeGreaterThanOrEqual(1);
      expect(lesson.sources.every(s => s.startsWith('https://'))).toBe(true);
    }
  });

  it('executes every distinct runnable example and verifies result or mutation state', async () => {
    const SQL = await initSqlJs();
    const seen = new Set<string>();
    for (const id of ids) {
      const lesson = getConceptLesson(id)!;
      for (const example of lesson.examples) {
        if (!example.schema || !example.sql || seen.has(example.sql)) continue;
        seen.add(example.sql);
        const db = new SQL.Database();
        try {
          db.exec(example.schema);
          const result = db.exec(example.sql);
          const inspected = example.inspectSql ? db.exec(example.inspectSql) : result;
          expect(inspected[inspected.length - 1]?.values ?? [], `${id}: ${example.sql}`).toEqual(example.expectedRows);
        } finally { db.close(); }
      }
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('supports legacy aliases while leaving unrelated remote concepts unchanged', () => {
    expect(getConceptLesson('aggregation')?.title).toBe('Aggregate functions');
    expect(getConceptLesson('having-clause')?.title).toBe('HAVING');
    expect(getConceptLesson('select-basic')).toBe(getConceptLesson('dbms-ramakrishnan-3rd-edition/select-basic'));
    expect(getConceptLesson('other-source/select-basic')).toBeUndefined();
    expect(getConceptLesson('unknown')).toBeUndefined();
    expect(getConceptLesson('murachs-mysql-3rd-edition/stored-procedures')?.examples[0].schema).toBeUndefined();
  });

  it('keeps engine-specific caveats accurate and visible', () => {
    expect(getConceptLesson('joins')!.explanation.join(' ')).toContain('SQLite accepts');
    expect(getConceptLesson('group-by')!.explanation.join(' ')).toContain('SQLite permits bare columns');
    expect(getConceptLesson('dbms-ramakrishnan-3rd-edition/foreign-key')!.explanation.join(' ')).toContain('PRAGMA foreign_keys = ON');
  });
});

// Independent counterexamples establish the misconception semantics, rather than
// merely checking that authored prose contains a caveat or that SQL compiles.
describe('lesson misconception counterexamples in the actual SQLite engine', () => {
  it('distinguishes NULL tests, duplicate removal and deterministic pagination', async () => {
    const SQL = await initSqlJs(); const db = new SQL.Database();
    try {
      db.exec(getConceptLesson('select-basic')!.examples[0].schema!);
      expect(db.exec('SELECT name FROM people WHERE score = NULL;')).toEqual([]);
      expect(db.exec('SELECT name FROM people WHERE score IS NULL;')[0].values).toEqual([['Cy']]);
      expect(db.exec('SELECT team FROM people WHERE team IS NOT NULL ORDER BY team;')[0].values).toEqual([['Blue'],['Blue'],['Red']]);
      expect(db.exec('SELECT DISTINCT team FROM people WHERE team IS NOT NULL ORDER BY team;')[0].values).toEqual([['Blue'],['Red']]);
      expect(db.exec('SELECT name FROM people WHERE score IS NOT NULL ORDER BY score DESC, id ASC LIMIT 1 OFFSET 1;')[0].values).toEqual([['Dee']]);
      expect(db.exec("SELECT 'Blue' UNION ALL SELECT 'Blue';")[0].values).toEqual([['Blue'],['Blue']]);
      expect(db.exec("SELECT 'Blue' UNION SELECT 'Blue';")[0].values).toEqual([['Blue']]);
    } finally { db.close(); }
  });
  it('distinguishes join conditions, outer filtering, aggregates and correlation', async () => {
    const SQL = await initSqlJs(); const db = new SQL.Database();
    try {
      db.exec(getConceptLesson('select-basic')!.examples[0].schema!);
      expect(db.exec('SELECT COUNT(*) FROM people JOIN teams;')[0].values).toEqual([[12]]);
      expect(db.exec('SELECT COUNT(*) FROM people p JOIN teams t ON p.team=t.name;')[0].values).toEqual([[3]]);
      expect(db.exec("SELECT COUNT(*) FROM people p LEFT JOIN teams t ON p.team=t.name AND t.city='Boston';")[0].values).toEqual([[4]]);
      expect(db.exec("SELECT COUNT(*) FROM people p LEFT JOIN teams t ON p.team=t.name WHERE t.city='Boston';")[0].values).toEqual([[2]]);
      expect(db.exec('SELECT COUNT(*), COUNT(score), SUM(score), AVG(score) FROM people;')[0].values).toEqual([[4,3,50,50/3]]);
      expect(db.exec('SELECT team, COUNT(*) FROM people WHERE team IS NOT NULL GROUP BY team HAVING COUNT(*) >= 2;')[0].values).toEqual([['Blue',2]]);
      expect(db.exec('SELECT t.name FROM teams t WHERE EXISTS (SELECT 1 FROM people) ORDER BY t.name;')[0].values).toEqual([['Blue'],['Gold'],['Red']]);
      expect(db.exec('SELECT t.name FROM teams t WHERE EXISTS (SELECT 1 FROM people p WHERE p.team=t.name) ORDER BY t.name;')[0].values).toEqual([['Blue'],['Red']]);
      // SQLite accepts a bare name, but it is not an aggregate of all names.
      const bare = db.exec('SELECT name, SUM(score) FROM people;')[0].values;
      expect(bare).toHaveLength(1); expect(bare[0][1]).toBe(50);
    } finally { db.close(); }
  });
});
