const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const desktopMainPath = path.join(__dirname, '..', '..', 'dist', 'desktop', 'main.js');

if (!fs.existsSync(desktopMainPath)) {
  console.error(`Desktop build not found: ${desktopMainPath}`);
  console.error('Run `pnpm build` before starting the desktop shell.');
  process.exitCode = 1;
} else {
  import(pathToFileURL(desktopMainPath).href).catch((error) => {
    console.error('Failed to start desktop main process', error);
    process.exitCode = 1;
  });
}
