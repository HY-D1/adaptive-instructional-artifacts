import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('student route pre-survey gate configuration', () => {
  it.each([
    ['concepts', "path: 'concepts'"],
    ['textbook', "path: 'textbook'"],
    ['settings', "path: 'settings'"],
    ['practice', "path: 'practice'"],
  ])('requires the pre-survey for %s', (_name, pathDeclaration) => {
    const source = readFileSync(join(process.cwd(), 'apps/web/src/app/routes.tsx'), 'utf8');
    const pathIndex = source.indexOf(pathDeclaration);
    const nextRoute = source.indexOf("path: '", pathIndex + pathDeclaration.length);
    const routeBlock = source.slice(pathIndex, nextRoute === -1 ? source.length : nextRoute);
    expect(routeBlock).toContain('requirePreSurvey: true');
  });
});