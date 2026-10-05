import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureGlobalErrors, log, logText, mountConsole, setAction, setStatus, unmountConsole } from './console';

describe('console de l’extension', () => {
  beforeEach(() => {
    unmountConsole();
    document.body.innerHTML = '';
  });

  it('monte une barre avec statut, action et boutons de journal', () => {
    const onAction = vi.fn();
    const { bar } = mountConsole(document, onAction);
    expect(bar.querySelector('.prg-console-brand')!.textContent).toBe('pr-play');
    expect(bar.querySelectorAll('.prg-console-btn')).toHaveLength(2);
    (bar.querySelector('.prg-console-action') as HTMLButtonElement).click();
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('s’insère juste avant le bloc de titre de la PR, dans le flux', () => {
    document.body.innerHTML = '<div id="repo"><div id="partial-discussion-header">Titre</div><div id="corps">discussion</div></div>';
    const { bar, host } = mountConsole(document, () => {});
    expect(host.id).toBe('repo');
    expect(bar.nextElementSibling!.id).toBe('partial-discussion-header');
    expect(bar.classList.contains('prg-console-floating')).toBe(false);
  });

  it('reconnaît aussi le gabarit récent de GitHub', () => {
    document.body.innerHTML = '<main><div data-testid="issue-header">Titre</div></main>';
    const { bar } = mountConsole(document, () => {});
    expect((bar.nextElementSibling as HTMLElement).dataset.testid).toBe('issue-header');
  });

  it('se rabat sur une barre épinglée si aucun repère n’est reconnu', () => {
    document.body.innerHTML = '<div>page inconnue</div>';
    const { bar } = mountConsole(document, () => {});
    expect(bar.classList.contains('prg-console-floating')).toBe(true);
    expect(bar.parentElement).toBe(document.body);
  });

  it('affiche statut et libellé d’action', () => {
    const { bar } = mountConsole(document, () => {});
    setStatus('démon prêt');
    setAction('Analyse en cours…', true);
    expect(bar.querySelector('.prg-console-status')!.textContent).toBe('démon prêt');
    const action = bar.querySelector('.prg-console-action') as HTMLButtonElement;
    expect(action.textContent).toBe('Analyse en cours…');
    expect(action.disabled).toBe(true);
  });

  it('journalise, déplie automatiquement sur erreur, et rend un texte copiable', () => {
    const { bar } = mountConsole(document, () => {});
    const list = bar.querySelector('.prg-log') as HTMLElement;
    expect(list.hidden).toBe(true);
    log('info', 'PR o/r#7');
    expect(list.hidden).toBe(true);
    log('error', 'démon injoignable');
    expect(list.hidden).toBe(false);
    expect(list.querySelectorAll('.prg-log-error')).toHaveLength(1);
    expect(logText()).toContain('ERROR démon injoignable');
  });

  it('capture les exceptions et rejets non gérés de la page', () => {
    mountConsole(document, () => {});
    captureGlobalErrors(window);
    window.dispatchEvent(new ErrorEvent('error', { message: 'boum' }));
    expect(logText()).toContain('exception : boum');
  });

  it('démonte proprement la barre', () => {
    mountConsole(document, () => {});
    unmountConsole();
    expect(document.querySelector('.prg-console')).toBeNull();
  });

  it('déplie/replie le journal via le bouton Journal', () => {
    const { bar } = mountConsole(document, () => {});
    const list = bar.querySelector('.prg-log') as HTMLElement;
    const journalBtn = bar.querySelectorAll('.prg-console-btn')[0] as HTMLButtonElement;
    expect(list.hidden).toBe(true);
    journalBtn.click();
    expect(list.hidden).toBe(false);
    journalBtn.click();
    expect(list.hidden).toBe(true);
  });

  describe('copie du journal', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('copie dans le presse-papier puis restaure le libellé après 3 secondes', async () => {
      vi.useFakeTimers();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const { bar } = mountConsole(document, () => {});
      const copyBtn = bar.querySelectorAll('.prg-console-btn')[1] as HTMLButtonElement;
      copyBtn.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(writeText).toHaveBeenCalledWith(logText());
      expect(copyBtn.textContent).toBe('Copié ✓');
      await vi.advanceTimersByTimeAsync(3000);
      expect(copyBtn.textContent).toBe('Copier le journal');
    });

    it('retombe sur une sélection manuelle si le presse-papier refuse la copie', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('refusé'));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const { bar } = mountConsole(document, () => {});
      const copyBtn = bar.querySelectorAll('.prg-console-btn')[1] as HTMLButtonElement;
      copyBtn.click();
      await vi.waitFor(() => expect(copyBtn.textContent).toBe('Copie auto refusée — ⌘C'));
      expect(bar.querySelector('.prg-log-fallback')).not.toBeNull();
    });
  });

  it('capture aussi les rejets de promesse non gérés, avec ou sans Error', () => {
    // jsdom n'implémente pas PromiseRejectionEvent : un Event standard avec
    // `reason`/`promise` greffés suffit, seuls ces champs sont lus par le code.
    interface FakeRejectionEvent extends Event { reason: unknown; promise: Promise<unknown> }
    function rejectionEvent(reason: unknown, promise: Promise<unknown>): FakeRejectionEvent {
      const event = new Event('unhandledrejection') as FakeRejectionEvent;
      event.reason = reason;
      event.promise = promise;
      return event;
    }

    mountConsole(document, () => {});
    captureGlobalErrors(window);
    const handled = Promise.reject(new Error('boum')).catch(() => {}); // évite un vrai rejet non géré dans ce test
    window.dispatchEvent(rejectionEvent(new Error('boum'), handled));
    expect(logText()).toContain('promesse rejetée : boum');
    window.dispatchEvent(rejectionEvent('texte brut', Promise.resolve()));
    expect(logText()).toContain('promesse rejetée : texte brut');
  });
});
