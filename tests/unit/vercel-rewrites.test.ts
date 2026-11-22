import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the same-origin API setup (first-party cookies).
 *
 * When the web project sets VITE_API_BASE_URL=same-origin, the browser calls
 * /api/... and /health on the website's own origin. These rewrites forward them
 * to the API project, so auth cookies are first-party and survive browsers that
 * block third-party cookies. The SPA catch-all must stay LAST, otherwise it
 * would swallow the API paths and return index.html.
 */
describe('vercel.json rewrites (same-origin API)', () => {
  const config = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8'),
  ) as { rewrites: Array<{ source: string; destination: string }> };

  const indexOf = (source: string) => config.rewrites.findIndex((r) => r.source === source);

  it('forwards /api/* to the API project', () => {
    const rule = config.rewrites[indexOf('/api/:path*')];
    expect(rule).toBeDefined();
    expect(rule.destination).toMatch(/^https:\/\/[^/]+\.vercel\.app\/api\/:path\*$/);
  });

  it('forwards /health to the API project', () => {
    const rule = config.rewrites[indexOf('/health')];
    expect(rule).toBeDefined();
    expect(rule.destination).toMatch(/^https:\/\/[^/]+\.vercel\.app\/health$/);
  });

  it('uses the same API host for every forwarded path', () => {
    const hosts = config.rewrites
      .filter((r) => r.destination.startsWith('https://'))
      .map((r) => new URL(r.destination.replace(':path*', 'x')).host);
    expect(new Set(hosts).size).toBe(1);
  });

  it('keeps the SPA catch-all last', () => {
    const catchAll = indexOf('/(.*)');
    expect(catchAll).toBe(config.rewrites.length - 1);
    expect(indexOf('/api/:path*')).toBeLessThan(catchAll);
    expect(indexOf('/health')).toBeLessThan(catchAll);
  });
});
