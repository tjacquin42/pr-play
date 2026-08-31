import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateGuide, type Guide } from '@pr-guide/engine';

export class GuideStore {
  constructor(private readonly dir: string) {}

  private fileFor(owner: string, repo: string, number: number): string {
    return join(this.dir, `${owner}--${repo}--${number}.json`);
  }

  async save(guide: Guide): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.fileFor(guide.owner, guide.repo, guide.number), JSON.stringify(guide, null, 2), 'utf8');
  }

  async load(owner: string, repo: string, number: number): Promise<Guide | undefined> {
    try {
      const raw: unknown = JSON.parse(await readFile(this.fileFor(owner, repo, number), 'utf8'));
      return validateGuide(raw) ? raw : undefined;
    } catch {
      return undefined;
    }
  }

  async list(): Promise<{ owner: string; repo: string; number: number }[]> {
    let names: string[];
    try { names = await readdir(this.dir); } catch { return []; }
    const out: { owner: string; repo: string; number: number }[] = [];
    for (const n of names) {
      const m = n.match(/^(.+)--(.+)--(\d+)\.json$/);
      if (m) out.push({ owner: m[1]!, repo: m[2]!, number: Number(m[3]!) });
    }
    return out;
  }

  async remove(owner: string, repo: string, number: number): Promise<void> {
    await rm(this.fileFor(owner, repo, number), { force: true });
  }
}
