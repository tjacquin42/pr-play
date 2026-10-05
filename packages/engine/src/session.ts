import { readdir, rm, rmdir, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CLAUDE_DIR = join(homedir(), '.claude');

/**
 * Les trois drapeaux qui rendent un run sans terminal identifiable puis
 * effaçable : `--session-id` parce qu'il faut connaître le transcript pour
 * pouvoir le supprimer, `--name` parce que sans lui la session s'affiche sous
 * la première ligne du prompt et se confond avec une conversation humaine.
 */
export function claudeArgs(prompt: string, sessionId: string, name: string): string[] {
  return ['-p', prompt, '--session-id', sessionId, '--name', name];
}

/**
 * Efface les traces d'un run terminé : le transcript et son dossier
 * d'environnement. Le dossier de projet dérive du répertoire courant du
 * processus — pour le démon, celui de launchd, soit `/` — donc on balaie tous
 * les projets plutôt que de tenter de reconstituer ce nom.
 */
export async function discardSession(sessionId: string, claudeDir: string = CLAUDE_DIR): Promise<void> {
  const projects = join(claudeDir, 'projects');
  let slugs: string[];
  try {
    slugs = await readdir(projects);
  } catch {
    return;
  }
  await Promise.all(slugs.map(async (slug) => {
    const dir = join(projects, slug);
    const removed = await unlink(join(dir, `${sessionId}.jsonl`)).then(() => true, () => false);
    // Le démon travaille depuis `/`, donc sous un dossier de projet à lui seul,
    // qui n'aurait plus de raison d'être une fois vidé. On ne s'en prend qu'au
    // dossier dont on vient de retirer le transcript, et `rmdir` refuse un
    // dossier peuplé : rien de ce qui sert encore ne disparaît.
    if (removed) await rmdir(dir).catch(() => undefined);
  }));
  await rm(join(claudeDir, 'session-env', sessionId), { recursive: true, force: true });
}
