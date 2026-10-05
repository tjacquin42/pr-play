import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type Exec = (cmd: string, args: string[]) => Promise<string>;

export const realExec: Exec = async (cmd, args) => {
  const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 16 * 1024 * 1024 });
  return stdout;
};

export interface PrMeta {
  title: string;
  url: string;
  headRefName: string;
  state: string;
  mergedAt: string | null;
}

export async function prView(owner: string, repo: string, number: number, exec: Exec = realExec): Promise<PrMeta> {
  const out = await exec('gh', [
    'pr', 'view', String(number), '-R', `${owner}/${repo}`,
    '--json', 'title,url,headRefName,state,mergedAt',
  ]);
  return JSON.parse(out) as PrMeta;
}

export async function prDiff(owner: string, repo: string, number: number, exec: Exec = realExec): Promise<string> {
  return exec('gh', ['pr', 'diff', String(number), '-R', `${owner}/${repo}`]);
}

/**
 * Prépare l'arbre de travail d'une PR dans `dest`.
 *
 * On ne clone jamais par nom de branche : la branche d'une PR mergée est
 * souvent supprimée, et celle d'une PR venant d'un fork n'existe pas dans ce
 * dépôt. La référence `refs/pull/<n>/head`, elle, est conservée par GitHub
 * dans les deux cas.
 */
export async function clonePrHead(owner: string, repo: string, number: number, dest: string, exec: Exec = realExec): Promise<void> {
  await exec('gh', ['repo', 'clone', `${owner}/${repo}`, dest, '--', '--depth', '1']);
  await exec('git', ['-C', dest, 'fetch', '--depth', '1', 'origin', `pull/${number}/head`]);
  await exec('git', ['-C', dest, 'checkout', '--detach', 'FETCH_HEAD']);
}
