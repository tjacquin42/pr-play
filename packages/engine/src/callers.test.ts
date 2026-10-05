import { describe, expect, it } from 'vitest';
import { fixtureDiff, fixtureRepoDir } from './fixture';
import { parseUnifiedDiff } from './diff';
import { splitNoise } from './noise';
import { extractSymbols, openProject } from './symbols';
import { findCallers } from './callers';

describe('findCallers', () => {
  const repoDir = fixtureRepoDir();
  const project = openProject(repoDir);
  const { kept } = splitNoise(parseUnifiedDiff(fixtureDiff()));
  const changedPaths = new Set(kept.map((f) => f.path));
  const invoices = kept.find((f) => f.path === 'src/server/invoices.ts')!;
  const syms = extractSymbols(project, repoDir, invoices);

  it('createInvoice est appelée par monthlyReport (hors PR)', () => {
    const create = syms.find((s) => s.name === 'createInvoice')!;
    const callers = findCallers(create, changedPaths, repoDir);
    expect(callers).toHaveLength(1);
    expect(callers[0]!.file).toBe('src/server/report.ts');
    expect(callers[0]!.symbol).toBe('monthlyReport');
  });

  it('les références situées dans des fichiers de la PR sont exclues', () => {
    const v = syms.find((s) => s.name === 'validateSiret')!;
    expect(findCallers(v, changedPaths, repoDir)).toEqual([]);
  });
});
