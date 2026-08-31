import { prView, realExec, type Exec } from './github';
import type { GuideStore } from './store';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function cleanupOnce(store: GuideStore, now: Date, exec: Exec = realExec): Promise<string[]> {
  const removed: string[] = [];
  for (const { owner, repo, number } of await store.list()) {
    let expired: boolean;
    try {
      const meta = await prView(owner, repo, number, exec);
      expired = meta.state === 'MERGED'
        && meta.mergedAt !== null
        && now.getTime() - new Date(meta.mergedAt).getTime() > THIRTY_DAYS_MS;
    } catch {
      expired = true; // PR ou repo introuvable → guide orphelin
    }
    if (expired) {
      await store.remove(owner, repo, number);
      removed.push(`${owner}/${repo}/${number}`);
    }
  }
  return removed;
}
