import { describe, expect, it } from 'vitest';
import { fixtureDiff, fixtureRepoDir } from './fixture';
import { parseUnifiedDiff } from './diff';
import { splitNoise } from './noise';
import { extractSymbols, openProject } from './symbols';
import { isTestFile, testStatusFor } from './tests-match';

describe('testStatusFor', () => {
  const repoDir = fixtureRepoDir();
  const project = openProject(repoDir);
  const { kept } = splitNoise(parseUnifiedDiff(fixtureDiff()));
  const invoices = kept.find((f) => f.path === 'src/server/invoices.ts')!;
  const syms = extractSymbols(project, repoDir, invoices);

  it('détecte un fichier de test', () => {
    expect(isTestFile('src/server/invoices.test.ts')).toBe(true);
    expect(isTestFile('src/server/invoices.ts')).toBe(false);
  });

  it('createInvoice est testée dans la PR, avec le diff du test', () => {
    const create = syms.find((s) => s.name === 'createInvoice')!;
    const r = testStatusFor(create, kept, project, repoDir);
    expect(r.status).toBe('tested-in-pr');
    expect(r.ref?.file).toBe('src/server/invoices.test.ts');
    expect(r.ref?.diff).toContain('createInvoice');
  });

  it('validateSiret n’est pas testée', () => {
    const v = syms.find((s) => s.name === 'validateSiret')!;
    expect(testStatusFor(v, kept, project, repoDir).status).toBe('untested');
  });
});

describe('portion de test affichée en vis-à-vis', () => {
  const repoDir = fixtureRepoDir();
  const project = openProject(repoDir);
  const { kept } = splitNoise(parseUnifiedDiff(fixtureDiff()));
  const invoices = kept.find((f) => f.path === 'src/server/invoices.ts')!;
  const syms = extractSymbols(project, repoDir, invoices);

  it('ne garde du fichier de test que les hunks citant le symbole', () => {
    const create = syms.find((s) => s.name === 'createInvoice')!;
    const testFile = kept.find((f) => f.path === 'src/server/invoices.test.ts')!;
    const ref = testStatusFor(create, kept, project, repoDir).ref!;
    expect(ref.diff).toContain('createInvoice');
    // Plus court que le diff entier du fichier : l'en-tête `diff --git` a sauté.
    expect(ref.diff!.length).toBeLessThan(testFile.diffText.length);
    expect(ref.diff).not.toContain('diff --git');
  });
});
