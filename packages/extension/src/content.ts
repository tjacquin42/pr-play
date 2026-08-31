import { validateGuide, type Guide } from '@pr-guide/engine/types';
import { daemonStatus, fetchGuide, requestAnalyze } from './api';
import { renderGuide } from './panel';

function prFromUrl(): { owner: string; repo: string; number: number } | undefined {
  const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  return m ? { owner: m[1]!, repo: m[2]!, number: Number(m[3]!) } : undefined;
}

let panel: HTMLElement | undefined;
let button: HTMLButtonElement | undefined;

function setLabel(text: string, disabled = false): void {
  if (button) { button.textContent = text; button.disabled = disabled; }
}

function togglePanel(guide: Guide): void {
  if (panel) { panel.remove(); panel = undefined; setLabel('📖 Guide'); return; }
  panel = renderGuide(guide, document);
  document.body.appendChild(panel);
  setLabel('✕ Fermer le guide');
}

async function pollGuide(owner: string, repo: string, number: number): Promise<void> {
  for (let i = 0; i < 120; i += 1) {
    const { status, body } = await fetchGuide(owner, repo, number);
    if (status === 200 && validateGuide(body)) { togglePanel(body); return; }
    const s = body as { status?: string; message?: string } | undefined;
    if (s?.status === 'error') { setLabel(`Erreur : ${s.message ?? 'analyse échouée'}`); return; }
    setLabel('Analyse en cours…', true);
    await new Promise((r) => setTimeout(r, 2000));
  }
  setLabel('Analyse trop longue — réessayer');
}

async function onClick(): Promise<void> {
  const pr = prFromUrl();
  if (!pr) return;
  if (panel) { togglePanel({} as Guide); return; } // fermer
  const { status, body } = await fetchGuide(pr.owner, pr.repo, pr.number);
  if (status === 200 && validateGuide(body)) { togglePanel(body); return; }
  await requestAnalyze(pr.owner, pr.repo, pr.number);
  await pollGuide(pr.owner, pr.repo, pr.number);
}

async function init(): Promise<void> {
  if (!prFromUrl() || document.querySelector('.prg-button')) return;
  button = document.createElement('button');
  button.className = 'prg-button btn btn-sm';
  button.style.cssText = 'position:fixed;top:70px;right:16px;z-index:10000;';
  button.addEventListener('click', () => { void onClick(); });
  document.body.appendChild(button);
  setLabel((await daemonStatus()) ? '📖 Guide' : 'Guide hors ligne', false);
}

void init();
// GitHub navigue en SPA : ré-initialiser à chaque navigation.
document.addEventListener('turbo:load', () => { void init(); });
window.addEventListener('popstate', () => { void init(); });
