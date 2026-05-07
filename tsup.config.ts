import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['interfaces/cli/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  dts: false,
  outDir: 'dist'
});
