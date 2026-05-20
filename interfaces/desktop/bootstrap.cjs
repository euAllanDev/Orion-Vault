const path = require('node:path');
const { pathToFileURL } = require('node:url');

const desktopMainPath = path.join(__dirname, '..', '..', 'dist', 'desktop', 'main.js');

import(pathToFileURL(desktopMainPath).href).catch((error) => {
  console.error('Failed to start desktop main process', error);
  process.exitCode = 1;
});
