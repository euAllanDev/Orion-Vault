import { app, BrowserWindow, Notification, ipcMain, session } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAppConfig } from '../../infra/config/app-config';
import { NodeVaultWorkspace } from '../../infra/filesystem/workspace/node-vault-workspace';
import { startWebServer } from '../web/server';

const desktopShell = {
  appName: 'Marika',
  title: 'Marika Desktop',
  defaultWindow: {
    width: 1400,
    height: 920,
    minWidth: 1120,
    minHeight: 760
  },
  shellType: 'electron',
  localFirst: true,
  internetRequired: false
} as const;

const preloadPath = fileURLToPath(new URL('./preload.cjs', import.meta.url));
const agendaReminderSoundPath = 'C:\\Users\\as409\\Marika\\sounds\\notificacao_lembrete_premium_leve (online-audio-converter.com).mp3';
const appConfig = loadAppConfig();

function getDesktopVaultRoot(): string {
  return appConfig.vaultRoot;
}

function getActiveDesktopVaultRoot(): string {
  return desktopWebOptions.activeVaultRoot ?? getDesktopVaultRoot();
}

const desktopWorkspace = new NodeVaultWorkspace();
const desktopWebOptions: { desktopSessionPath?: string; activeVaultRoot?: string } = {
  activeVaultRoot: getDesktopVaultRoot()
};

let mainWindow: BrowserWindow | null = null;
let webServer: Awaited<ReturnType<typeof startWebServer>>['server'] | null = null;
let desktopUrl = 'http://127.0.0.1:4173';
let desktopPort = 4173;
const appRoot = path.resolve(process.cwd());
let desktopWindowReady = false;

app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function getDesktopSessionPath(): string {
  return path.join(app.getPath('userData'), 'desktop-session.json');
}

async function normalizeDesktopSessionFile(sessionPath: string, vaultRoot = getDesktopVaultRoot()): Promise<string> {
  let pinnedPaths: string[] = [];
  let existingVaultRoot = '';

  try {
    const raw = await fs.readFile(sessionPath, 'utf8');
    const parsed = JSON.parse(raw) as { pinnedPaths?: unknown; vaultRoot?: unknown };
    if (typeof parsed.vaultRoot === 'string') {
      existingVaultRoot = String(parsed.vaultRoot).trim();
    }
    if (Array.isArray(parsed.pinnedPaths)) {
      pinnedPaths = parsed.pinnedPaths.map((value) => String(value).replace(/\\/g, '/').trim()).filter(Boolean);
    }
  } catch {
    pinnedPaths = [];
  }

  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  const nextVaultRoot = String(vaultRoot || existingVaultRoot || getDesktopVaultRoot()).trim();
  await fs.writeFile(sessionPath, JSON.stringify({ vaultRoot: nextVaultRoot, pinnedPaths }, null, 2), 'utf8');
  return nextVaultRoot;
}

