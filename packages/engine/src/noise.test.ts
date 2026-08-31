import { describe, expect, it } from 'vitest';
import { splitNoise } from './noise';
import type { ChangedFile } from './diff';

function cf(path: string, extra: Partial<ChangedFile> = {}): ChangedFile {
  return { path, isNew: false, isDeleted: false, isRenameOnly: false, changedLines: [1], diffText: '', ...extra };
}

describe('splitNoise', () => {
  it('écarte lockfiles, snapshots, générés et renommages purs', () => {
    const { kept, noise } = splitNoise([
      cf('src/app.ts'),
      cf('pnpm-lock.yaml'),
      cf('web/__snapshots__/App.test.tsx.snap'),
      cf('dist/bundle.js'),
      cf('src/old.ts', { isRenameOnly: true }),
    ]);
    expect(kept.map((f) => f.path)).toEqual(['src/app.ts']);
    expect(noise).toHaveLength(4);
  });
});
