import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'html']
    }
  }
});
