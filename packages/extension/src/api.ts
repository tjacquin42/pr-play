import { log } from './console';

interface BridgeResponse { ok: boolean; status: number; body: unknown }

const UNREACHABLE: BridgeResponse = { ok: false, status: 0, body: undefined };

function bridge(path: string, init?: { method?: string; body?: string }): Promise<BridgeResponse> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ path, init }, (r: BridgeResponse | undefined) => {
        // Sans cette lecture, une erreur du pont (service worker endormi,
        // extension rechargée) remonte comme une réponse undefined.
        const bridgeError = chrome.runtime.lastError?.message;
        if (bridgeError !== undefined) {
          log('error', `pont ${path} : ${bridgeError}`);
          resolve(UNREACHABLE);
          return;
        }
        if (r === undefined) {
          log('error', `pont ${path} : réponse vide du service worker`);
          resolve(UNREACHABLE);
          return;
        }
        if (!r.ok) log('warn', `${path} → HTTP ${r.status}`);
        resolve(r);
      });
    } catch (err: unknown) {
      log('error', `pont ${path} : ${err instanceof Error ? err.message : String(err)}`);
      resolve(UNREACHABLE);
    }
  });
}

export async function daemonStatus(): Promise<boolean> {
  return (await bridge('/status')).ok;
}

export async function requestAnalyze(owner: string, repo: string, number: number): Promise<string> {
  const r = await bridge('/analyze', { method: 'POST', body: JSON.stringify({ owner, repo, number }) });
  const body = r.body as { status?: string } | undefined;
  const status = body?.status ?? 'error';
  log('info', `POST /analyze ${owner}/${repo}#${number} → ${status}`);
  return status;
}

export async function fetchGuide(owner: string, repo: string, number: number): Promise<{ status: number; body: unknown }> {
  const r = await bridge(`/guide/${owner}/${repo}/${number}`);
  return { status: r.status, body: r.body };
}
