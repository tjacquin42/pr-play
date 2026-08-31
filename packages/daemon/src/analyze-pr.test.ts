import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzePr } from './analyze-pr';

// La fixture engine sert de « repo cloné » : l'exec factice la copie vers dest.
const FIXTURE = join(import.meta.dirname, '..', '..', 'engine', 'fixtures', 'mini-repo');
const FIXTURE_DIFF = join(import.meta.dirname, '..', '..', 'engine', 'fixtures', 'pr.diff');

describe('analyzePr', () => {
  it('clone, analyse, supprime le clone', async () => {
    const cloneDests: string[] = [];
    const exec = async (cmd: string, args: string[]): Promise<string> => {
      if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
        return JSON.stringify({ title: 'SIRET', url: 'https://github.com/o/r/pull/7', headRefName: 'feat/siret', state: 'OPEN', mergedAt: null });
      }
      if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'diff') {
        const { readFileSync } = await import('node:fs');
        return readFileSync(FIXTURE_DIFF, 'utf8');
      }
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'clone') {
        const dest = args[3]!;
        cloneDests.push(dest);
        cpSync(FIXTURE, dest, { recursive: true });
        return '';
      }
      throw new Error(`exec inattendu : ${cmd} ${args.join(' ')}`);
    };

    const guide = await analyzePr('o', 'r', 7, {
      exec,
      runClaude: async () => { throw new Error('pas de LLM'); },
    });

    expect(guide.title).toBe('SIRET');
    expect(guide.symbols.map((s) => s.name)).toContain('createInvoice');
    expect(cloneDests).toHaveLength(1);
    expect(existsSync(cloneDests[0]!)).toBe(false); // le clone a été supprimé
  });
});
