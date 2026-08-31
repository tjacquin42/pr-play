export type Layer = 'types' | 'server' | 'api' | 'ui' | 'tests' | 'other';
export type TestStatus = 'tested-in-pr' | 'tested-elsewhere' | 'untested' | 'is-test';
export type SymbolKind = 'function' | 'component' | 'class' | 'type' | 'variable' | 'file';

export interface Caller { file: string; line: number; symbol: string }
export interface TestRef { file: string; diff?: string }

export interface SymbolEntry {
  id: string;            // "chemin/fichier.ts#nomSymbole" (ou juste le chemin pour kind 'file')
  name: string;
  kind: SymbolKind;
  file: string;
  startLine: number;
  endLine: number;
  layer: Layer;
  order: number;         // position dans l'ordre de lecture global
  diff: string;          // hunks du diff limités à ce symbole
  summary: string;       // ex. « 5 lignes modifiées »
  testStatus: TestStatus;
  testRef?: TestRef;
  callers: Caller[];     // références hors des fichiers touchés par la PR
}

export interface Chapter { title: string; intent: string; symbolIds: string[] }

export interface Guide {
  owner: string; repo: string; number: number;
  title: string; url: string;
  generatedAt: string;
  chaptersSource: 'llm' | 'fallback';
  chapters: Chapter[];
  symbols: SymbolEntry[];
  noise: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function validateGuide(value: unknown): value is Guide {
  if (!isRecord(value)) return false;
  const g = value;
  if (typeof g.owner !== 'string' || typeof g.repo !== 'string' || typeof g.number !== 'number') return false;
  if (typeof g.title !== 'string' || typeof g.url !== 'string' || typeof g.generatedAt !== 'string') return false;
  if (g.chaptersSource !== 'llm' && g.chaptersSource !== 'fallback') return false;
  if (!Array.isArray(g.chapters) || !g.chapters.every((c) => isRecord(c)
    && typeof c.title === 'string' && typeof c.intent === 'string'
    && Array.isArray(c.symbolIds) && c.symbolIds.every((s) => typeof s === 'string'))) return false;
  if (!Array.isArray(g.symbols) || !g.symbols.every((s) => isRecord(s)
    && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.file === 'string'
    && typeof s.startLine === 'number' && typeof s.endLine === 'number'
    && typeof s.order === 'number' && typeof s.diff === 'string'
    && Array.isArray(s.callers))) return false;
  if (!Array.isArray(g.noise) || !g.noise.every((n) => typeof n === 'string')) return false;
  return true;
}
