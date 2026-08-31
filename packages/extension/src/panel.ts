import type { Guide, SymbolEntry } from '@pr-play/engine/types';
import { tokenizeLine } from './highlight';

const BADGE_LABELS: Record<SymbolEntry['testStatus'], string> = {
  'tested-in-pr': 'Testé dans la PR',
  'tested-elsewhere': 'Testé (test existant)',
  untested: 'Non testé',
};

function el(doc: Document, tag: string, className: string, text?: string): HTMLElement {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderDiff(doc: Document, diff: string): HTMLElement {
  const pre = el(doc, 'pre', 'prg-diff');
  let inBlockComment = false;
  for (const line of diff.split('\n')) {
    const cls = line.startsWith('+') ? 'prg-line-add' : line.startsWith('-') ? 'prg-line-del' : 'prg-line-ctx';
    const row = el(doc, 'div', `prg-line ${cls}`);
    const marker = /^[+\- ]/.test(line) ? line.slice(0, 1) : '';
    const code = line.slice(marker.length);
    if (marker) row.appendChild(el(doc, 'span', 'prg-marker', marker));
    // L'état du commentaire de bloc traverse les lignes du hunk : sans lui, un
    // /* … */ perdrait sa couleur dès sa deuxième ligne.
    const { tokens, inBlockComment: next } = tokenizeLine(code, inBlockComment);
    inBlockComment = next;
    for (const token of tokens) row.appendChild(el(doc, 'span', `prg-t-${token.kind}`, token.text));
    pre.appendChild(row);
  }
  return pre;
}

function renderSymbol(doc: Document, s: SymbolEntry, prUrl: string): HTMLElement {
  const card = el(doc, 'article', 'prg-symbol');
  const header = el(doc, 'header', 'prg-symbol-header');
  header.appendChild(el(doc, 'strong', 'prg-symbol-name', s.name));
  header.appendChild(el(doc, 'span', 'prg-symbol-file', `${s.file}:${s.startLine}–${s.endLine}`));
  header.appendChild(el(doc, 'span', `prg-badge prg-badge-${s.testStatus}`, BADGE_LABELS[s.testStatus]));
  const link = el(doc, 'a', 'prg-pr-link', 'voir dans la PR') as HTMLAnchorElement;
  link.href = `${prUrl}/files`;
  // GitHub ancre chaque fichier du diff sur "diff-" + SHA-256 hex du chemin.
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    void crypto.subtle.digest('SHA-256', new TextEncoder().encode(s.file)).then((buf) => {
      const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      link.href = `${prUrl}/files#diff-${hex}`;
    });
  }
  header.appendChild(link);
  card.appendChild(header);

  const cols = el(doc, 'div', 'prg-columns');

  const code = el(doc, 'section', 'prg-code');
  const codeHead = el(doc, 'div', 'prg-col-head');
  codeHead.appendChild(el(doc, 'span', 'prg-col-title', 'Le code'));
  codeHead.appendChild(el(doc, 'span', 'prg-col-file', s.file));
  code.appendChild(codeHead);
  code.appendChild(renderDiff(doc, s.diff));
  cols.appendChild(code);

  const test = el(doc, 'section', 'prg-test');
  const testHead = el(doc, 'div', 'prg-col-head');
  testHead.appendChild(el(doc, 'span', 'prg-col-title', 'Son test'));
  testHead.appendChild(el(doc, 'span', 'prg-col-file', s.testRef?.file ?? 'aucun'));
  test.appendChild(testHead);
  if (s.testRef?.diff) {
    test.appendChild(renderDiff(doc, s.testRef.diff));
  } else if (s.testRef) {
    // Test préexistant, hors du diff de la PR : on ne peut montrer que sa piste.
    test.appendChild(el(doc, 'div', 'prg-test-note', 'Test déjà en place, non modifié par cette PR.'));
  } else {
    test.appendChild(el(doc, 'div', 'prg-test-missing', 'Aucun test ne mentionne ce symbole.'));
  }
  cols.appendChild(test);
  card.appendChild(cols);

  if (s.callers.length > 0) {
    const box = el(doc, 'div', 'prg-callers', 'Impact — appelé par : ');
    box.appendChild(el(doc, 'span', 'prg-callers-list',
      s.callers.map((c) => `${c.symbol} (${c.file}:${c.line})`).join(', ')));
    card.appendChild(box);
  }
  return card;
}

export function renderGuide(guide: Guide, doc: Document): HTMLElement {
  const root = el(doc, 'div', 'prg-panel');
  const nav = el(doc, 'aside', 'prg-nav');
  const body = el(doc, 'main', 'prg-body');
  const byId = new Map(guide.symbols.map((s) => [s.id, s]));

  guide.chapters.forEach((chapter, i) => {
    const anchor = `prg-ch-${i}`;
    const navLink = el(doc, 'a', 'prg-nav-item', chapter.title) as HTMLAnchorElement;
    navLink.href = `#${anchor}`;
    nav.appendChild(navLink);

    const section = el(doc, 'section', 'prg-chapter');
    section.id = anchor;
    section.appendChild(el(doc, 'h2', 'prg-chapter-title', chapter.title));
    if (chapter.intent) section.appendChild(el(doc, 'p', 'prg-chapter-intent', chapter.intent));
    const symbols = chapter.symbolIds
      .map((id) => byId.get(id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined)
      .sort((a, b) => a.order - b.order);
    for (const s of symbols) section.appendChild(renderSymbol(doc, s, guide.url));
    body.appendChild(section);
  });

  if (guide.noise.length > 0) {
    const details = el(doc, 'details', 'prg-noise');
    details.appendChild(el(doc, 'summary', 'prg-noise-summary', `Bruit (${guide.noise.length} fichiers)`));
    for (const n of guide.noise) details.appendChild(el(doc, 'div', 'prg-noise-file', n));
    body.appendChild(details);
  }

  root.appendChild(nav);
  root.appendChild(body);
  return root;
}
