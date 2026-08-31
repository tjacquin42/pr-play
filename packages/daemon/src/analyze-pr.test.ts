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
    const commands: string[] = [];
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
        commands.push(args.join(' '));
        cpSync(FIXTURE, dest, { recursive: true });
        return '';
      }
      if (cmd === 'git') { commands.push(args.join(' ')); return ''; }
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

  it('récupère la PR par sa référence refs/pull/N/head, jamais par nom de branche', async () => {
    // Une PR mergée dont la branche a été supprimée (ou venant d'un fork) n'a
    // plus de branche à cloner : seule la référence de PR survit côté GitHub.
    const commands: string[] = [];
    const exec = async (cmd: string, args: string[]): Promise<string> => {
      if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'view') {
        return JSON.stringify({ title: 'Sunset', url: 'https://github.com/o/r/pull/23', headRefName: 'feat/supprimee', state: 'MERGED', mergedAt: '2026-08-30T00:00:00Z' });
      }
      if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'diff') {
        const { readFileSync } = await import('node:fs');
        return readFileSync(FIXTURE_DIFF, 'utf8');
      }
      if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'clone') {
        commands.push(['gh', ...args].join(' '));
        if (args.includes('--branch')) throw new Error('fatal: Remote branch feat/supprimee not found in upstream origin');
        cpSync(FIXTURE, args[3]!, { recursive: true });
        return '';
      }
      if (cmd === 'git') { commands.push(['git', ...args].join(' ')); return ''; }
      throw new Error(`exec inattendu : ${cmd} ${args.join(' ')}`);
    };

    const guide = await analyzePr('o', 'r', 23, {
      exec,
      runClaude: async () => { throw new Error('pas de LLM'); },
    });

    expect(guide.title).toBe('Sunset');
    expect(commands.some((c) => c.includes('--branch'))).toBe(false);
    expect(commands.some((c) => c.includes('fetch') && c.includes('pull/23/head'))).toBe(true);
    expect(commands.some((c) => c.includes('checkout') && c.includes('FETCH_HEAD'))).toBe(true);
  });
});
