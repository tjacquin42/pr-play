import { describe, expect, it } from 'vitest';
import { classifyLayer, readingOrder } from './ordering';

describe('classifyLayer', () => {
  it('classe par chemin', () => {
    expect(classifyLayer('src/shared/types.ts')).toBe('types');
    expect(classifyLayer('src/server/invoices.ts')).toBe('server');
    expect(classifyLayer('server/api/routes.ts')).toBe('api');
    expect(classifyLayer('web/components/Form.tsx')).toBe('ui');
    expect(classifyLayer('src/server/invoices.test.ts')).toBe('tests');
    expect(classifyLayer('README.md')).toBe('other');
  });
});

describe('readingOrder', () => {
  it('trie types → server → … → tests, puis plus-appelé d’abord', () => {
    const order = readingOrder([
      { file: 'src/server/invoices.test.ts', callersCount: 0 }, // 0
      { file: 'src/server/invoices.ts', callersCount: 0 },      // 1 (validateSiret)
      { file: 'src/server/invoices.ts', callersCount: 2 },      // 2 (createInvoice)
      { file: 'src/shared/types.ts', callersCount: 0 },         // 3
    ]);
    expect(order).toEqual([3, 2, 1, 0]);
  });
});
