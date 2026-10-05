import { buildChapters, type ClaudeRunner } from './chapters';
import { parseUnifiedDiff, sliceDiff, type ChangedFile } from './diff';
import { splitNoise } from './noise';
import { classifyLayer, readingOrder } from './ordering';
import { extractSymbols, openProject, type RawSymbol } from './symbols';
import { testStatusFor } from './tests-match';
import { findCallers } from './callers';
import type { Guide, SymbolEntry } from './types';

export interface AnalyzeInput {
  repoDir: string; diff: string;
  owner: string; repo: string; number: number;
  title: string; url: string; generatedAt: string;
  runClaude?: ClaudeRunner;
}

function toEntry(raw: RawSymbol, file: ChangedFile): Omit<SymbolEntry, 'order' | 'testStatus' | 'testRef' | 'callers'> {
  const lines = file.changedLines.filter((l) => l >= raw.startLine && l <= raw.endLine).length;
  return {
    id: raw.kind === 'file' ? raw.file : `${raw.file}#${raw.name}`,
    name: raw.name, kind: raw.kind, file: raw.file,
    startLine: raw.startLine, endLine: raw.endLine,
    layer: classifyLayer(raw.file),
    diff: raw.kind === 'file' ? file.diffText : sliceDiff(file, raw.startLine, raw.endLine),
    summary: `${Math.max(lines, 1)} ligne${lines > 1 ? 's' : ''} modifiée${lines > 1 ? 's' : ''}`,
  };
}

export async function analyze(input: AnalyzeInput): Promise<Guide> {
  const files = parseUnifiedDiff(input.diff);
  const { kept, noise } = splitNoise(files);
  const project = openProject(input.repoDir);
  const changedPaths = new Set(kept.map((f) => f.path));

  const entries: SymbolEntry[] = [];
  for (const file of kept) {
    for (const raw of extractSymbols(project, input.repoDir, file)) {
      const base = toEntry(raw, file);
      const test = testStatusFor(raw, kept, project, input.repoDir);
      const callers = findCallers(raw, changedPaths, input.repoDir);
      entries.push({ ...base, order: 0, testStatus: test.status, testRef: test.ref, callers });
    }
  }

  const order = readingOrder(entries.map((e) => ({ file: e.file, callersCount: e.callers.length })));
  order.forEach((entryIndex, position) => { entries[entryIndex]!.order = position; });
  entries.sort((a, b) => a.order - b.order);

  const { chapters, source } = await buildChapters(entries, input.runClaude);

  return {
    owner: input.owner, repo: input.repo, number: input.number,
    title: input.title, url: input.url, generatedAt: input.generatedAt,
    chaptersSource: source, chapters, symbols: entries, noise,
  };
}
