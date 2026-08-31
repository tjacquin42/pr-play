interface BridgeResponse { ok: boolean; status: number; body: unknown }

function bridge(path: string, init?: { method?: string; body?: string }): Promise<BridgeResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ path, init }, (r: BridgeResponse) => resolve(r));
  });
}

export async function daemonStatus(): Promise<boolean> {
  return (await bridge('/status')).ok;
}

export async function requestAnalyze(owner: string, repo: string, number: number): Promise<string> {
  const r = await bridge('/analyze', { method: 'POST', body: JSON.stringify({ owner, repo, number }) });
  const body = r.body as { status?: string } | undefined;
  return body?.status ?? 'error';
}

export async function fetchGuide(owner: string, repo: string, number: number): Promise<{ status: number; body: unknown }> {
  const r = await bridge(`/guide/${owner}/${repo}/${number}`);
  return { status: r.status, body: r.body };
}
