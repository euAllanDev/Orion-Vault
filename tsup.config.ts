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
    outExtension: () => ({ js: '.mjs' }),
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
  },
  {
    entry: ['interfaces/mcp/server.ts', 'interfaces/mcp/http-server.ts'],
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    sourcemap: true,
    clean: false,
    dts: false,
    outExtension: () => ({ js: '.mjs' }),
    outDir: 'dist/mcp'
  }
]);
