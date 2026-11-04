import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateHDI } from '../../../apps/web/src/app/lib/ml/hdi-calculator';
import type { InteractionEvent } from '../../../apps/web/src/app/types';

const fixture = JSON.parse(readFileSync('tests/fixtures/hdi-parity.json', 'utf8'));

describe('HDI parity fixture (app is canonical)', () => {
  it('matches the shared expected components, score and level', () => {
    const events = fixture.events.map((event: Record<string, unknown>, index: number) => ({
      id: `e${index}`, learnerId: 'l1', ...event,
    })) as InteractionEvent[];
    const result = calculateHDI(events);
    for (const [name, value] of Object.entries(fixture.expected.components)) {
      expect(result.components[name as keyof typeof result.components], name).toBeCloseTo(value as number, 6);
    }
    expect(result.hdi).toBeCloseTo(fixture.expected.hdi, 4);
    expect(result.level).toBe(fixture.expected.level);
  });
});
