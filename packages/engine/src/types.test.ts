import { describe, expect, it } from 'vitest';
import { validateGuide } from './types';

const minimal = {
  owner: 'tjacquin42', repo: 'demo', number: 1,
  title: 'Une PR', url: 'https://github.com/tjacquin42/demo/pull/1',
  generatedAt: '2026-08-31T00:00:00Z',
  chaptersSource: 'fallback',
  chapters: [{ title: 'Logique serveur', intent: '', symbolIds: ['a'] }],
  symbols: [{
    id: 'a', name: 'f', kind: 'function', file: 'src/f.ts',
    startLine: 1, endLine: 3, layer: 'server', order: 0,
    diff: '', summary: '', testStatus: 'untested', callers: [],
  }],
  noise: ['pnpm-lock.yaml'],
};

describe('validateGuide', () => {
  it('accepte un guide minimal valide', () => {
    expect(validateGuide(minimal)).toBe(true);
  });
  it('refuse un guide sans chapitres', () => {
    expect(validateGuide({ ...minimal, chapters: undefined })).toBe(false);
  });
  it('refuse une valeur non-objet', () => {
    expect(validateGuide('nope')).toBe(false);
  });
});
