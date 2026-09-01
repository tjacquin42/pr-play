import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
