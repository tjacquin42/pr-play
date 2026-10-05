import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { classifyLayer, LAYER_ORDER } from './ordering';
import { claudeArgs, discardSession } from './session';
import type { Chapter, Layer, SymbolEntry } from './types';

const execFileAsync = promisify(execFile);

export type ClaudeRunner = (prompt: string) => Promise<string>;

/**
 * Un runner qui se présente sous `name` le temps de son passage, puis ne laisse
 * rien derrière lui. La session n'est effacée qu'en cas de succès : quand
 * l'appel échoue, `buildChapters` se replie en silence sur le découpage par
 * couches, et le transcript est alors la seule chose qui dise pourquoi.
 */
export function makeClaudeRunner(name: string): ClaudeRunner {
  return async (prompt) => {
    const sessionId = randomUUID();
    const { stdout } = await execFileAsync('claude', claudeArgs(prompt, sessionId, name), {
      maxBuffer: 4 * 1024 * 1024,
      timeout: 180_000,
    });
    await discardSession(sessionId);
    return stdout;
  };
}

export const runClaudeCli: ClaudeRunner = makeClaudeRunner('Daemon: pr-play');

const LAYER_TITLES: Record<Layer, string> = {
  types: 'Types et schémas', server: 'Logique serveur', api: 'API',
  ui: 'Interface', tests: 'Tests', other: 'Autres fichiers',
};

function fallbackChapters(symbols: SymbolEntry[]): Chapter[] {
  const byLayer = new Map<Layer, string[]>();
  for (const s of symbols) {
    const layer = classifyLayer(s.file);
    byLayer.set(layer, [...(byLayer.get(layer) ?? []), s.id]);
  }
  return LAYER_ORDER.filter((l) => byLayer.has(l)).map((l) => ({
    title: LAYER_TITLES[l], intent: '', symbolIds: byLayer.get(l)!,
  }));
}

function buildPrompt(symbols: SymbolEntry[]): string {
  const list = symbols.map((s) => ({
    id: s.id, name: s.name, file: s.file, summary: s.summary,
    testStatus: s.testStatus, callersCount: s.callers.length,
  }));
  return [
    'Tu regroupes les symboles modifiés d’une pull request en chapitres de lecture.',
    'Réponds UNIQUEMENT avec un JSON de la forme :',
    '{"chapters":[{"title":"…","intent":"une à deux phrases : ce que ça fait et pourquoi","symbolIds":["…"]}]}',
    'Règles : titres et intentions en français ; chaque id apparaît dans exactement un chapitre ;',
    'n’invente aucun id ; 1 à 5 chapitres, ordonnés du plus central au plus périphérique.',
    'Symboles :',
    JSON.stringify(list),
  ].join('\n');
}

function parseLlmChapters(raw: string, symbols: SymbolEntry[]): Chapter[] | undefined {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  let parsed: unknown;
  try { parsed = JSON.parse(match[0]); } catch { return undefined; }
  if (typeof parsed !== 'object' || parsed === null || !('chapters' in parsed)) return undefined;
  const chapters = (parsed as { chapters: unknown }).chapters;
  if (!Array.isArray(chapters) || chapters.length === 0) return undefined;
  const out: Chapter[] = [];
  for (const c of chapters) {
    if (typeof c !== 'object' || c === null) return undefined;
    const { title, intent, symbolIds } = c as Record<string, unknown>;
    if (typeof title !== 'string' || typeof intent !== 'string' || !Array.isArray(symbolIds)) return undefined;
    if (!symbolIds.every((s): s is string => typeof s === 'string')) return undefined;
    out.push({ title, intent, symbolIds });
  }
  const assigned = out.flatMap((c) => c.symbolIds);
  const expected = new Set(symbols.map((s) => s.id));
  if (assigned.length !== expected.size) return undefined;
  if (!assigned.every((id) => expected.has(id))) return undefined;
  if (new Set(assigned).size !== assigned.length) return undefined;
  return out;
}

export async function buildChapters(
  symbols: SymbolEntry[],
  runClaude: ClaudeRunner = runClaudeCli,
): Promise<{ chapters: Chapter[]; source: 'llm' | 'fallback' }> {
  try {
    const raw = await runClaude(buildPrompt(symbols));
    const chapters = parseLlmChapters(raw, symbols);
    if (chapters) return { chapters, source: 'llm' };
  } catch {
    // CLI absent, timeout… → repli
  }
  return { chapters: fallbackChapters(symbols), source: 'fallback' };
}
