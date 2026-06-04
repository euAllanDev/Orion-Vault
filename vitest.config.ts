import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/release/**', '**/release-test/**'],
    globals: true,
    coverage: {
      reporter: ['text', 'html']
    }
  }
});
