import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import type { ChangedFile } from './diff';
import { fixtureDiff, fixtureRepoDir } from './fixture';
import { parseUnifiedDiff } from './diff';
import { splitNoise } from './noise';
import { extractSymbols, openProject } from './symbols';

function changedFile(path: string, changedLines: number[]): ChangedFile {
  return { path, isNew: false, isDeleted: false, isRenameOnly: false, changedLines, diffText: '' };
}

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

  it('retombe au niveau fichier quand le chemin .ts n’est pas dans le projet', () => {
    const file = changedFile('src/server/absent.ts', [1]);
    const syms = extractSymbols(project, fixtureRepoDir(), file);
    expect(syms).toEqual([{ name: 'absent.ts', kind: 'file', file: 'src/server/absent.ts', startLine: 1, endLine: 1 }]);
  });

  it('reconnaît une interface exportée (shared/types.ts)', () => {
    const file = changedFile('src/shared/types.ts', [1]);
    const syms = extractSymbols(project, fixtureRepoDir(), file);
    expect(syms.map((s) => s.name)).toEqual(['Invoice']);
    expect(syms[0]!.kind).toBe('type');
  });

  it('ajoute une entrée fichier en plus quand une ligne changée sort de toute déclaration', () => {
    // Ligne 1 = import (aucune déclaration nommée) : orpheline. Ligne 3 = validateSiret.
    const file = changedFile('src/server/invoices.ts', [1, 3]);
    const syms = extractSymbols(project, fixtureRepoDir(), file);
    expect(syms.map((s) => s.name)).toContain('validateSiret');
    expect(syms.some((s) => s.kind === 'file')).toBe(true);
  });

  it('ouvre un projet sans tsconfig si le dépôt n’en a pas', () => {
    const sansConfig = openProject('/chemin-inexistant-pour-pr-play-tests');
    expect(sansConfig.getSourceFiles()).toHaveLength(0);
  });

  describe('déclarations nommées (projet en mémoire)', () => {
    function extractFrom(path: string, source: string, line = 1): ReturnType<typeof extractSymbols> {
      const mini = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: false } });
      mini.createSourceFile(`/virtuel/${path}`, source);
      return extractSymbols(mini, '/virtuel', changedFile(path, [line]));
    }

    it('reconnaît une classe exportée', () => {
      const syms = extractFrom('widget.ts', 'export class Widget {\n  render(): void {}\n}\n');
      expect(syms).toHaveLength(1);
      expect(syms[0]).toMatchObject({ name: 'Widget', kind: 'class' });
    });

    it('reconnaît un enum exporté', () => {
      const syms = extractFrom('colors.ts', 'export enum Color { Red, Green }\n');
      expect(syms).toHaveLength(1);
      expect(syms[0]).toMatchObject({ name: 'Color', kind: 'type' });
    });

    it('classe une variable simple comme "variable"', () => {
      const syms = extractFrom('vars.ts', 'export const total = 42;\n');
      expect(syms).toHaveLength(1);
      expect(syms[0]).toMatchObject({ name: 'total', kind: 'variable' });
    });

    it('classe une variable initialisée par une fonction fléchée comme "function"', () => {
      const syms = extractFrom('fns.ts', 'export const run = () => 1;\n');
      expect(syms).toHaveLength(1);
      expect(syms[0]).toMatchObject({ name: 'run', kind: 'function' });
    });

    it('détecte un composant : fonction nommée en majuscule dans un .tsx', () => {
      const syms = extractFrom('Button.tsx', 'export function Button() {\n  return null;\n}\n');
      expect(syms).toHaveLength(1);
      expect(syms[0]).toMatchObject({ name: 'Button', kind: 'component' });
    });
  });
});
