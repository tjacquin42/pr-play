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

export async function shallowClone(owner: string, repo: string, branch: string, dest: string, exec: Exec = realExec): Promise<void> {
  await exec('gh', ['repo', 'clone', `${owner}/${repo}`, dest, '--', '--depth', '1', '--branch', branch]);
}
