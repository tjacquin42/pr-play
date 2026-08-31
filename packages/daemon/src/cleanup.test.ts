import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { Guide } from '@pr-play/engine';
import { GuideStore } from './store';
import { cleanupOnce } from './cleanup';

const dir = mkdtempSync(join(tmpdir(), 'pr-play-clean-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function g(number: number): Guide {
  return { owner: 'o', repo: 'r', number, title: 't', url: 'u', generatedAt: 'x',
    chaptersSource: 'fallback', chapters: [], symbols: [], noise: [] };
}

describe('cleanupOnce', () => {
  it('supprime les guides mergés depuis plus de 30 jours, garde les autres', async () => {
    const store = new GuideStore(dir);
    await store.save(g(1)); // mergée il y a 40 jours → supprimée
    await store.save(g(2)); // mergée il y a 5 jours → gardée
    await store.save(g(3)); // ouverte → gardée

    const exec = async (_cmd: string, args: string[]): Promise<string> => {
      const number = Number(args[2]);
      if (number === 1) return JSON.stringify({ title: '', url: '', headRefName: '', state: 'MERGED', mergedAt: '2026-07-22T00:00:00Z' });
      if (number === 2) return JSON.stringify({ title: '', url: '', headRefName: '', state: 'MERGED', mergedAt: '2026-08-26T00:00:00Z' });
      return JSON.stringify({ title: '', url: '', headRefName: '', state: 'OPEN', mergedAt: null });
    };

    const removed = await cleanupOnce(store, new Date('2026-08-31T00:00:00Z'), exec);
    expect(removed).toEqual(['o/r/1']);
    expect(await store.load('o', 'r', 1)).toBeUndefined();
    expect(await store.load('o', 'r', 2)).toBeDefined();
    expect(await store.load('o', 'r', 3)).toBeDefined();
  });
});
