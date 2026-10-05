import { relative } from 'node:path';
import type { Project } from 'ts-morph';
import { sliceDiffByMention, type ChangedFile } from './diff';
import type { RawSymbol } from './symbols';
import type { TestRef, TestStatus } from './types';

const TEST_FILE = /(\.(test|spec)\.tsx?$)|((^|\/)__tests__\/)/;

export function isTestFile(path: string): boolean {
  return TEST_FILE.test(path);
}

function mentions(content: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(content);
}

export function testStatusFor(
  symbol: RawSymbol,
  changedFiles: ChangedFile[],
  project: Project,
  repoDir: string,
): { status: TestStatus; ref?: TestRef } {
  // Un symbole défini dans un fichier de test EST un test : l'apparier
  // reviendrait à l'afficher en vis-à-vis de lui-même.
  if (isTestFile(symbol.file)) return { status: 'is-test' };

  // 1. Un fichier de test de la PR mentionne le symbole ?
  for (const f of changedFiles) {
    if (isTestFile(f.path) && mentions(f.diffText, symbol.name)) {
      const portion = sliceDiffByMention(f, symbol.name);
      return { status: 'tested-in-pr', ref: { file: f.path, diff: portion || f.diffText } };
    }
  }
  // 2. Un fichier de test du repo (hors PR) le mentionne ?
  for (const sf of project.getSourceFiles()) {
    const rel = relative(repoDir, sf.getFilePath());
    if (!isTestFile(rel)) continue;
    if (mentions(sf.getFullText(), symbol.name)) {
      return { status: 'tested-elsewhere', ref: { file: rel } };
    }
  }
  return { status: 'untested' };
}
