import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Guide } from '@pr-play/engine/types';
import { daemonStatus, fetchGuide, requestAnalyze } from './api';
import { logText } from './console';
import { closePanel, handleNavigation, init, onAction, openPanel, pollGuide, prFromUrl } from './content';

vi.mock('./api', () => ({
  daemonStatus: vi.fn(),
  fetchGuide: vi.fn(),
  requestAnalyze: vi.fn(),
}));

function go(path: string): void {
  window.history.pushState({}, '', path);
}

function makeGuide(overrides: Partial<Guide> = {}): Guide {
  return {
    owner: 'o', repo: 'r', number: 7, title: 'SIRET', url: 'https://github.com/o/r/pull/7',
    generatedAt: 'x', chaptersSource: 'llm',
    chapters: [{ title: 'Chap', intent: 'Faire X', symbolIds: ['s1'] }],
    symbols: [{
      id: 's1', name: 'createInvoice', kind: 'function', file: 'f.ts', startLine: 1, endLine: 2,
      layer: 'server', order: 0, diff: '', summary: '', testStatus: 'untested', callers: [],
    }],
    noise: [],
    ...overrides,
  };
}

// Doit tourner avant toute initialisation de la console : c'est justement la
// branche qui s'applique quand ni `bar` ni `host` n'ont encore été posés.
describe('openPanel sans console montée', () => {
  it('retombe sur le body de la page', () => {
    document.body.innerHTML = '';
    openPanel(makeGuide());
    expect(document.body.querySelector('.prg-panel')).not.toBeNull();
    closePanel();
  });
});

const BASELINE_PATH = '/_/_/pull/0';

