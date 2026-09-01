import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, makeClaudeRunner, type ClaudeRunner, type Guide } from '@pr-play/engine';
import { clonePrHead, prDiff, prView, realExec, type Exec } from './github';

export interface AnalyzeDeps {
  exec?: Exec;
  runClaude?: ClaudeRunner;
}

export async function analyzePr(owner: string, repo: string, number: number, deps: AnalyzeDeps = {}): Promise<Guide> {
  const exec = deps.exec ?? realExec;
  const runClaude = deps.runClaude ?? makeClaudeRunner(`Daemon: pr-play ${repo}#${number}`);
  const meta = await prView(owner, repo, number, exec);
  const diff = await prDiff(owner, repo, number, exec);
  const dir = await mkdtemp(join(tmpdir(), 'pr-play-clone-'));
  try {
    await clonePrHead(owner, repo, number, dir, exec);
    return await analyze({
      repoDir: dir,
      diff,
      owner,
      repo,
      number,
      title: meta.title,
      url: meta.url,
      generatedAt: new Date().toISOString(),
      runClaude,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
