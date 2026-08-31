import { validateGuide, type Guide } from '@pr-guide/engine/types';
import { daemonStatus, fetchGuide, requestAnalyze } from './api';
import { renderGuide } from './panel';

function prFromUrl(): { owner: string; repo: string; number: number } | undefined {
  const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  return m ? { owner: m[1]!, repo: m[2]!, number: Number(m[3]!) } : undefined;
}

let panel: HTMLElement | undefined;
let button: HTMLButtonElement | undefined;
let currentPr: { owner: string; repo: string; number: number } | undefined;

function setLabel(text: string, disabled = false): void {
  if (button) { button.textContent = text; button.disabled = disabled; }
}

function closePanel(): void {
  if (!panel) return;
  panel.remove();
  panel = undefined;
  setLabel('📖 Guide');
}

function openPanel(guide: Guide): void {
  closePanel();
  panel = renderGuide(guide, document);
  document.body.appendChild(panel);
  setLabel('✕ Fermer le guide');
}

function removeButton(): void {
  button?.remove();
  button = undefined;
}

async function pollGuide(owner: string, repo: string, number: number): Promise<void> {
  for (let i = 0; i < 120; i += 1) {
    const { status, body } = await fetchGuide(owner, repo, number);
    if (status === 200 && validateGuide(body)) { openPanel(body); return; }
    if (status === 0) { setLabel('Guide hors ligne'); return; }
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
  if (!(await daemonStatus())) { setLabel('Guide hors ligne'); return; }
  if (panel) { closePanel(); return; }
  const { status, body } = await fetchGuide(pr.owner, pr.repo, pr.number);
  if (status === 200 && validateGuide(body)) { openPanel(body); return; }
  await requestAnalyze(pr.owner, pr.repo, pr.number);
  await pollGuide(pr.owner, pr.repo, pr.number);
}

async function init(): Promise<void> {
  const pr = prFromUrl();
  if (!pr) return;
  currentPr = pr;
  button = document.createElement('button');
  button.className = 'prg-button btn btn-sm';
  button.style.cssText = 'position:fixed;top:70px;right:16px;z-index:10000;';
  button.addEventListener('click', () => { void onClick(); });
  document.body.appendChild(button);
  setLabel((await daemonStatus()) ? '📖 Guide' : 'Guide hors ligne', false);
}

function handleNavigation(): void {
  const pr = prFromUrl();
  if (!pr) {
    closePanel();
    removeButton();
    currentPr = undefined;
    return;
  }
  const samePr = currentPr !== undefined
    && currentPr.owner === pr.owner
    && currentPr.repo === pr.repo
    && currentPr.number === pr.number;
  if (samePr) return;
  closePanel();
  removeButton();
  void init();
}

void init();
// GitHub navigue en SPA : nettoyer bouton/panneau puis ré-initialiser à chaque navigation.
document.addEventListener('turbo:load', handleNavigation);
window.addEventListener('popstate', handleNavigation);
