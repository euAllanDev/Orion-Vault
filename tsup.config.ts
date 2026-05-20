import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['interfaces/cli/main.ts'],
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    sourcemap: true,
    clean: true,
    dts: false,
    outDir: 'dist/cli'
  },
  {
    entry: ['interfaces/desktop/main.ts'],
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    external: ['electron'],
    sourcemap: true,
    clean: false,
    dts: false,
    outDir: 'dist/desktop'
  }
]);
