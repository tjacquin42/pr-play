import { validateGuide, type Guide } from '@pr-play/engine/types';
import { daemonStatus, fetchGuide, requestAnalyze } from './api';
import { captureGlobalErrors, log, mountConsole, setAction, setStatus, unmountConsole } from './console';
import { renderGuide } from './panel';

function prFromUrl(): { owner: string; repo: string; number: number } | undefined {
  const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  return m ? { owner: m[1]!, repo: m[2]!, number: Number(m[3]!) } : undefined;
}

let panel: HTMLElement | undefined;
let host: HTMLElement | undefined;
let bar: HTMLElement | undefined;
let currentPr: { owner: string; repo: string; number: number } | undefined;

function closePanel(): void {
  if (!panel) return;
  panel.remove();
  panel = undefined;
  // La PR d'origine réapparaît telle quelle : on n'a fait que la masquer.
  host?.classList.remove('prg-guide-open');
  setAction('📖 Guide');
}

function openPanel(guide: Guide): void {
  closePanel();
  panel = renderGuide(guide, document);
  // Le guide prend la place de la PR, juste sous la console, sans la détruire.
  if (bar && host) {
    bar.insertAdjacentElement('afterend', panel);
    host.classList.add('prg-guide-open');
  } else {
    document.body.appendChild(panel);
  }
  setAction('✕ Fermer le guide');
  const untested = guide.symbols.filter((s) => s.testStatus === 'untested').length;
  const code = guide.symbols.filter((s) => s.testStatus !== 'is-test').length;
  setStatus(`${guide.chapters.length} chapitres · ${code} symboles de code · ${untested} non testés`);
}

async function pollGuide(owner: string, repo: string, number: number): Promise<void> {
  for (let i = 0; i < 120; i += 1) {
    const { status, body } = await fetchGuide(owner, repo, number);
    if (status === 200 && validateGuide(body)) { openPanel(body); return; }
    if (status === 0) {
      setAction('📖 Guide');
      setStatus('démon hors ligne');
      log('error', 'démon injoignable pendant le suivi de l’analyse');
      return;
    }
    const s = body as { status?: string; message?: string } | undefined;
    if (s?.status === 'error') {
      const message = s.message ?? 'analyse échouée';
      setAction('📖 Réessayer');
      setStatus('erreur');
      log('error', `analyse échouée : ${message}`);
      return;
    }
    if (status === 200 && s?.status !== 'running') {
      log('warn', `réponse inattendue du démon : ${JSON.stringify(body).slice(0, 300)}`);
    }
    setAction('Analyse en cours…', true);
    setStatus(`analyse en cours (${(i + 1) * 2} s)`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  setAction('📖 Réessayer');
  setStatus('analyse trop longue');
  log('error', 'analyse toujours en cours après 4 minutes');
}

async function onAction(): Promise<void> {
  const pr = prFromUrl();
  if (!pr) return;
  if (panel) { closePanel(); setStatus('guide fermé'); return; }
  if (!(await daemonStatus())) {
    setStatus('démon hors ligne');
    log('error', 'démon injoignable sur http://127.0.0.1:7777 — lancer ~/DEV/pr-play/scripts/install-daemon.sh');
    return;
  }
  const { status, body } = await fetchGuide(pr.owner, pr.repo, pr.number);
  if (status === 200 && validateGuide(body)) { openPanel(body); return; }
  if (status === 200 && !validateGuide(body)) {
    const shape = body === undefined ? 'vide' : JSON.stringify(body).slice(0, 300);
    log('warn', `guide non conforme (validateGuide a refusé) : ${shape}`);
  }
  await requestAnalyze(pr.owner, pr.repo, pr.number);
  await pollGuide(pr.owner, pr.repo, pr.number);
}

async function init(): Promise<void> {
  const pr = prFromUrl();
  if (!pr) return;
  currentPr = pr;
  const mounted = mountConsole(document, () => { void onAction(); });
  bar = mounted.bar;
  host = mounted.host;
  log('info', `PR ${pr.owner}/${pr.repo}#${pr.number}`);
  const alive = await daemonStatus();
  setStatus(alive ? 'démon prêt' : 'démon hors ligne');
  if (!alive) log('error', 'démon injoignable sur http://127.0.0.1:7777 au chargement');
}

function handleNavigation(): void {
  const pr = prFromUrl();
  if (!pr) {
    closePanel();
    unmountConsole();
    currentPr = undefined;
    return;
  }
  const samePr = currentPr !== undefined
    && currentPr.owner === pr.owner
    && currentPr.repo === pr.repo
    && currentPr.number === pr.number;
  if (samePr) return;
  closePanel();
  unmountConsole();
  void init();
}

captureGlobalErrors(window);
void init();
// GitHub navigue en SPA : nettoyer panneau/console puis ré-initialiser à chaque navigation.
document.addEventListener('turbo:load', handleNavigation);
window.addEventListener('popstate', handleNavigation);
