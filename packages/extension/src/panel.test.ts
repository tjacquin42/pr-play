import { describe, expect, it } from 'vitest';
import type { Guide } from '@pr-guide/engine/types';
import { renderGuide } from './panel';

const guide: Guide = {
  owner: 'o', repo: 'r', number: 7, title: 'SIRET obligatoire',
  url: 'https://github.com/o/r/pull/7', generatedAt: 'x', chaptersSource: 'llm',
  chapters: [{ title: 'Le SIRET devient obligatoire', intent: 'Valider le SIRET.', symbolIds: ['src/server/invoices.ts#createInvoice'] }],
  symbols: [{
    id: 'src/server/invoices.ts#createInvoice', name: 'createInvoice', kind: 'function',
    file: 'src/server/invoices.ts', startLine: 7, endLine: 12, layer: 'server', order: 0,
    diff: '+  if (!validateSiret(siret)) {\n-  return { id, amount };',
    summary: '5 lignes modifiées', testStatus: 'tested-in-pr',
    testRef: { file: 'src/server/invoices.test.ts', diff: '+  createInvoice(\'f-1\', 100, \'12345678901234\')' },
    callers: [{ file: 'src/server/report.ts', line: 4, symbol: 'monthlyReport' }],
  }],
  noise: ['pnpm-lock.yaml'],
};

describe('renderGuide', () => {
  const root = renderGuide(guide, document);

  it('affiche le sommaire des chapitres', () => {
    expect(root.querySelector('.prg-nav')!.textContent).toContain('Le SIRET devient obligatoire');
  });
  it('affiche la carte symbole avec badge testé et diff coloré', () => {
    const card = root.querySelector('.prg-symbol')!;
    expect(card.textContent).toContain('createInvoice');
    expect(card.querySelector('.prg-badge-tested-in-pr')).not.toBeNull();
    expect(card.querySelectorAll('.prg-line-add').length).toBeGreaterThan(0);
    expect(card.querySelectorAll('.prg-line-del').length).toBeGreaterThan(0);
  });
  it('affiche le test en vis-à-vis et les appelants', () => {
    const card = root.querySelector('.prg-symbol')!;
    expect(card.querySelector('.prg-test')!.textContent).toContain('invoices.test.ts');
    expect(card.querySelector('.prg-callers')!.textContent).toContain('monthlyReport');
  });
  it('affiche « non testé » quand testRef est absent', () => {
    const untested: Guide = {
      ...guide,
      chapters: [{ title: 'X', intent: '', symbolIds: [guide.symbols[0]!.id] }],
      symbols: [{ ...guide.symbols[0]!, testStatus: 'untested', testRef: undefined }],
    };
    const r = renderGuide(untested, document);
    expect(r.querySelector('.prg-test')!.textContent).toContain('Non testé');
  });
  it('replie le bruit', () => {
    expect(root.querySelector('.prg-noise')!.textContent).toContain('pnpm-lock.yaml');
  });
});
