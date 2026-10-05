import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from './console';
import { daemonStatus, fetchGuide, requestAnalyze } from './api';

vi.mock('./console', () => ({ log: vi.fn() }));

interface FakeRuntime {
  sendMessage: ReturnType<typeof vi.fn>;
  lastError: { message?: string } | undefined;
}

type SendMessageCallback = (response: { ok: boolean; status: number; body: unknown } | undefined) => void;

function installFakeChrome(): FakeRuntime {
  const runtime: FakeRuntime = { sendMessage: vi.fn(), lastError: undefined };
  // @types/chrome décrit une API bien plus large que ce dont bridge() se
  // sert : on ne fabrique que le sous-ensemble utilisé, casté au point d'entrée.
  vi.stubGlobal('chrome', { runtime } as unknown as typeof chrome);
  return runtime;
}

describe('api (pont chrome.runtime vers le démon)', () => {
  let runtime: FakeRuntime;

  beforeEach(() => {
    runtime = installFakeChrome();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('daemonStatus renvoie true quand le démon répond ok', async () => {
    runtime.sendMessage.mockImplementation((_msg: unknown, cb: SendMessageCallback) => {
      cb({ ok: true, status: 200, body: { ok: true } });
    });
    await expect(daemonStatus()).resolves.toBe(true);
    expect(runtime.sendMessage).toHaveBeenCalledWith({ path: '/status', init: undefined }, expect.any(Function));
  });

  it('daemonStatus renvoie false et journalise un avertissement sur une réponse HTTP en erreur', async () => {
    runtime.sendMessage.mockImplementation((_msg: unknown, cb: SendMessageCallback) => {
      cb({ ok: false, status: 500, body: undefined });
    });
    await expect(daemonStatus()).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith('warn', '/status → HTTP 500');
  });

  it('requestAnalyze transmet owner/repo/numéro en POST et renvoie le statut annoncé', async () => {
    runtime.sendMessage.mockImplementation((_msg: unknown, cb: SendMessageCallback) => {
      cb({ ok: true, status: 200, body: { status: 'started' } });
    });
    const status = await requestAnalyze('o', 'r', 7);
    expect(status).toBe('started');
    expect(runtime.sendMessage).toHaveBeenCalledWith(
      { path: '/analyze', init: { method: 'POST', body: JSON.stringify({ owner: 'o', repo: 'r', number: 7 }) } },
      expect.any(Function),
    );
    expect(log).toHaveBeenCalledWith('info', 'POST /analyze o/r#7 → started');
  });

  it('requestAnalyze retombe sur "error" quand le corps de la réponse est vide', async () => {
    runtime.sendMessage.mockImplementation((_msg: unknown, cb: SendMessageCallback) => {
      cb(undefined); // service worker endormi : bridge() renvoie UNREACHABLE
    });
    const status = await requestAnalyze('o', 'r', 7);
    expect(status).toBe('error');
    expect(log).toHaveBeenCalledWith('info', 'POST /analyze o/r#7 → error');
  });

  it('fetchGuide renvoie le statut et le corps tels que livrés par le pont', async () => {
    runtime.sendMessage.mockImplementation((_msg: unknown, cb: SendMessageCallback) => {
      cb({ ok: true, status: 200, body: { chapters: [] } });
    });
    await expect(fetchGuide('o', 'r', 7)).resolves.toEqual({ status: 200, body: { chapters: [] } });
    expect(runtime.sendMessage).toHaveBeenCalledWith({ path: '/guide/o/r/7', init: undefined }, expect.any(Function));
  });

  it('journalise une erreur et renvoie une réponse injoignable quand chrome.runtime.lastError est posé', async () => {
    runtime.sendMessage.mockImplementation((_msg: unknown, cb: SendMessageCallback) => {
      runtime.lastError = { message: 'Extension context invalidated.' };
      cb(undefined);
    });
    await expect(fetchGuide('o', 'r', 7)).resolves.toEqual({ status: 0, body: undefined });
    expect(log).toHaveBeenCalledWith('error', 'pont /guide/o/r/7 : Extension context invalidated.');
  });

  it('journalise une erreur quand le service worker répond une réponse vide sans lastError', async () => {
    runtime.sendMessage.mockImplementation((_msg: unknown, cb: SendMessageCallback) => {
      cb(undefined);
    });
    await expect(daemonStatus()).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith('error', 'pont /status : réponse vide du service worker');
  });

  it('rattrape une exception synchrone du pont (instance d’Error)', async () => {
    runtime.sendMessage.mockImplementation(() => {
      throw new Error('contexte détruit');
    });
    await expect(daemonStatus()).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith('error', 'pont /status : contexte détruit');
  });

  it('rattrape une exception synchrone du pont (valeur qui n’est pas une Error)', async () => {
    runtime.sendMessage.mockImplementation(() => {
      throw 'boum';
    });
    await expect(daemonStatus()).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith('error', 'pont /status : boum');
  });
});
