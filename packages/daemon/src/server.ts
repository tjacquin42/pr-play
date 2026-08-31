import http from 'node:http';
import type { Guide } from '@pr-play/engine';
import type { GuideStore } from './store';

interface Deps {
  store: GuideStore;
  analyze: (owner: string, repo: string, number: number) => Promise<Guide>;
}

type JobState = { status: 'running' } | { status: 'error'; message: string };

function send(res: http.ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return undefined; }
}

export function createServer(deps: Deps): http.Server {
  const jobs = new Map<string, JobState>();

  return http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && url.pathname === '/status') { send(res, 200, { ok: true }); return; }

      if (req.method === 'POST' && url.pathname === '/analyze') {
        const body = await readBody(req);
        if (typeof body !== 'object' || body === null) { send(res, 400, { status: 'invalide' }); return; }
        const { owner, repo, number, force } = body as Record<string, unknown>;
        if (typeof owner !== 'string' || typeof repo !== 'string' || typeof number !== 'number') {
          send(res, 400, { status: 'invalide' }); return;
        }
        const key = `${owner}/${repo}/${number}`;
        if (jobs.get(key)?.status === 'running') { send(res, 200, { status: 'running' }); return; }
        jobs.set(key, { status: 'running' });
        if (force !== true && (await deps.store.load(owner, repo, number))) {
          jobs.delete(key);
          send(res, 200, { status: 'cached' });
          return;
        }
        void deps.analyze(owner, repo, number)
          .then(async (guide) => { await deps.store.save(guide); jobs.delete(key); })
          .catch((err: unknown) => {
            jobs.set(key, { status: 'error', message: err instanceof Error ? err.message : String(err) });
          });
        send(res, 200, { status: 'started' });
        return;
      }

      const m = url.pathname.match(/^\/guide\/([^/]+)\/([^/]+)\/(\d+)$/);
      if (req.method === 'GET' && m) {
        const [owner, repo, number] = [m[1]!, m[2]!, Number(m[3]!)];
        const key = `${owner}/${repo}/${number}`;
        const guide = await deps.store.load(owner, repo, number);
        if (guide) { send(res, 200, guide); return; }
        const job = jobs.get(key);
        if (job) { send(res, 200, job); return; }
        send(res, 404, { status: 'absent' });
        return;
      }

      send(res, 404, { status: 'introuvable' });
    })();
  });
}
