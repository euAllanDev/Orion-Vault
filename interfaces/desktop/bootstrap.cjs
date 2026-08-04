const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const desktopMainPath = path.join(path.dirname(require.resolve('./bootstrap.cjs')), '..', '..', 'dist', 'desktop', 'main.js');

if (!fs.existsSync(desktopMainPath)) {
  globalThis.console.error(`Desktop build not found: ${desktopMainPath}`);
  globalThis.console.error('Run `pnpm build` before starting the desktop shell.');
  globalThis.process.exitCode = 1;
} else {
  import(pathToFileURL(desktopMainPath).href).catch((error) => {
    globalThis.console.error('Failed to start desktop main process', error);
    globalThis.process.exitCode = 1;
  });
}