async function readDesktopSessionVaultRoot(sessionPath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(sessionPath, 'utf8');
    const parsed = JSON.parse(raw) as { vaultRoot?: unknown };
    return typeof parsed.vaultRoot === 'string' ? String(parsed.vaultRoot).trim() || null : null;
  } catch {
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getAgendaReminderSoundDataUrl(): Promise<string | null> {
  const candidates = [
    agendaReminderSoundPath,
    path.join(appRoot, 'sounds', 'notificacao_lembrete_premium_leve.wav')
  ];

  for (const soundPath of candidates) {
    if (!(await fileExists(soundPath))) continue;

    const data = await fs.readFile(soundPath);
    const ext = path.extname(soundPath).toLowerCase();
    const mime = ext === '.wav' ? 'audio/wav' : 'audio/mpeg';
    return `data:${mime};base64,${data.toString('base64')}`;
  }

  return null;
}

function createWindow(): BrowserWindow {
  const startupUrl = new URL(desktopUrl);
  startupUrl.searchParams.set('shell', 'desktop');
  startupUrl.searchParams.set('vaultRoot', getActiveDesktopVaultRoot());

  const window = new BrowserWindow({
    width: desktopShell.defaultWindow.width,
    height: desktopShell.defaultWindow.height,
    minWidth: desktopShell.defaultWindow.minWidth,
    minHeight: desktopShell.defaultWindow.minHeight,
    backgroundColor: '#141518',
    title: desktopShell.title,
    show: false,
    titleBarStyle: 'default',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  window.loadURL(startupUrl.toString()).catch((error) => {
    console.error('Failed to load Marika desktop UI', error);
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

async function waitForWorkspaceReady(window: BrowserWindow, timeoutMs = 10000): Promise<void> {
  const startedAt = Date.now();

  while (!window.isDestroyed() && Date.now() - startedAt < timeoutMs) {
    try {
      const ready = await window.webContents.executeJavaScript(`(() => {
        const body = document.body;
        const workspaceEmpty = document.getElementById('workspaceEmpty');
        return Boolean(body && body.dataset.view === 'workspace' && body.dataset.desktopReady === 'true' && workspaceEmpty && !workspaceEmpty.classList.contains('active'));
      })()`, true);

      if (ready) {
        window.show();
        window.focus();
        return;
      }
    } catch {
      // keep waiting until the web app is ready
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  if (!window.isDestroyed()) {
    window.show();
  }
}

function revealDesktopWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !desktopWindowReady) return;
  mainWindow.show();
  mainWindow.focus();
}

function openPowerShellInDirectory(cwd: string, vaultRoot: string): void {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  const powerShellPath = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const startupScript = path.join(appRoot, 'scripts', 'start-ai-terminal.ps1');
  const wtCommand = ['new-tab', '--title', 'Marika AI', '--startingDirectory', cwd, 'powershell.exe', '-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', startupScript, '-AppRoot', appRoot, '-VaultRoot', vaultRoot];
  const env = { ...process.env, MARIKA_VAULT_ROOT: vaultRoot };

  const tryWindowsTerminal = (): boolean => {
    try {
      const wt = spawn('wt.exe', wtCommand, {
        cwd,
        env,
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });

      wt.on('error', (error) => {
        console.error('Failed to open AI terminal with wt.exe', error);
      });

      wt.unref();
      return true;
    } catch (error) {
      console.error('Failed to spawn wt.exe', error);
      return false;
    }
  };

  const tryPowerShell = (): boolean => {
    try {
      const child = spawn(powerShellPath, ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', startupScript, '-AppRoot', appRoot, '-VaultRoot', vaultRoot], {
        cwd,
        env,
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });

      child.on('error', (error) => {
        console.error('Failed to open AI terminal', error);
      });

      child.unref();
      return true;
    } catch (error) {
      console.error('Failed to spawn PowerShell', error);
      return false;
    }
  };

  if (!tryWindowsTerminal()) {
    void tryPowerShell();
  }
}

ipcMain.handle('ai-terminal:open', (_event, _requestedVaultRoot?: string) => {
  const vaultRoot = String(_requestedVaultRoot ?? '').trim() || getActiveDesktopVaultRoot();
  openPowerShellInDirectory(vaultRoot, vaultRoot);
  return { cwd: vaultRoot, vaultRoot };
});

ipcMain.handle('agenda:notify', async (_event, payload?: { title?: string; body?: string }) => {
  const title = String(payload?.title ?? 'Lembrete');
  const body = String(payload?.body ?? '');
  const soundDataUrl = await getAgendaReminderSoundDataUrl();
  if (soundDataUrl) {
    mainWindow?.webContents.send('agenda:notify-sound', { src: soundDataUrl });
  }
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: true }).show();
  }
  return { ok: true };
});

ipcMain.handle('agenda:play-sound', async () => {
  const soundDataUrl = await getAgendaReminderSoundDataUrl();
  if (soundDataUrl) {
    mainWindow?.webContents.send('agenda:notify-sound', { src: soundDataUrl });
  }
  return { ok: true };
});

ipcMain.handle('agenda:create', async (_event, payload?: { vaultRoot?: string; path?: string; content?: string }) => {
  const vaultRoot = String(payload?.vaultRoot ?? '').trim() || getActiveDesktopVaultRoot();
  const filePath = String(payload?.path ?? '').trim();
  const content = String(payload?.content ?? '');

  if (!vaultRoot) {
    throw new Error('Vault root is required');
  }

  if (!filePath) {
    throw new Error('Agenda path is required');
  }

  desktopWebOptions.activeVaultRoot = vaultRoot;
  await normalizeDesktopSessionFile(getDesktopSessionPath(), vaultRoot);
  await desktopWorkspace.createMarkdownFile(vaultRoot, filePath, content);
  mainWindow?.webContents.send('agenda:saved', { vaultRoot, path: filePath });
  mainWindow?.webContents.send('vault:changed', { vaultRoot, path: filePath, kind: 'agenda' });
  return { ok: true, vaultRoot, path: filePath };
});

ipcMain.handle('vault:activate', async (_event, vaultRoot?: string) => {
  const nextVaultRoot = String(vaultRoot ?? '').trim() || getActiveDesktopVaultRoot();
  desktopWebOptions.activeVaultRoot = nextVaultRoot;
  await normalizeDesktopSessionFile(getDesktopSessionPath(), nextVaultRoot);
  return { ok: true, vaultRoot: nextVaultRoot };
});

ipcMain.on('desktop:ready', (event) => {
  if (mainWindow && event.sender.id === mainWindow.webContents.id) {
    desktopWindowReady = true;
    revealDesktopWindow();
  }
});

async function startDesktop(): Promise<void> {
  const sessionPath = getDesktopSessionPath();
  await session.defaultSession.clearCache();
  const persistedVaultRoot = await readDesktopSessionVaultRoot(sessionPath);
  desktopWebOptions.activeVaultRoot = await normalizeDesktopSessionFile(sessionPath, persistedVaultRoot ?? desktopWebOptions.activeVaultRoot ?? getDesktopVaultRoot());
  desktopWebOptions.desktopSessionPath = sessionPath;
  const started = await startWebServer(0, desktopWebOptions);
  webServer = started.server;
  desktopUrl = `http://127.0.0.1:${started.port}`;
  desktopPort = started.port;
  desktopWindowReady = false;
  mainWindow = createWindow();
  const window = mainWindow;

  window?.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (!desktopWindowReady && window && !window.isDestroyed()) {
        window.show();
      }
    }, 15000);
  });
}

app.setName(desktopShell.appName);

app.whenReady().then(() => {
  void startDesktop();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void startDesktop();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void webServer?.close();
    app.quit();
  }
});

export type DesktopShellConfig = typeof desktopShell;