describe('content script de l’extension', () => {
  beforeEach(async () => {
    // reset (pas clear) : purge aussi les implémentations et les files
    // `mockResolvedValueOnce` laissées par le test précédent.
    vi.resetAllMocks();
    document.body.innerHTML = '';
    closePanel(); // init() ne ferme pas un panneau resté ouvert par le test précédent
    vi.mocked(daemonStatus).mockResolvedValue(true);
    // PR neutre : (ré)attache une console fraîche sur le document courant,
    // pour que chaque test parte d'un host/bar réellement dans le DOM.
    go(BASELINE_PATH);
    await init();
    // clear (pas reset) : remet les compteurs d'appel à zéro sans effacer le
    // mockResolvedValue(true) de daemonStatus posé juste au-dessus.
    vi.clearAllMocks();
  });

  it('prFromUrl reconnaît une URL de PR et ignore le reste', () => {
    go('/o/r/pull/7');
    expect(prFromUrl()).toEqual({ owner: 'o', repo: 'r', number: 7 });
    go('/o/r/issues/7');
    expect(prFromUrl()).toBeUndefined();
  });

  it('init ne fait rien hors page de PR', async () => {
    go('/pas-une-pr');
    await init();
    expect(daemonStatus).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.prg-console')).toHaveLength(1); // toujours celle du baseline
  });

  it('init monte la console et affiche "démon prêt" quand le démon répond', async () => {
    go('/o/r/pull/7');
    await init();
    expect(document.querySelector('.prg-console-status')!.textContent).toBe('démon prêt');
    expect(logText()).toContain('PR o/r#7');
  });

  it('init affiche "démon hors ligne" et journalise une erreur quand le démon ne répond pas', async () => {
    vi.mocked(daemonStatus).mockResolvedValue(false);
    go('/o/r/pull/9');
    await init();
    expect(document.querySelector('.prg-console-status')!.textContent).toBe('démon hors ligne');
    expect(logText()).toContain('démon injoignable sur http://127.0.0.1:7777 au chargement');
  });

  it('handleNavigation ignore une navigation vers la même PR', () => {
    go(BASELINE_PATH);
    handleNavigation();
    expect(daemonStatus).not.toHaveBeenCalled();
  });

  it('handleNavigation réinitialise tout en changeant de PR', () => {
    go('/o/r/pull/8');
    handleNavigation();
    expect(daemonStatus).toHaveBeenCalledTimes(1);
  });

  it('handleNavigation nettoie panneau et console en quittant une PR', () => {
    go('/ailleurs');
    handleNavigation();
    expect(document.querySelector('.prg-console')).toBeNull();
  });

  it('onAction ne fait rien hors page de PR', async () => {
    go('/pas-une-pr');
    await onAction();
    expect(daemonStatus).not.toHaveBeenCalled();
  });

  it('onAction referme le panneau ouvert plutôt que de relancer une analyse', async () => {
    go('/o/r/pull/7');
    openPanel(makeGuide());
    await onAction();
    expect(document.querySelector('.prg-panel')).toBeNull();
    expect(daemonStatus).not.toHaveBeenCalled();
  });

  it('onAction signale un démon hors ligne sans tenter de récupérer le guide', async () => {
    vi.mocked(daemonStatus).mockResolvedValue(false);
    go('/o/r/pull/7');
    await onAction();
    expect(fetchGuide).not.toHaveBeenCalled();
    expect(logText()).toContain('démon injoignable sur http://127.0.0.1:7777 — lancer');
  });

  it('onAction ouvre directement le guide s’il est déjà prêt', async () => {
    vi.mocked(fetchGuide).mockResolvedValue({ status: 200, body: makeGuide() });
    go('/o/r/pull/7');
    await onAction();
    expect(document.querySelector('.prg-panel')).not.toBeNull();
    expect(requestAnalyze).not.toHaveBeenCalled();
  });

  it('onAction journalise un guide non conforme puis lance une analyse', async () => {
    vi.mocked(fetchGuide)
      .mockResolvedValueOnce({ status: 200, body: { oops: true } })
      .mockResolvedValueOnce({ status: 200, body: makeGuide() });
    go('/o/r/pull/7');
    await onAction();
    expect(logText()).toContain('guide non conforme (validateGuide a refusé)');
    expect(requestAnalyze).toHaveBeenCalledWith('o', 'r', 7);
    expect(document.querySelector('.prg-panel')).not.toBeNull(); // pollGuide a réussi au 1er tour
  });

  it('onAction lance l’analyse sans avertissement quand le guide n’existe pas encore', async () => {
    vi.mocked(fetchGuide)
      .mockResolvedValueOnce({ status: 404, body: { status: 'absent' } })
      .mockResolvedValueOnce({ status: 200, body: makeGuide() });
    const before = logText().length; // le journal est cumulatif sur tout le fichier
    go('/o/r/pull/7');
    await onAction();
    expect(logText().slice(before)).not.toContain('guide non conforme');
    expect(requestAnalyze).toHaveBeenCalledWith('o', 'r', 7);
  });

  describe('pollGuide', () => {
    it('ouvre le panneau dès que le guide est prêt', async () => {
      vi.mocked(fetchGuide).mockResolvedValue({ status: 200, body: makeGuide() });
      go('/o/r/pull/7');
      await pollGuide('o', 'r', 7);
      expect(document.querySelector('.prg-panel')).not.toBeNull();
    });

    it('s’arrête si le démon tombe pendant le suivi', async () => {
      vi.mocked(fetchGuide).mockResolvedValue({ status: 0, body: undefined });
      go('/o/r/pull/7');
      await pollGuide('o', 'r', 7);
      expect(logText()).toContain('démon injoignable pendant le suivi');
    });

    it('s’arrête sur une analyse en erreur, avec message par défaut si absent', async () => {
      vi.mocked(fetchGuide).mockResolvedValue({ status: 200, body: { status: 'error' } });
      go('/o/r/pull/7');
      await pollGuide('o', 'r', 7);
      expect(logText()).toContain('analyse échouée : analyse échouée');
    });

    it('relaie le message d’erreur de l’analyse quand il est fourni', async () => {
      vi.mocked(fetchGuide).mockResolvedValue({ status: 200, body: { status: 'error', message: 'boum' } });
      go('/o/r/pull/7');
      await pollGuide('o', 'r', 7);
      expect(logText()).toContain('analyse échouée : boum');
    });

    it('journalise une réponse inattendue puis réessaie jusqu’au succès', async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(fetchGuide)
          .mockResolvedValueOnce({ status: 200, body: { status: 'queued' } })
          .mockResolvedValueOnce({ status: 200, body: makeGuide() });
        go('/o/r/pull/7');
        const promise = pollGuide('o', 'r', 7);
        await vi.advanceTimersByTimeAsync(2000);
        await promise;
        expect(logText()).toContain('réponse inattendue du démon');
        expect(document.querySelector('.prg-panel')).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('abandonne après 4 minutes si l’analyse ne se termine jamais', async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(fetchGuide).mockResolvedValue({ status: 200, body: { status: 'running' } });
        go('/o/r/pull/7');
        const promise = pollGuide('o', 'r', 7);
        await vi.advanceTimersByTimeAsync(120 * 2000);
        await promise;
        expect(logText()).toContain('analyse toujours en cours après 4 minutes');
      } finally {
        vi.useRealTimers();
      }
    }, 10000);
  });
});
