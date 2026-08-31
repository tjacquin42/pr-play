import { describe, expect, it } from 'vitest';
import { fixtureDiff, fixtureRepoDir } from './fixture';
import { analyze } from './analyze';

describe('analyze (bout en bout sur la fixture)', () => {
  it('produit un guide complet et cohérent', async () => {
    const guide = await analyze({
      repoDir: fixtureRepoDir(), diff: fixtureDiff(),
      owner: 'tjacquin42', repo: 'mini', number: 7,
      title: 'SIRET obligatoire', url: 'https://github.com/tjacquin42/mini/pull/7',
      generatedAt: '2026-08-31T00:00:00Z',
      runClaude: async () => { throw new Error('pas de LLM en test'); },
    });

    expect(guide.noise).toEqual(['pnpm-lock.yaml']);
    expect(guide.chaptersSource).toBe('fallback');

    const names = guide.symbols.map((s) => s.name);
    expect(names).toContain('createInvoice');
    expect(names).toContain('validateSiret');
    expect(names).toContain('testCreateInvoice');

    const create = guide.symbols.find((s) => s.name === 'createInvoice')!;
    expect(create.testStatus).toBe('tested-in-pr');
    expect(create.callers.map((c) => c.symbol)).toEqual(['monthlyReport']);
    expect(create.diff).toContain('createInvoice');

    const v = guide.symbols.find((s) => s.name === 'validateSiret')!;
    expect(v.testStatus).toBe('untested');

    // Ordre : createInvoice (1 appelant) avant validateSiret (0), tests en dernier
    const ordered = [...guide.symbols].sort((a, b) => a.order - b.order).map((s) => s.name);
    expect(ordered.indexOf('createInvoice')).toBeLessThan(ordered.indexOf('validateSiret'));
    expect(ordered[ordered.length - 1]).toBe('testCreateInvoice');

    // Chaque symbole est dans exactement un chapitre
    const assigned = guide.chapters.flatMap((c) => c.symbolIds).sort();
    expect(assigned).toEqual(guide.symbols.map((s) => s.id).sort());
  });
});
