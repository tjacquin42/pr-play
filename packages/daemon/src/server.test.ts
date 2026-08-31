import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Guide } from '@pr-guide/engine';
import { GuideStore } from './store';
import { createServer } from './server';

const dir = mkdtempSync(join(tmpdir(), 'pr-guide-srv-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const guide: Guide = {
  owner: 'o', repo: 'r', number: 7, title: 't', url: 'u',
  generatedAt: 'now', chaptersSource: 'fallback', chapters: [], symbols: [], noise: [],
};

async function listen(server: import('node:http').Server): Promise<string> {
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));
  const addr = server.address();
  if (addr === null || typeof addr === 'string') throw new Error('adresse inattendue');
  return `http://127.0.0.1:${addr.port}`;
}

describe('serveur HTTP', () => {
  it('status → analyze → polling → guide', async () => {
    let resolveJob!: () => void;
    const jobDone = new Promise<void>((r) => { resolveJob = r; });
    const server = createServer({
      store: new GuideStore(dir),
      analyze: async () => { await jobDone; return guide; },
    });
    const base = await listen(server);

    expect((await fetch(`${base}/status`)).ok).toBe(true);

    const started = await fetch(`${base}/analyze`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner: 'o', repo: 'r', number: 7 }),
    });
    expect(((await started.json()) as { status: string }).status).toBe('started');

    const running = await fetch(`${base}/guide/o/r/7`);
    expect(((await running.json()) as { status: string }).status).toBe('running');

    resolveJob();
    await new Promise((r) => setTimeout(r, 50));

    const done = await fetch(`${base}/guide/o/r/7`);
    expect(((await done.json()) as Guide).title).toBe('t');

    const cached = await fetch(`${base}/analyze`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner: 'o', repo: 'r', number: 7 }),
    });
    expect(((await cached.json()) as { status: string }).status).toBe('cached');

    server.close();
  });

  it('guide inconnu → 404', async () => {
    const server = createServer({ store: new GuideStore(dir), analyze: async () => guide });
    const base = await listen(server);
    expect((await fetch(`${base}/guide/x/y/1`)).status).toBe(404);
    server.close();
  });
});
