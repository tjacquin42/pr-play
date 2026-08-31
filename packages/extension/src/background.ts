interface BridgeRequest { path: string; init?: { method?: string; body?: string } }
interface BridgeResponse { ok: boolean; status: number; body: unknown }

chrome.runtime.onMessage.addListener((msg: BridgeRequest, _sender, sendResponse: (r: BridgeResponse) => void) => {
  const init: RequestInit = {
    method: msg.init?.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: msg.init?.body,
  };
  fetch(`http://127.0.0.1:7777${msg.path}`, init)
    .then(async (r) => sendResponse({ ok: r.ok, status: r.status, body: await r.json().catch(() => undefined) }))
    .catch(() => sendResponse({ ok: false, status: 0, body: undefined }));
  return true; // réponse asynchrone
});
