import { describe, expect, it } from 'vitest';
import { buildFallbackSeed, generateSqlEngageFallbackHint } from './fallback';

const SUB = 'undefined column';
const seedFor = (learner: string, rung: 1 | 2 | 3, problem = 'p1') =>
  buildFallbackSeed(learner, problem, SUB, rung);

describe('generateSqlEngageFallbackHint seeding', () => {
  it('same seed gives same text', () => {
    const seed = seedFor('a', 3);
    const a = generateSqlEngageFallbackHint(SUB, 3, { seed });
    const b = generateSqlEngageFallbackHint(SUB, 3, { seed });
    expect(a.content).toBe(b.content);
  });

  it('different learner seeds on L3 produce different rows', () => {
    const texts = new Set(
      Array.from({ length: 20 }, (_, i) =>
        generateSqlEngageFallbackHint(SUB, 3, { seed: seedFor(`learner-${i}`, 3) }).content
      )
    );
    expect(texts.size).toBeGreaterThan(1);
  });

  it('no seed is identical to unseeded output (first row)', () => {
    const a = generateSqlEngageFallbackHint(SUB, 3);
    const b = generateSqlEngageFallbackHint(SUB, 3, { retrievalConfidence: 0.5 });
    expect(a.content).toBe(b.content);
    const seeded = generateSqlEngageFallbackHint(SUB, 3, { seed: seedFor('x', 3) });
    expect(seeded.content.length).toBeGreaterThan(0);
  });

  it('L1 text is unchanged by seed', () => {
    const base = generateSqlEngageFallbackHint(SUB, 1).content;
    for (let i = 0; i < 10; i++) {
      expect(generateSqlEngageFallbackHint(SUB, 1, { seed: seedFor(`l${i}`, 1) }).content).toBe(base);
    }
  });
});
