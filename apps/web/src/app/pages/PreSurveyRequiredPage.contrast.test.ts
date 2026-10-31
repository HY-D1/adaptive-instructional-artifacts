import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('pre-survey lock screen contrast', () => {
  it('defines readable dark-mode card, heading, body, and link colors', () => {
    const source = readFileSync(join(process.cwd(), 'apps/web/src/app/pages/PreSurveyRequiredPage.tsx'), 'utf8');
    expect(source).toContain('dark:bg-gray-800');
    expect(source).toContain('dark:text-gray-100');
    expect(source).toContain('dark:text-gray-300');
    expect(source).toContain('dark:text-blue-300');
  });
});