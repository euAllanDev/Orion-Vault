import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const desktopBootstrapPath = path.join(projectRoot, 'interfaces', 'desktop', 'bootstrap.cjs');
const electronPath = createRequire(import.meta.url)('electron') as string;

let desktopApp: ElectronApplication;
let page: Page;
let tempRoot: string;
let vaultRoot: string;

test.beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'orion-vault-e2e-'));
  vaultRoot = path.join(tempRoot, 'vault');
  const userDataRoot = path.join(tempRoot, 'user-data');
  await fs.mkdir(vaultRoot, { recursive: true });

  desktopApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopBootstrapPath, `--user-data-dir=${userDataRoot}`],
    env: { ...process.env, ORION_VAULT_ROOT: vaultRoot }
  });
  page = await desktopApp.firstWindow();
  await expect(page.locator('#workspaceView')).toHaveClass(/active/);
  await expect(page.locator('#inputDialog')).toBeVisible();
  await page.locator('#inputDialogConfirm').click();
  await expect(page.locator('#inputDialog')).toBeHidden();
});

test.afterEach(async () => {
  await desktopApp?.close().catch(() => undefined);
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('creates and autosaves a note, then keeps the desktop process active in the tray', async () => {
  await page.locator('#newFolderButton').click();
  await expect(page.locator('#inputDialog')).toBeVisible();
  await page.locator('#inputDialogInput').fill('E2E Folder');
  await page.locator('#inputDialogConfirm').click();

  await page.locator('#newNoteButton').click();
  await expect(page.locator('#inputDialog')).toBeVisible();
  await page.locator('#inputDialogInput').fill('E2E note');
  await page.locator('#inputDialogConfirm').click();

  const folderPath = 'E2E Folder';
  const notePath = `${folderPath}/e2e-note.md`;
  await expect(page.locator(`.file-item[data-path="${notePath}"]`)).toBeVisible();

  await page.locator('#treeFilterInput').fill('e2e folder');
  await expect(page.locator(`.folder[data-path="${folderPath}"]`)).toBeVisible();
  await expect(page.locator('#treeFilterResultCount')).toHaveText('1 pasta');
  await page.locator('#treeFilterClearButton').click();
  await expect(page.locator('#treeFilterInput')).toHaveValue('');
  await expect(page.locator(`.file-item[data-path="${notePath}"]`)).toBeVisible();

  await page.locator(`.folder[data-path="${folderPath}"] summary`).click({ button: 'right' });
  await page.getByRole('button', { name: 'Filtrar notas nesta pasta' }).click();
  await expect(page.locator('#inputDialog')).toBeVisible();
  await page.locator('#inputDialogInput').fill('e2e note');
  await page.locator('#inputDialogConfirm').click();
  await expect(page.locator('#treeFilterResultCount')).toHaveText('1 nota');
  await expect(page.locator(`.file-item[data-path="${notePath}"]`)).toBeVisible();

  await page.locator('#noteEditorSurface').fill('Conteúdo salvo pelo teste E2E.');

  const savedNotePath = path.join(vaultRoot, folderPath, 'e2e-note.md');
  await expect.poll(async () => fs.readFile(savedNotePath, 'utf8').catch(() => ''), { timeout: 10_000 })
    .toContain('Conteúdo salvo pelo teste E2E.');

  await page.locator('#windowCloseButton').click();
  await expect.poll(() => desktopApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? true))
    .toBe(false);

  await desktopApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show());
  await expect.poll(() => desktopApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false))
    .toBe(true);
});
