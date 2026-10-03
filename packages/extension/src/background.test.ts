import { beforeEach, describe, expect, it, vi } from 'vitest';

// background.ts n'exporte rien : son seul effet observable est l'écouteur
// qu'il pose sur chrome.runtime.onMessage à l'import. On le capture via un
// chrome factice, puis on l'appelle directement comme le ferait le vrai
// service worker. `fetch` est systématiquement remplacé : ce fichier ne doit
// jamais tenter de parler au vrai démon pendant les tests.
interface BridgeRequest { path: string; init?: { method?: string; body?: string } }
interface BridgeResponse { ok: boolean; status: number; body: unknown }
type Listener = (msg: BridgeRequest, sender: unknown, sendResponse: (r: BridgeResponse) => void) => boolean;

function installFakeChrome(): { addListener: ReturnType<typeof vi.fn> } {
  const addListener = vi.fn();
  vi.stubGlobal('chrome', { runtime: { onMessage: { addListener } } } as unknown as typeof chrome);
  return { addListener };
}

async function loadListener(): Promise<Listener> {
  vi.resetModules();
  const { addListener } = installFakeChrome();
  await import('./background');
  expect(addListener).toHaveBeenCalledTimes(1);
  return addListener.mock.calls[0]![0] as Listener;
}

describe('background (service worker de l’extension)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('s’enregistre comme écouteur asynchrone : renvoie true pour garder le port ouvert', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) }));
    const listener = await loadListener();
    const result = listener({ path: '/status' }, {}, vi.fn());
    expect(result).toBe(true);
  });

  it('relaie une requête GET par défaut vers le démon local et renvoie ok/status/body', async () => {
    const json = vi.fn().mockResolvedValue({ chapters: [] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json }));
    const listener = await loadListener();
    const sendResponse = vi.fn();
    listener({ path: '/guide/o/r/7' }, {}, sendResponse);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:7777/guide/o/r/7', {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
      body: undefined,
    });
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, status: 200, body: { chapters: [] } });
  });

  it('relaie une requête POST avec sa méthode et son corps', async () => {
    const json = vi.fn().mockResolvedValue({ status: 'started' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json }));
    const listener = await loadListener();
    const sendResponse = vi.fn();
    const body = JSON.stringify({ owner: 'o', repo: 'r', number: 7 });
    listener({ path: '/analyze', init: { method: 'POST', body } }, {}, sendResponse);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:7777/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, status: 200, body: { status: 'started' } });
  });

  it('renvoie un corps undefined quand la réponse n’est pas du JSON valide', async () => {
    const json = vi.fn().mockRejectedValue(new Error('invalide'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json }));
    const listener = await loadListener();
    const sendResponse = vi.fn();
    listener({ path: '/status' }, {}, sendResponse);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: false, status: 500, body: undefined }));
  });

  it('renvoie une réponse injoignable quand le démon ne répond pas du tout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const listener = await loadListener();
    const sendResponse = vi.fn();
    listener({ path: '/status' }, {}, sendResponse);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: false, status: 0, body: undefined }));
  });
});
