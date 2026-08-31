import parseDiff from 'parse-diff';

export interface ChangedFile {
  path: string;
  isNew: boolean;
  isDeleted: boolean;
  isRenameOnly: boolean;
  changedLines: number[];
  diffText: string;
}

interface RawChunk { newStart: number; lines: string[]; changedLines: number[] }

const chunkCache = new WeakMap<ChangedFile, RawChunk[]>();

export function parseUnifiedDiff(diff: string): ChangedFile[] {
  // Découpe le texte brut par fichier pour conserver diffText tel quel.
  const rawParts = diff.split(/^(?=diff --git )/m).filter((p) => p.startsWith('diff --git '));
  const parsed = parseDiff(diff);
  return parsed.map((f, i) => {
    const path = f.to && f.to !== '/dev/null' ? f.to : (f.from ?? 'inconnu');
    const chunks: RawChunk[] = f.chunks.map((c) => {
      const changed: number[] = [];
      let hasAdd = false;
      for (const ch of c.changes) {
        if (ch.type === 'add') { changed.push(ch.ln); hasAdd = true; }
      }
      if (!hasAdd && c.changes.some((ch) => ch.type === 'del')) changed.push(c.newStart);
      return { newStart: c.newStart, lines: c.changes.map((ch) => ch.content), changedLines: changed };
    });
    const file: ChangedFile = {
      path,
      isNew: f.from === '/dev/null',
      isDeleted: f.to === '/dev/null',
      isRenameOnly: f.chunks.length === 0 && f.from !== f.to && f.from !== '/dev/null' && f.to !== '/dev/null',
      changedLines: chunks.flatMap((c) => c.changedLines),
      diffText: rawParts[i] ?? '',
    };
    chunkCache.set(file, chunks);
    return file;
  });
}

export function sliceDiff(file: ChangedFile, startLine: number, endLine: number): string {
  const chunks = chunkCache.get(file) ?? [];
  const kept = chunks.filter((c) => c.changedLines.some((l) => l >= startLine && l <= endLine));
  return kept.map((c) => c.lines.join('\n')).join('\n');
}

/**
 * Ne garde du diff que les hunks qui citent `name`.
 *
 * Sert à n'afficher, en vis-à-vis d'un symbole, que la portion du fichier de
 * test qui le concerne — et non le diff entier du fichier, répété à
 * l'identique pour chaque symbole que ce fichier couvre.
 */
export function sliceDiffByMention(file: ChangedFile, name: string): string {
  const chunks = chunkCache.get(file) ?? [];
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mention = new RegExp(`\\b${escaped}\\b`);
  const kept = chunks.filter((c) => c.lines.some((l) => mention.test(l)));
  return kept.map((c) => c.lines.join('\n')).join('\n');
}
