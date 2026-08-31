import { describe, expect, it } from 'vitest';
import { tokenizeLine, type Token } from './highlight';

function kindOf(tokens: Token[], text: string): string | undefined {
  return tokens.find((t) => t.text === text)?.kind;
}

describe('tokenizeLine', () => {
  it('colore les commentaires de fin de ligne, y compris le code qui précède', () => {
    const { tokens } = tokenizeLine('const x = 1; // remise à zéro');
    expect(kindOf(tokens, 'const')).toBe('keyword');
    expect(tokens.at(-1)).toEqual({ text: '// remise à zéro', kind: 'comment' });
  });

  it('poursuit un commentaire de bloc sur les lignes suivantes', () => {
    const first = tokenizeLine('/* explication');
    expect(first.inBlockComment).toBe(true);
    expect(first.tokens[0]!.kind).toBe('comment');

    const middle = tokenizeLine('   sur plusieurs lignes', first.inBlockComment);
    expect(middle.tokens.every((t) => t.kind === 'comment')).toBe(true);
    expect(middle.inBlockComment).toBe(true);

    const last = tokenizeLine(' */ const apres = 2;', middle.inBlockComment);
    expect(last.inBlockComment).toBe(false);
    expect(kindOf(last.tokens, 'const')).toBe('keyword');
  });

  it('distingue mots-clés de flux, mots-clés, types, appels et propriétés', () => {
    const { tokens } = tokenizeLine('return validerSiret(compte.siret);');
    expect(kindOf(tokens, 'return')).toBe('control');
    expect(kindOf(tokens, 'validerSiret')).toBe('function');
    expect(kindOf(tokens, 'siret')).toBe('property');
    const decl = tokenizeLine('export interface Compte { id: string }').tokens;
    expect(kindOf(decl, 'export')).toBe('keyword');
    expect(kindOf(decl, 'Compte')).toBe('type');
    expect(kindOf(decl, 'string')).toBe('keyword');
  });

  it('gère chaînes, échappements et nombres', () => {
    const { tokens } = tokenizeLine(`const s = 'aujourd\\'hui'; const n = 42;`);
    expect(kindOf(tokens, `'aujourd\\'hui'`)).toBe('string');
    expect(kindOf(tokens, '42')).toBe('number');
  });

  it('ne colore pas un // situé à l’intérieur d’une chaîne', () => {
    const { tokens } = tokenizeLine(`const u = 'http://exemple.fr';`);
    expect(tokens.some((t) => t.kind === 'comment')).toBe(false);
    expect(kindOf(tokens, `'http://exemple.fr'`)).toBe('string');
  });

  it('restitue la ligne à l’identique une fois les jetons concaténés', () => {
    const line = `if (a.b === 'x') { return f(1); } // fin`;
    expect(tokenizeLine(line).tokens.map((t) => t.text).join('')).toBe(line);
  });
});
