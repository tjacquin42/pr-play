import { describe, expect, it } from 'vitest';
import { buildChapters } from './chapters';
import type { SymbolEntry } from './types';

function sym(id: string, file: string): SymbolEntry {
  return {
    id, name: id.split('#')[1] ?? id, kind: 'function', file,
    startLine: 1, endLine: 2, layer: 'server', order: 0,
    diff: '', summary: '', testStatus: 'untested', callers: [],
  };
}

const symbols = [
  sym('src/server/invoices.ts#createInvoice', 'src/server/invoices.ts'),
  sym('src/server/invoices.ts#validateSiret', 'src/server/invoices.ts'),
  sym('src/server/invoices.test.ts#testCreateInvoice', 'src/server/invoices.test.ts'),
];

describe('buildChapters', () => {
  it('utilise la réponse LLM quand elle est valide', async () => {
    const fake = async (): Promise<string> => JSON.stringify({
      chapters: [{
        title: 'Le SIRET devient obligatoire',
        intent: 'Valide le SIRET à la création de facture.',
        symbolIds: symbols.map((s) => s.id),
      }],
    });
    const r = await buildChapters(symbols, fake);
    expect(r.source).toBe('llm');
    expect(r.chapters[0]!.title).toBe('Le SIRET devient obligatoire');
  });

  it('replie si un symbole manque dans la réponse', async () => {
    const fake = async (): Promise<string> =>
      JSON.stringify({ chapters: [{ title: 'X', intent: '', symbolIds: [symbols[0]!.id] }] });
    const r = await buildChapters(symbols, fake);
    expect(r.source).toBe('fallback');
  });

  it('replie si la réponse n’est pas du JSON', async () => {
    const r = await buildChapters(symbols, async () => 'désolé, voici les chapitres…');
    expect(r.source).toBe('fallback');
  });

  it('replie par couche : serveur puis tests, en français', async () => {
    const r = await buildChapters(symbols, async () => { throw new Error('claude absent'); });
    expect(r.chapters.map((c) => c.title)).toEqual(['Logique serveur', 'Tests']);
  });
});
