export type TokenKind =
  | 'comment' | 'string' | 'keyword' | 'control' | 'number'
  | 'type' | 'function' | 'property' | 'operator' | 'plain';

export interface Token { text: string; kind: TokenKind }

/** Mots-clés de flux : violet dans le thème Dark+ de VS Code. */
const CONTROL = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
  'continue', 'return', 'throw', 'try', 'catch', 'finally', 'await', 'yield',
]);

/** Autres mots-clés : bleu. */
const KEYWORD = new Set([
  'const', 'let', 'var', 'function', 'class', 'extends', 'implements', 'interface',
  'type', 'enum', 'import', 'from', 'export', 'as', 'new', 'delete', 'typeof',
  'instanceof', 'in', 'of', 'this', 'super', 'async', 'static', 'public', 'private',
  'protected', 'readonly', 'abstract', 'declare', 'namespace', 'void', 'null',
  'undefined', 'true', 'false', 'string', 'number', 'boolean', 'any', 'unknown',
  'never', 'satisfies', 'keyof', 'infer', 'is',
]);

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;

function identKind(word: string, rest: string): TokenKind {
  if (CONTROL.has(word)) return 'control';
  if (KEYWORD.has(word)) return 'keyword';
  if (/^\s*\(/.test(rest)) return 'function';
  if (/^[A-Z]/.test(word)) return 'type';
  return 'property';
}

function push(tokens: Token[], text: string, kind: TokenKind): void {
  const last = tokens[tokens.length - 1];
  if (last && last.kind === kind) last.text += text;
  else tokens.push({ text, kind });
}

/**
 * Découpe une ligne de TypeScript en jetons colorables.
 *
 * `inBlockComment` porte l'état d'un `/* … *\/` ouvert sur une ligne
 * précédente : le rendu d'un diff enchaîne les lignes en repassant la valeur
 * renvoyée, sinon un commentaire multiligne perdrait sa couleur dès la 2e ligne.
 */
export function tokenizeLine(line: string, inBlockComment = false): { tokens: Token[]; inBlockComment: boolean } {
  const tokens: Token[] = [];
  let block = inBlockComment;
  let i = 0;

  while (i < line.length) {
    const rest = line.slice(i);

    if (block) {
      const end = rest.indexOf('*/');
      if (end === -1) { push(tokens, rest, 'comment'); i = line.length; break; }
      push(tokens, rest.slice(0, end + 2), 'comment');
      i += end + 2;
      block = false;
      continue;
    }

    if (rest.startsWith('//')) { push(tokens, rest, 'comment'); break; }

    if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/', 2);
      if (end === -1) { push(tokens, rest, 'comment'); block = true; break; }
      push(tokens, rest.slice(0, end + 2), 'comment');
      i += end + 2;
      continue;
    }

    const quote = rest[0];
    if (quote === '"' || quote === "'" || quote === '`') {
      let j = 1;
      while (j < rest.length) {
        if (rest[j] === '\\') { j += 2; continue; }
        if (rest[j] === quote) { j += 1; break; }
        j += 1;
      }
      push(tokens, rest.slice(0, j), 'string');
      i += j;
      continue;
    }

    const char = rest[0]!;
    if (/[0-9]/.test(char)) {
      const m = /^[0-9][0-9_.xXa-fA-F]*n?/.exec(rest);
      const text = m ? m[0] : char;
      push(tokens, text, 'number');
      i += text.length;
      continue;
    }

    if (IDENT_START.test(char)) {
      let j = 1;
      while (j < rest.length && IDENT_PART.test(rest[j]!)) j += 1;
      const word = rest.slice(0, j);
      push(tokens, word, identKind(word, rest.slice(j)));
      i += j;
      continue;
    }

    push(tokens, char, /[{}()[\];,.:?=<>!&|+\-*/%]/.test(char) ? 'operator' : 'plain');
    i += 1;
  }

  return { tokens, inBlockComment: block };
}
