import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff, sliceDiff } from './diff';

const DIFF = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,4 +1,5 @@
 export function a(): number {
-  return 1;
+  return 2;
+  // note
 }
 export const K = 1;
@@ -10,3 +11,2 @@
 export function b(): number {
-  return 3;
 }
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -1,1 +1,1 @@
-old
+new
`;

describe('parseUnifiedDiff', () => {
  it('extrait fichiers et lignes changées côté nouveau fichier', () => {
    const files = parseUnifiedDiff(DIFF);
    expect(files.map((f) => f.path)).toEqual(['src/a.ts', 'pnpm-lock.yaml']);
    const a = files[0]!;
    expect(a.changedLines).toContain(2);   // return 2;
    expect(a.changedLines).toContain(3);   // // note
    expect(a.changedLines).toContain(11);  // hunk de suppression pure → début côté nouveau
    expect(a.diffText).toContain('diff --git a/src/a.ts');
    expect(a.diffText).not.toContain('pnpm-lock');
  });
  it('sliceDiff ne garde que les hunks qui recouvrent la plage', () => {
    const a = parseUnifiedDiff(DIFF)[0]!;
    const slice = sliceDiff(a, 1, 6);
    expect(slice).toContain('return 2;');
    expect(slice).not.toContain('function b');
  });
});
