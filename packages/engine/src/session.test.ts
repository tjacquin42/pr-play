import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { claudeArgs, discardSession } from './session';

async function claudeHome(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pr-play-claude-'));
  await mkdir(join(dir, 'projects', '-'), { recursive: true });
  await mkdir(join(dir, 'projects', '-Users-jack-DEV'), { recursive: true });
  await mkdir(join(dir, 'session-env'), { recursive: true });
  return dir;
}

describe('claudeArgs', () => {
  it('impose l’identifiant et le nom de la session', () => {
    const args = claudeArgs('prompt', 'the-uuid', 'Daemon: pr-play cordialo#29');
    expect(args).toEqual([
      '-p', 'prompt',
      '--session-id', 'the-uuid',
      '--name', 'Daemon: pr-play cordialo#29',
    ]);
  });
});

describe('discardSession', () => {
  it('supprime le transcript quel que soit le dossier de projet', async () => {
    const home = await claudeHome();
    await writeFile(join(home, 'projects', '-', 'the-uuid.jsonl'), '{}');
    await mkdir(join(home, 'session-env', 'the-uuid'));

    await discardSession('the-uuid', home);

    expect(await readdir(join(home, 'projects'))).toEqual(['-Users-jack-DEV']);
    expect(await readdir(join(home, 'session-env'))).toEqual([]);
  });

  it('ne touche pas aux sessions des autres', async () => {
    const home = await claudeHome();
    await writeFile(join(home, 'projects', '-Users-jack-DEV', 'autre.jsonl'), '{}');
    await mkdir(join(home, 'session-env', 'autre'));

    await discardSession('the-uuid', home);

    expect(await readdir(join(home, 'projects', '-Users-jack-DEV'))).toEqual(['autre.jsonl']);
    expect(await readdir(join(home, 'session-env'))).toEqual(['autre']);
  });

  it('emporte le dossier de projet devenu vide, mais pas celui qui sert encore', async () => {
    const home = await claudeHome();
    await writeFile(join(home, 'projects', '-', 'the-uuid.jsonl'), '{}');
    await writeFile(join(home, 'projects', '-Users-jack-DEV', 'the-uuid.jsonl'), '{}');
    await writeFile(join(home, 'projects', '-Users-jack-DEV', 'autre.jsonl'), '{}');

    await discardSession('the-uuid', home);

    expect(await readdir(join(home, 'projects'))).toEqual(['-Users-jack-DEV']);
  });

  it('reste muet quand il n’y a rien à supprimer', async () => {
    const home = await claudeHome();
    await expect(discardSession('the-uuid', home)).resolves.toBeUndefined();
  });
});
