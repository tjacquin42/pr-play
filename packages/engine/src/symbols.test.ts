import { describe, expect, it } from 'vitest';
import { fixtureDiff, fixtureRepoDir } from './fixture';
import { parseUnifiedDiff } from './diff';
import { splitNoise } from './noise';
import { extractSymbols, openProject } from './symbols';

describe('extractSymbols', () => {
  const project = openProject(fixtureRepoDir());
  const { kept } = splitNoise(parseUnifiedDiff(fixtureDiff()));

  it('trouve les deux fonctions modifiées de invoices.ts', () => {
    const file = kept.find((f) => f.path === 'src/server/invoices.ts')!;
    const syms = extractSymbols(project, fixtureRepoDir(), file);
    expect(syms.map((s) => s.name).sort()).toEqual(['createInvoice', 'validateSiret']);
    const create = syms.find((s) => s.name === 'createInvoice')!;
    expect(create.kind).toBe('function');
    expect(create.startLine).toBe(7);
    expect(create.endLine).toBe(12);
  });

  it('retombe au niveau fichier pour un fichier hors projet TS', () => {
    const fake = { path: 'README.md', isNew: false, isDeleted: false, isRenameOnly: false, changedLines: [1], diffText: '' };
    const syms = extractSymbols(project, fixtureRepoDir(), fake);
    expect(syms).toHaveLength(1);
    expect(syms[0]!.kind).toBe('file');
  });
});
