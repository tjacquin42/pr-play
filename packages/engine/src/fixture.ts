import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function fixtureRepoDir(): string {
  return join(here, '..', 'fixtures', 'mini-repo');
}

export function fixtureDiff(): string {
  return readFileSync(join(here, '..', 'fixtures', 'pr.diff'), 'utf8');
}
