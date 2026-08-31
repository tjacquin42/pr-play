import { homedir } from 'node:os';
import { join } from 'node:path';
import { analyzePr } from './analyze-pr';
import { cleanupOnce } from './cleanup';
import { createServer } from './server';
import { GuideStore } from './store';

const store = new GuideStore(join(homedir(), '.pr-guide', 'guides'));
const server = createServer({ store, analyze: (o, r, n) => analyzePr(o, r, n) });

server.listen(7777, '127.0.0.1', () => {
  console.log('pr-guide : démon prêt sur http://127.0.0.1:7777');
});

const runCleanup = (): void => {
  void cleanupOnce(store, new Date()).then((removed) => {
    if (removed.length > 0) console.log(`pr-guide : purge de ${removed.join(', ')}`);
  });
};
runCleanup();
setInterval(runCleanup, 24 * 60 * 60 * 1000);
