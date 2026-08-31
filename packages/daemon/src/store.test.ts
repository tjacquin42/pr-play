import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Guide } from '@pr-play/engine';
import { GuideStore } from './store';

const dir = mkdtempSync(join(tmpdir(), 'pr-play-store-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const guide: Guide = {
  owner: 'tjacquin42', repo: 'demo', number: 3,
  title: 't', url: 'u', generatedAt: '2026-08-31T00:00:00Z',
  chaptersSource: 'fallback', chapters: [], symbols: [], noise: [],
};

describe('GuideStore', () => {
  it('save puis load rendent le même guide', async () => {
    const store = new GuideStore(dir);
    await store.save(guide);
    expect(await store.load('tjacquin42', 'demo', 3)).toEqual(guide);
  });
  it('list et remove', async () => {
    const store = new GuideStore(dir);
    expect(await store.list()).toEqual([{ owner: 'tjacquin42', repo: 'demo', number: 3 }]);
    await store.remove('tjacquin42', 'demo', 3);
    expect(await store.load('tjacquin42', 'demo', 3)).toBeUndefined();
  });
});
