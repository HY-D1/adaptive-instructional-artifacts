/* @vitest-environment node */
import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signupRateLimiter } from '../../../apps/server/src/middleware/rate-limit';

describe('signup rate limit behind a proxy', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.post('/signup', signupRateLimiter, (_req, res) => res.sendStatus(200));
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  it('keeps the five-attempt limit for a shared IPv4 address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await fetch(`${baseUrl}/signup`, { method: 'POST', headers: { 'X-Forwarded-For': '192.0.2.48' } });
      statuses.push(response.status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it('does not allow IPv6 address rotation within the same subnet to bypass the limit', async () => {
    const statuses: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const response = await fetch(`${baseUrl}/signup`, { method: 'POST', headers: { 'X-Forwarded-For': `2001:db8:abcd:1200::${i}` } });
      statuses.push(response.status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    const otherSubnet = await fetch(`${baseUrl}/signup`, {
      method: 'POST', headers: { 'X-Forwarded-For': '2001:db8:abcd:1300::1' },
    });
    expect(otherSubnet.status).toBe(200);
  });
});
