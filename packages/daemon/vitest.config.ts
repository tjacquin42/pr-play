import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/fixtures/**', '**/node_modules/**'],
    coverage: { provider: 'v8', include: ['src/**'], reporter: ['text', 'json'], thresholds: { lines: 80 } },
  },
});
