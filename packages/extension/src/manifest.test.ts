import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';

describe('manifest MV3', () => {
  it('a les permissions et cibles attendues', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.host_permissions).toContain('http://127.0.0.1:7777/*');
    expect(manifest.content_scripts[0]!.matches).toContain('https://github.com/*/*/pull/*');
  });
});
