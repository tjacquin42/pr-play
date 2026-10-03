import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// index.ts est le point d'entrée réel du démon : il écoute pour de vrai sur
// 127.0.0.1:7777 (le port du démon launchd de Thomas). On ne doit jamais
// laisser le vrai `server.listen` s'exécuter dans les tests ; tout ce qu'il
// touche est donc remplacé avant le premier import du module.
type Deps = { store: unknown; analyze: (owner: string, repo: string, number: number) => Promise<unknown> };

let capturedDeps: Deps | undefined;
const listen = vi.fn((_port: number, _host: string, cb: () => void) => { cb(); });
const createServer = vi.fn((deps: Deps) => { capturedDeps = deps; return { listen }; });
const cleanupOnce = vi.fn((_store: unknown, _now: Date): Promise<string[]> => Promise.resolve([]));
const analyzePr = vi.fn((_owner: string, _repo: string, _number: number): Promise<unknown> => Promise.resolve(undefined));
const GuideStore = vi.fn((_dir: string) => ({}));

vi.mock('./server', () => ({ createServer }));
vi.mock('./store', () => ({ GuideStore }));
vi.mock('./cleanup', () => ({ cleanupOnce }));
vi.mock('./analyze-pr', () => ({ analyzePr }));

describe('démon (point d’entrée)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    capturedDeps = undefined;
    cleanupOnce.mockResolvedValue([]);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('construit le store, démarre le serveur sur 127.0.0.1:7777 et délègue l’analyse', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await import('./index');

    expect(GuideStore).toHaveBeenCalledWith(expect.stringContaining('.pr-play/guides'));
    expect(createServer).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(7777, '127.0.0.1', expect.any(Function));
    expect(logSpy).toHaveBeenCalledWith('pr-play : démon prêt sur http://127.0.0.1:7777');

    await capturedDeps?.analyze('o', 'r', 7);
    expect(analyzePr).toHaveBeenCalledWith('o', 'r', 7);

    logSpy.mockRestore();
  });

  it('purge au démarrage et journalise seulement quand des guides ont été supprimés', async () => {
    cleanupOnce.mockResolvedValue(['o/r/7']);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await import('./index');
    await vi.waitFor(() => expect(logSpy).toHaveBeenCalledWith('pr-play : purge de o/r/7'));
    logSpy.mockRestore();
  });

  it('ne journalise rien quand la purge ne supprime aucun guide', async () => {
    cleanupOnce.mockResolvedValue([]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await import('./index');
    await vi.waitFor(() => expect(cleanupOnce).toHaveBeenCalledTimes(1));
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('purge de'));
    logSpy.mockRestore();
  });

  it('relance la purge toutes les 24 heures', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await import('./index');
    await vi.waitFor(() => expect(cleanupOnce).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(cleanupOnce).toHaveBeenCalledTimes(2);
    logSpy.mockRestore();
  });
});
