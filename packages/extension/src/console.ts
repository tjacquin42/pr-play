export type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry { at: string; level: LogLevel; message: string }

const entries: LogEntry[] = [];
let bar: HTMLElement | undefined;
let statusEl: HTMLElement | undefined;
let listEl: HTMLElement | undefined;
let actionButton: HTMLButtonElement | undefined;
let copyButton: HTMLButtonElement | undefined;

function el(doc: Document, tag: string, className: string, text?: string): HTMLElement {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderEntry(doc: Document, entry: LogEntry): HTMLElement {
  const line = el(doc, 'div', `prg-log-line prg-log-${entry.level}`);
  line.appendChild(el(doc, 'span', 'prg-log-time', entry.at));
  line.appendChild(el(doc, 'span', 'prg-log-msg', entry.message));
  return line;
}

/** Journalise un événement et l'affiche dans la console si elle est montée. */
export function log(level: LogLevel, message: string): void {
  const at = new Date().toLocaleTimeString('fr-FR', { hour12: false });
  const entry: LogEntry = { at, level, message };
  entries.push(entry);
  if (entries.length > 200) entries.shift();
  if (!listEl) return;
  listEl.appendChild(renderEntry(listEl.ownerDocument, entry));
  listEl.scrollTop = listEl.scrollHeight;
  if (level === 'error') openLog();
}

/** Texte complet du journal, prêt à être collé dans une conversation. */
export function logText(): string {
  const head = `pr-play — ${location.href}\nnavigateur : ${navigator.userAgent}`;
  const body = entries.map((e) => `[${e.at}] ${e.level.toUpperCase()} ${e.message}`).join('\n');
  return `${head}\n${body}`;
}

export function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

export function setAction(text: string, disabled = false): void {
  if (!actionButton) return;
  actionButton.textContent = text;
  actionButton.disabled = disabled;
}

function openLog(): void {
  if (listEl) listEl.hidden = false;
}

function toggleLog(): void {
  if (listEl) listEl.hidden = !listEl.hidden;
}

async function copyLog(): Promise<void> {
  const text = logText();
  try {
    await navigator.clipboard.writeText(text);
    if (copyButton) copyButton.textContent = 'Copié ✓';
  } catch {
    // Le presse-papier peut être refusé si l'onglet n'a pas le focus : on
    // retombe sur une sélection manuelle, jamais sur un échec silencieux.
    const doc = copyButton?.ownerDocument;
    if (!doc) return;
    const area = doc.createElement('textarea');
    area.className = 'prg-log-fallback';
    area.value = text;
    listEl?.appendChild(area);
    area.select();
    if (copyButton) copyButton.textContent = 'Copie auto refusée — ⌘C';
  }
  setTimeout(() => { if (copyButton) copyButton.textContent = 'Copier le journal'; }, 3000);
}

/** Monte la barre fixe en haut de la page et renvoie son élément racine. */
export function mountConsole(doc: Document, onAction: () => void): HTMLElement {
  unmountConsole();
  bar = el(doc, 'div', 'prg-console');

  const brand = el(doc, 'span', 'prg-console-brand', 'pr-play');
  statusEl = el(doc, 'span', 'prg-console-status', 'démarrage…');

  actionButton = doc.createElement('button');
  actionButton.className = 'prg-console-action';
  actionButton.textContent = '📖 Guide';
  actionButton.addEventListener('click', onAction);

  const logButton = doc.createElement('button');
  logButton.className = 'prg-console-btn';
  logButton.textContent = 'Journal';
  logButton.addEventListener('click', toggleLog);

  copyButton = doc.createElement('button');
  copyButton.className = 'prg-console-btn';
  copyButton.textContent = 'Copier le journal';
  copyButton.addEventListener('click', () => { void copyLog(); });

  bar.append(brand, statusEl, actionButton, logButton, copyButton);

  listEl = el(doc, 'div', 'prg-log');
  listEl.hidden = true;
  for (const entry of entries) listEl.appendChild(renderEntry(doc, entry));
  bar.appendChild(listEl);

  doc.body.appendChild(bar);
  doc.documentElement.classList.add('prg-console-on');
  return bar;
}

export function unmountConsole(): void {
  bar?.remove();
  bar = undefined;
  statusEl = undefined;
  listEl = undefined;
  actionButton = undefined;
  copyButton = undefined;
  document.documentElement.classList.remove('prg-console-on');
}

/** Capture les erreurs non gérées de la page pour qu'elles soient copiables. */
export function captureGlobalErrors(win: Window): void {
  win.addEventListener('error', (event) => {
    const where = event.filename ? ` (${event.filename}:${event.lineno})` : '';
    log('error', `exception : ${event.message}${where}`);
  });
  win.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error ? `${reason.message}\n${reason.stack ?? ''}` : String(reason);
    log('error', `promesse rejetée : ${message}`);
  });
}
