import { app, BrowserWindow, Menu, Notification, Tray, ipcMain, session, shell } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, watch, type FSWatcher } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAppConfig } from '../../infra/config/app-config';
import { NodeNoteReader } from '../../infra/filesystem/readers/node-note-reader';
import { NodeVaultWorkspace } from '../../infra/filesystem/workspace/node-vault-workspace';
import { buildOrionAiOnboarding } from '../../application/ai/skills/skill-catalog';
import { startWebServer } from '../web/server';
import { createAiTerminalOpenHandler, selectLinuxTerminal } from './ai-terminal';

const desktopShell = {
  appId: 'com.orionvault.desktop',
  appName: 'Orion Vault',
  title: 'Orion Vault Desktop',
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

const startupLogPath = path.join(process.env.TEMP ?? process.cwd(), 'orion-vault-desktop-startup.log');

async function logStartup(message: string): Promise<void> {
  try {
    await fs.appendFile(startupLogPath, `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch {
    // Logging must never block startup.
  }
}

const preloadPath = fileURLToPath(new URL('../../interfaces/desktop/preload.cjs', import.meta.url));
const agendaReminderSoundPath = path.join(app.getAppPath(), 'sounds', 'notificacao_lembrete_premium_leve (online-audio-converter.com).mp3');
const desktopNotificationIconCandidates = [
  path.join(process.resourcesPath, 'build', 'icon.ico'),
  path.join(app.getAppPath(), 'build', 'icon.ico'),
  path.join(app.getAppPath(), '..', '..', 'build', 'icon.ico')
];
const appConfig = loadAppConfig();
const agendaFolderPath = 'Agenda';
const agendaReminderPollMs = 60_000;
const agendaReminderGraceMs = 5 * 60 * 1000;
const agendaOpenSummaryThrottleMs = 2 * 60 * 1000;

type AgendaReminderWindow = '1d' | '1h' | 'now';

type AgendaReminderState = {
  notifiedKeys: string[];
};

type AgendaReminderItem = {
  path: string;
  title: string;
  due: string;
  status: 'pending' | 'done' | 'overdue';
};

type AgendaReminderPollOptions = {
  catchUp: boolean;
};

type MarkdownOpenRequest = {
  absolutePath: string;
  vaultRoot: string;
  relativePath: string;
};

function getDesktopVaultRoot(): string {
  return appConfig.vaultRoot;
}

function getActiveDesktopVaultRoot(): string {
  return desktopWebOptions.activeVaultRoot ?? getDesktopVaultRoot();
}

function isDesktopAppRoot(candidate: string): boolean {
  return existsSync(path.join(candidate, 'package.json'))
    && existsSync(path.join(candidate, 'dist', 'cli', 'main.mjs'))
    && existsSync(path.join(candidate, 'scripts', process.platform === 'win32' ? 'start-ai-terminal.ps1' : 'start-ai-terminal.sh'));
}

function resolveDesktopAppRoot(): string {
  const rawAppPath = app.getAppPath();
  const candidates = [
    rawAppPath,
    path.resolve(rawAppPath, '..'),
    path.resolve(rawAppPath, '..', '..'),
    process.cwd()
  ];

  return candidates.find((candidate) => isDesktopAppRoot(candidate)) ?? rawAppPath;
}

function resolveAiTerminalRuntimeRoot(): string {
  const unpackedAppRoot = path.join(process.resourcesPath, 'app.asar.unpacked');
  const startupScript = path.join(unpackedAppRoot, 'scripts', process.platform === 'win32' ? 'start-ai-terminal.ps1' : 'start-ai-terminal.sh');
  const compiledCli = path.join(unpackedAppRoot, 'dist', 'cli', 'main.mjs');

  return existsSync(startupScript) && existsSync(compiledCli) ? unpackedAppRoot : appRoot;
}

function resolveNodeRuntimePath(): string {
  const configured = String(process.env.ORION_NODE_PATH ?? '').trim();
  if (configured && existsSync(configured)) {
    return configured;
  }

  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  const args = process.platform === 'win32' ? ['node.exe'] : ['node'];
  try {
    const result = spawnSync(command, args, {
      cwd: app.getPath('home'),
      env: process.env,
      windowsHide: true,
      encoding: 'utf8'
    });
    const firstMatch = String(result.stdout ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (firstMatch && existsSync(firstMatch)) {
      return firstMatch;
    }
  } catch {
    // Fall back to PowerShell Get-Command when the desktop shell opens.
  }

  return '';
}

function resolveAgentPath(commandName: 'opencode' | 'claude'): string {
  if (process.platform !== 'win32') {
    try {
      const result = spawnSync('which', [commandName], {
        cwd: app.getPath('home'),
        env: process.env,
        encoding: 'utf8'
      });
      const commandPath = String(result.stdout ?? '').trim();
      return commandPath && existsSync(commandPath) ? commandPath : '';
    } catch {
      return '';
    }
  }

  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  const powerShellPath = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

  try {
    const result = spawnSync(powerShellPath, [
      '-NoProfile',
      '-Command',
      `$command = Get-Command ${commandName} -ErrorAction SilentlyContinue; if ($command) { $command.Source }`
    ], {
      cwd: app.getPath('home'),
      env: process.env,
      windowsHide: true,
      encoding: 'utf8'
    });
    const commandPath = String(result.stdout ?? '').trim();
    return commandPath && existsSync(commandPath) ? commandPath : '';
  } catch {
    return '';
  }
}

function buildAgentPrompt(vaultRoot: string): string {
  const onboarding = buildOrionAiOnboarding();
  return [
    'Voce esta no Modo dev do Orion Vault.',
    `Vault ativo: ${vaultRoot}`,
    'Use o executavel `orion` para capacidades do produto; ele esta no PATH desta sessao e dos shells filhos.',
    'Execute primeiro `orion /start`, depois `orion /route-intent --query "<pedido>"` se escopo estiver ambiguo e `orion /skills` para catalogo.',
    'Prefira comandos Orion para leitura, busca, escrita e organizacao quando existir equivalente. Nao trate vault como repositorio do app.',
    'Priorize leitura e planejamento antes de mutacao. Use `orion /apply` somente com previewId valido.',
    ...onboarding.policyLines
  ].join('\n');
}

const desktopWorkspace = new NodeVaultWorkspace();
const noteReader = new NodeNoteReader();
const desktopWebOptions: { desktopSessionPath?: string; activeVaultRoot?: string; desktopSessionToken: string } = {
  activeVaultRoot: getDesktopVaultRoot(),
  desktopSessionToken: randomBytes(32).toString('base64url')
};

let mainWindow: BrowserWindow | null = null;
let webServer: Awaited<ReturnType<typeof startWebServer>>['server'] | null = null;
let desktopUrl = 'http://127.0.0.1:4173';
const appRoot = resolveDesktopAppRoot();
const aiTerminalRuntimeRoot = resolveAiTerminalRuntimeRoot();
const nodeRuntimePath = resolveNodeRuntimePath();
let desktopWindowReady = false;
let vaultWatcher: FSWatcher | null = null;
let vaultWatcherRoot = '';
let vaultChangeDebounce: NodeJS.Timeout | null = null;
let agendaReminderTimer: NodeJS.Timeout | null = null;
let agendaReminderInFlight = false;
let agendaReminderKeys = new Set<string>();
let lastAgendaOpenSummaryAt = 0;
let isQuitting = false;
let agendaOpenSummaryTimeout: NodeJS.Timeout | null = null;
let tray: Tray | null = null;
let trayHintShown = false;

function markdownOpenRequestFromArgs(args: string[]): MarkdownOpenRequest | null {
  for (const value of args) {
    const candidate = String(value ?? '').trim();
    if (!candidate || !/\.(md|markdown)$/i.test(candidate)) continue;
    const absolutePath = path.resolve(candidate);
    if (!existsSync(absolutePath)) continue;
    return {
      absolutePath,
      vaultRoot: path.dirname(absolutePath),
      relativePath: path.basename(absolutePath)
    };
  }

  return null;
}

let pendingMarkdownOpen = markdownOpenRequestFromArgs(process.argv);

app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

process.on('uncaughtException', (error) => {
  void logStartup(`uncaughtException ${(error instanceof Error ? error.stack || error.message : String(error))}`);
});

process.on('unhandledRejection', (reason) => {
  void logStartup(`unhandledRejection ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
});

function getDesktopSessionPath(): string {
  return path.join(app.getPath('userData'), 'desktop-session.json');
}

function getAgendaReminderStatePath(): string {
  return path.join(app.getPath('userData'), 'agenda-reminders.json');
}

function normalizeApiPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function parseFrontmatter(content: string): { fields: Record<string, string> } {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { fields: {} };
  }

  const fields: Record<string, string> = {};
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === '---') break;

    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;

    const key = String(match[1] ?? '').toLowerCase();
    const value = String(match[2] ?? '').trim().replace(/^['"`]|['"`]$/g, '');
    fields[key] = value;
  }

  return { fields };
}

function normalizeAgendaStatus(value: string): 'pending' | 'done' | 'overdue' {
  const normalized = value.trim().toLowerCase();
  if (['done', 'completed', 'complete', 'concluida', 'concluída', 'concluido', 'concluído'].includes(normalized)) {
    return 'done';
  }

  if (normalized === 'overdue' || normalized === 'atrasado' || normalized === 'em atraso') {
    return 'overdue';
  }

  return 'pending';
}

function agendaNotificationKey(item: AgendaReminderItem, windowKey: AgendaReminderWindow): string {
  return `${item.path}|${windowKey}|${item.due}`;
}

function agendaReminderTargetTime(dueMs: number, windowKey: AgendaReminderWindow): number {
  if (windowKey === '1d') return dueMs - (24 * 60 * 60 * 1000);
  if (windowKey === '1h') return dueMs - (60 * 60 * 1000);
  return dueMs;
}

function agendaReminderPayload(item: AgendaReminderItem, windowKey: AgendaReminderWindow): { title: string; body: string } {
  const dueLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.due));
  if (windowKey === '1d') return { title: 'Lembrete em 1 dia', body: `${item.title} vence em ${dueLabel}` };
  if (windowKey === '1h') return { title: 'Lembrete em 1 hora', body: `${item.title} vence em ${dueLabel}` };
  return { title: 'Prazo agora', body: `${item.title} vence em ${dueLabel}` };
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function agendaOpenSummaryPayload(items: AgendaReminderItem[]): { title: string; body: string } | null {
  const pendingItems = items.filter((item) => item.status !== 'done');
  if (pendingItems.length === 0) return null;

  const overdueItems = pendingItems.filter((item) => item.status === 'overdue');
  if (overdueItems.length > 0) {
    return {
      title: 'Agenda com itens em atraso',
      body: overdueItems.length === 1
        ? 'Voce tem 1 nota em atraso para revisar.'
        : `Voce tem ${overdueItems.length} notas em atraso para revisar.`
    };
  }

  const now = new Date();
  const todayItems = pendingItems.filter((item) => isSameLocalDay(new Date(item.due), now));
  if (todayItems.length > 0) {
    return {
      title: 'Agenda de hoje',
      body: todayItems.length === 1
        ? 'Voce tem 1 nota importante para hoje.'
        : `Voce tem ${todayItems.length} notas importantes para hoje.`
    };
  }

  return {
    title: 'Agenda ativa',
    body: pendingItems.length === 1
      ? 'Voce tem 1 nota pendente na agenda.'
      : `Voce tem ${pendingItems.length} notas pendentes na agenda.`
  };
}

function shouldDispatchAgendaReminder(nowMs: number, dueMs: number, windowKey: AgendaReminderWindow): boolean {
  const targetMs = agendaReminderTargetTime(dueMs, windowKey);
  return nowMs >= targetMs && nowMs < targetMs + agendaReminderGraceMs;
}

function pickCatchUpAgendaReminderWindow(nowMs: number, dueMs: number): AgendaReminderWindow | null {
  if (nowMs >= dueMs) return 'now';
  if (nowMs >= dueMs - (60 * 60 * 1000)) return '1h';
  if (nowMs >= dueMs - (24 * 60 * 60 * 1000)) return '1d';
  return null;
}

function collectImmediateAgendaReminderWindows(nowMs: number, dueMs: number): readonly AgendaReminderWindow[] {
  const windows: AgendaReminderWindow[] = [];
  for (const windowKey of ['1d', '1h', 'now'] as AgendaReminderWindow[]) {
    if (shouldDispatchAgendaReminder(nowMs, dueMs, windowKey)) {
      windows.push(windowKey);
    }
  }
  return windows;
}

async function suppressImmediateAgendaRemindersForCreatedNote(filePath: string, content: string): Promise<void> {
  const normalizedPath = normalizeApiPath(filePath);
  const { fields } = parseFrontmatter(content);
  const dueValue = String(fields.due ?? fields.date ?? '').trim();
  if (!dueValue) return;

  const due = new Date(dueValue);
  const dueMs = due.getTime();
  if (Number.isNaN(dueMs)) return;

  const nowMs = Date.now();
  for (const windowKey of collectImmediateAgendaReminderWindows(nowMs, dueMs)) {
    agendaReminderKeys.add(`${normalizedPath}|${windowKey}|${due.toISOString()}`);
  }
  await writeAgendaReminderState();
}

async function readAgendaReminderState(): Promise<void> {
  try {
    const raw = await fs.readFile(getAgendaReminderStatePath(), 'utf8');
    const parsed = JSON.parse(raw) as AgendaReminderState;
    agendaReminderKeys = new Set(Array.isArray(parsed.notifiedKeys) ? parsed.notifiedKeys.map((value) => String(value)) : []);
  } catch {
    agendaReminderKeys = new Set();
  }
}

async function writeAgendaReminderState(): Promise<void> {
  const reminderPath = getAgendaReminderStatePath();
  await fs.mkdir(path.dirname(reminderPath), { recursive: true });
  await fs.writeFile(reminderPath, JSON.stringify({ notifiedKeys: [...agendaReminderKeys] }, null, 2), 'utf8');
}

async function listAgendaReminderItems(vaultRoot: string): Promise<AgendaReminderItem[]> {
  const normalizedVaultRoot = String(vaultRoot ?? '').trim();
  if (!normalizedVaultRoot) return [];
  if (!(await fileExists(normalizedVaultRoot))) return [];

  const notes = await noteReader.listNotes(normalizedVaultRoot);
  return notes
    .filter((note) => normalizeApiPath(note.relativePath).startsWith(`${agendaFolderPath}/`))
    .map((note) => {
      const { fields } = parseFrontmatter(note.content);
      const dueValue = String(fields.due ?? fields.date ?? '').trim();
      if (!dueValue) return null;

      const due = new Date(dueValue);
      if (Number.isNaN(due.getTime())) return null;

      const storedStatus = normalizeAgendaStatus(fields.status ?? 'pending');
      const isOverdue = storedStatus !== 'done' && due.getTime() < Date.now();
      return {
        path: normalizeApiPath(note.relativePath),
        title: note.title ?? path.basename(note.relativePath, path.extname(note.relativePath)),
        due: due.toISOString(),
        status: isOverdue ? 'overdue' : storedStatus
      } satisfies AgendaReminderItem;
    })
    .filter((item): item is AgendaReminderItem => Boolean(item));
}

async function dispatchAgendaReminder(payload: { title: string; body: string }): Promise<void> {
  const soundDataUrl = await getAgendaReminderSoundDataUrl();
  if (soundDataUrl && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agenda:notify-sound', { src: soundDataUrl });
  }

  void logStartup(`agendaNotification.dispatch supported=${Notification.isSupported()} title=${payload.title}`);

  if (Notification.isSupported()) {
    const notification = new Notification({
      title: payload.title,
      body: payload.body,
      silent: true,
      icon: getDesktopNotificationIconPath(),
      timeoutType: 'default',
      closeButtonText: 'Fechar'
    });

    notification.on('click', () => {
      openAgendaFromNotification();
    });

    notification.show();
  }
}

function getDesktopNotificationIconPath(): string | undefined {
  for (const candidate of desktopNotificationIconCandidates) {
    if (existsSync(candidate)) return candidate;
  }

  return undefined;
}

function openAgendaFromNotification(): void {
  const showAgenda = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('agenda:open-from-notification');
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (desktopWindowReady) {
      showAgenda();
      return;
    }

    mainWindow.webContents.once('did-finish-load', showAgenda);
    mainWindow.show();
    return;
  }

  void startDesktop().then(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (desktopWindowReady) {
      showAgenda();
      return;
    }

    mainWindow.webContents.once('did-finish-load', showAgenda);
  }).catch((error) => {
    void logStartup(`agendaNotification.openAgenda.error ${error instanceof Error ? error.stack || error.message : String(error)}`);
  });
}

function revealDesktopWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

async function openMarkdownFile(request: MarkdownOpenRequest): Promise<void> {
  pendingMarkdownOpen = request;
  desktopWebOptions.activeVaultRoot = request.vaultRoot;
  await normalizeDesktopSessionFile(getDesktopSessionPath(), request.vaultRoot);
  await startVaultWatcher(request.vaultRoot);

  if (!mainWindow || mainWindow.isDestroyed() || !desktopWindowReady) return;

  mainWindow.webContents.send('markdown:open', {
    vaultRoot: request.vaultRoot,
    path: request.relativePath
  });
  pendingMarkdownOpen = null;
  revealDesktopWindow();
}

function notifyTrayLifecycle(): void {
  if (trayHintShown || !Notification.isSupported()) return;
  trayHintShown = true;

  new Notification({
    title: desktopShell.appName,
    body: 'O Orion Vault continua ativo na bandeja para enviar lembretes.',
    icon: getDesktopNotificationIconPath()
  }).show();
}

function createTray(): void {
  if (tray) return;

  const iconPath = getDesktopNotificationIconPath();
  if (!iconPath) {
    void logStartup('tray.unavailable missing-icon');
    return;
  }

  tray = new Tray(iconPath);
  tray.setToolTip(desktopShell.appName);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Orion Vault', click: revealDesktopWindow },
    { label: 'Abrir Agenda', click: openAgendaFromNotification },
    { type: 'separator' },
    { label: 'Lembretes ativos', enabled: false },
    { type: 'separator' },
    { label: 'Sair do Orion Vault', click: () => void quitDesktop() }
  ]));
  tray.on('click', revealDesktopWindow);
  tray.on('double-click', revealDesktopWindow);
}

function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

async function closeWebServer(): Promise<void> {
  const server = webServer;
  webServer = null;
  if (!server) return;

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

async function quitDesktop(): Promise<void> {
  if (isQuitting) return;
  isQuitting = true;
  stopVaultWatcher();
  stopAgendaReminderScheduler();
  if (agendaOpenSummaryTimeout) {
    clearTimeout(agendaOpenSummaryTimeout);
    agendaOpenSummaryTimeout = null;
  }
  await closeWebServer();
  destroyTray();
  app.quit();
}

async function maybeNotifyAgendaOnWindowOpen(force = false): Promise<void> {
  const nowMs = Date.now();
  if (!force && nowMs - lastAgendaOpenSummaryAt < agendaOpenSummaryThrottleMs) return;

  try {
    const items = await listAgendaReminderItems(getActiveDesktopVaultRoot());
    const payload = agendaOpenSummaryPayload(items);
    void logStartup(`agendaOpenSummary.check force=${force} items=${items.length} supported=${Notification.isSupported()}`);
    if (!payload) return;

    lastAgendaOpenSummaryAt = nowMs;
    await dispatchAgendaReminder(payload);
  } catch (error) {
    void logStartup(`agendaOpenSummary.error ${error instanceof Error ? error.stack || error.message : String(error)}`);
  }
}

function scheduleAgendaOpenSummary(force = false, delayMs = 1200): void {
  if (agendaOpenSummaryTimeout) {
    clearTimeout(agendaOpenSummaryTimeout);
    agendaOpenSummaryTimeout = null;
  }

  agendaOpenSummaryTimeout = setTimeout(() => {
    agendaOpenSummaryTimeout = null;
    void maybeNotifyAgendaOnWindowOpen(force);
  }, delayMs);
}

async function pollAgendaReminders(options: AgendaReminderPollOptions = { catchUp: false }): Promise<void> {
  if (agendaReminderInFlight) return;
  agendaReminderInFlight = true;

  try {
    const vaultRoot = getActiveDesktopVaultRoot();
    const items = await listAgendaReminderItems(vaultRoot);
    const nowMs = Date.now();
    let changed = false;

    for (const item of items) {
      if (item.status === 'done') continue;

      const dueMs = new Date(item.due).getTime();
      if (Number.isNaN(dueMs)) continue;

      if (options.catchUp) {
        const catchUpWindow = pickCatchUpAgendaReminderWindow(nowMs, dueMs);
        if (catchUpWindow) {
          const reminderKey = agendaNotificationKey(item, catchUpWindow);
          if (!agendaReminderKeys.has(reminderKey)) {
            agendaReminderKeys.add(reminderKey);
            changed = true;
            await dispatchAgendaReminder(agendaReminderPayload(item, catchUpWindow));
            continue;
          }
        }
      }

      for (const windowKey of ['1d', '1h', 'now'] as AgendaReminderWindow[]) {
        if (!shouldDispatchAgendaReminder(nowMs, dueMs, windowKey)) continue;

        const reminderKey = agendaNotificationKey(item, windowKey);
        if (agendaReminderKeys.has(reminderKey)) continue;

        agendaReminderKeys.add(reminderKey);
        changed = true;
        await dispatchAgendaReminder(agendaReminderPayload(item, windowKey));
      }
    }

    if (changed) {
      await writeAgendaReminderState();
    }
  } catch (error) {
    void logStartup(`agendaReminder.error ${error instanceof Error ? error.stack || error.message : String(error)}`);
  } finally {
    agendaReminderInFlight = false;
  }
}

function ensureAgendaReminderScheduler(): void {
  if (agendaReminderTimer) return;

  agendaReminderTimer = setInterval(() => {
    void pollAgendaReminders();
  }, agendaReminderPollMs);

  void pollAgendaReminders({ catchUp: true });
}

function stopAgendaReminderScheduler(): void {
  if (!agendaReminderTimer) return;
  clearInterval(agendaReminderTimer);
  agendaReminderTimer = null;
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
    show: true,
    ...(process.platform === 'win32' ? {
      frame: false
    } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  window.loadURL(startupUrl.toString()).catch((error) => {
    console.error('Failed to load Orion Vault desktop UI', error);
  });

  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) {
      window.show();
      scheduleAgendaOpenSummary(true, 1600);
    }
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  window.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
    notifyTrayLifecycle();
  });

  window.on('show', () => {
    scheduleAgendaOpenSummary(false, 800);
  });

  window.on('restore', () => {
    scheduleAgendaOpenSummary(false, 800);
  });

  return window;
}

function stopVaultWatcher(): void {
  if (vaultChangeDebounce) {
    clearTimeout(vaultChangeDebounce);
    vaultChangeDebounce = null;
  }

  if (!vaultWatcher) {
    vaultWatcherRoot = '';
    return;
  }

  try {
    vaultWatcher.close();
  } catch {
    // Best effort cleanup only.
  }

  vaultWatcher = null;
  vaultWatcherRoot = '';
}

function emitVaultChanged(vaultRoot: string, filePath?: string, kind = 'external'): void {
  mainWindow?.webContents.send('vault:changed', { vaultRoot, path: filePath, kind });
}

async function startVaultWatcher(vaultRoot: string): Promise<void> {
  const nextVaultRoot = String(vaultRoot ?? '').trim();
  if (!nextVaultRoot) {
    stopVaultWatcher();
    return;
  }

  if (vaultWatcher && vaultWatcherRoot === nextVaultRoot) {
    return;
  }

  stopVaultWatcher();

  try {
    await fs.mkdir(nextVaultRoot, { recursive: true });
    vaultWatcher = watch(nextVaultRoot, { recursive: true }, (_eventType, filename) => {
      const normalizedPath = typeof filename === 'string' ? filename.replace(/\\/g, '/') : '';
      if (vaultChangeDebounce) {
        clearTimeout(vaultChangeDebounce);
      }

      vaultChangeDebounce = setTimeout(() => {
        emitVaultChanged(nextVaultRoot, normalizedPath, 'external');
      }, 150);
    });
    vaultWatcherRoot = nextVaultRoot;
  } catch (error) {
    void logStartup(`vaultWatcher.error ${error instanceof Error ? error.message : String(error)}`);
    stopVaultWatcher();
  }
}

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function resolveAiTerminalStartupScript(): string | null {
  const scriptName = process.platform === 'win32' ? 'start-ai-terminal.ps1' : 'start-ai-terminal.sh';
  const candidates = [
    path.join(aiTerminalRuntimeRoot, 'scripts', scriptName),
    path.join(appRoot, 'scripts', scriptName),
    path.resolve(appRoot, '..', '..', 'scripts', scriptName),
    path.join(process.cwd(), 'scripts', scriptName)
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function buildAiTerminalInlineCommand(vaultRoot: string): string {
  const escapedAppRoot = escapePowerShellLiteral(aiTerminalRuntimeRoot);
  const escapedVaultRoot = escapePowerShellLiteral(vaultRoot);
  const escapedNodePath = escapePowerShellLiteral(nodeRuntimePath);

  return [
    "$ErrorActionPreference = 'Stop'",
    'try { chcp 65001 | Out-Null } catch {}',
    'try { [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch {}',
    `$AppRoot = '${escapedAppRoot}'`,
    `$VaultRoot = '${escapedVaultRoot}'`,
    `$NodePath = '${escapedNodePath}'`,
    "$TsxCliPath = Join-Path $AppRoot 'node_modules/tsx/dist/cli.mjs'",
    "$CliEntryPath = Join-Path $AppRoot 'interfaces/cli/main.ts'",
    "if (-not $NodePath) { $NodeCommand = Get-Command node -ErrorAction SilentlyContinue; if ($NodeCommand) { $NodePath = $NodeCommand.Source } }",
    "if ($VaultRoot) { New-Item -ItemType Directory -Force -Path $VaultRoot | Out-Null }",
    "[Environment]::SetEnvironmentVariable('ORION_VAULT_ROOT', $VaultRoot, 'Process')",
    "if ($VaultRoot) { Set-Location -LiteralPath $VaultRoot } else { Set-Location -LiteralPath $AppRoot }",
    "function orion { param([Parameter(ValueFromRemainingArguments=`$true)][string[]]`$Arguments) & `$NodePath `$TsxCliPath `$CliEntryPath @Arguments }",
    "$OnboardingRaw = (orion /onboarding | Out-String).Trim()",
    "$Onboarding = if ($OnboardingRaw) { $OnboardingRaw | ConvertFrom-Json } else { $null }",
    "Write-Host ''",
    "Write-Host 'Orion Vault AI ready.'",
    "Write-Host 'Orion Vault e um app de notas local-first adaptado para IA e agentes.'",
    "if ($VaultRoot) { Write-Host \"Vault ativo: $VaultRoot\" }",
    "Write-Host 'Helper: orion'",
    "Write-Host ''",
    "Write-Host 'Resumo rapido:'",
    "if ($Onboarding) { foreach ($Line in $Onboarding.commandLines) { Write-Host \"- $Line\" }; Write-Host ''; Write-Host 'Se a pergunta for sobre o app em si: use orion /product-context.'; Write-Host ''; foreach ($Line in $Onboarding.policyLines) { Write-Host \"- $Line\" }; Write-Host ''; Write-Host $Onboarding.statusText } else { Write-Host '- orion /start'; Write-Host '- orion /guide'; Write-Host '- orion /skills'; Write-Host '- orion /context'; Write-Host '- orion /preview'; Write-Host '- orion /apply --preview-id <id>' }"
  ].join('; ');
}

function openPowerShellInDirectory(cwd: string, vaultRoot: string, options: { openCodePath?: string; claudeCodePath?: string; agentPrompt?: string } = {}): void {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  const powerShellPath = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const startupScript = resolveAiTerminalStartupScript();
  const shellArgs = startupScript
    ? [
      '-NoLogo',
      '-NoExit',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      startupScript,
      '-AppRoot',
      aiTerminalRuntimeRoot,
      '-VaultRoot',
      vaultRoot,
      '-NodePath',
      nodeRuntimePath,
      ...(options.openCodePath ? ['-OpenCodePath', options.openCodePath] : []),
      ...(options.claudeCodePath ? ['-ClaudeCodePath', options.claudeCodePath] : [])
    ]
    : ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', buildAiTerminalInlineCommand(vaultRoot)];
  const wtCommand = ['new-tab', '--title', 'Orion Vault AI', '--startingDirectory', cwd, 'powershell.exe', ...shellArgs];
  const inheritedPath = process.env.Path ?? process.env.PATH ?? '';
  const env = {
    ...process.env,
    ORION_VAULT_ROOT: vaultRoot,
    ORION_APP_ROOT: aiTerminalRuntimeRoot,
    ORION_NODE_PATH: nodeRuntimePath,
    Path: `${path.join(aiTerminalRuntimeRoot, 'scripts')};${inheritedPath}`,
    ...(options.agentPrompt ? { ORION_AGENT_PROMPT: options.agentPrompt } : {})
  };

  const hasWindowsTerminal = (): boolean => {
    try {
      const result = spawnSync('where.exe', ['wt.exe'], {
        cwd,
        env,
        stdio: 'ignore',
        windowsHide: true
      });
      return result.status === 0;
    } catch {
      return false;
    }
  };

  const tryWindowsTerminal = (): boolean => {
    if (!hasWindowsTerminal()) {
      return false;
    }

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
      const child = spawn(powerShellPath, shellArgs, {
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

function isLinuxCommandAvailable(command: string): boolean {
  if (path.isAbsolute(command)) return existsSync(command);
  try {
    return spawnSync('which', [command], { env: process.env, stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}

function openLinuxTerminalInDirectory(cwd: string, vaultRoot: string, options: { openCodePath?: string; claudeCodePath?: string; agentPrompt?: string } = {}): void {
  const startupScript = resolveAiTerminalStartupScript();
  if (!startupScript) {
    throw new Error('Launcher Linux indisponivel. Reinstale o aplicativo.');
  }

  const terminal = selectLinuxTerminal(process.env.TERMINAL, isLinuxCommandAvailable);
  if (!terminal) {
    throw new Error('Nenhum terminal compativel foi encontrado. Instale x-terminal-emulator, gnome-terminal, konsole ou xfce4-terminal, ou configure TERMINAL.');
  }

  const launcherArgs = [
    startupScript,
    '--app-root', aiTerminalRuntimeRoot,
    '--vault-root', vaultRoot,
    '--node-path', nodeRuntimePath || 'node',
    ...(options.openCodePath ? ['--opencode-path', options.openCodePath] : []),
    ...(options.claudeCodePath ? ['--claude-code-path', options.claudeCodePath] : []),
    ...(options.agentPrompt ? ['--agent-prompt', options.agentPrompt] : [])
  ];
  const terminalArgs = terminal === 'gnome-terminal'
    ? ['--working-directory', cwd, '--', ...launcherArgs]
    : terminal === 'konsole'
      ? ['--workdir', cwd, '-e', ...launcherArgs]
      : terminal === 'xfce4-terminal'
        ? ['--working-directory', cwd, '--execute', ...launcherArgs]
        : ['-e', ...launcherArgs];
  const env = {
    ...process.env,
    ORION_VAULT_ROOT: vaultRoot,
    ORION_APP_ROOT: aiTerminalRuntimeRoot,
    ORION_NODE_PATH: nodeRuntimePath || 'node',
    PATH: `${path.join(aiTerminalRuntimeRoot, 'scripts')}:${process.env.PATH ?? ''}`,
    ...(options.agentPrompt ? { ORION_AGENT_PROMPT: options.agentPrompt } : {})
  };

  const child = spawn(terminal, terminalArgs, { cwd, env, detached: true, stdio: 'ignore' });
  child.once('error', (error) => console.error(`Failed to open Linux terminal ${terminal}`, error));
  child.unref();
}

function openAiTerminalInDirectory(cwd: string, vaultRoot: string, options: { openCodePath?: string; claudeCodePath?: string; agentPrompt?: string } = {}): void {
  if (process.platform === 'win32') {
    openPowerShellInDirectory(cwd, vaultRoot, options);
    return;
  }
  if (process.platform === 'linux') {
    openLinuxTerminalInDirectory(cwd, vaultRoot, options);
    return;
  }
  throw new Error('Modo dev indisponivel nesta plataforma.');
}

ipcMain.handle('ai-terminal:open', createAiTerminalOpenHandler({
  getActiveDesktopVaultRoot,
  openAiTerminal: openAiTerminalInDirectory
}));

ipcMain.handle('ai-opencode:open', createAiTerminalOpenHandler({
  getActiveDesktopVaultRoot,
  openAiTerminal: (cwd, vaultRoot) => {
    const openCodePath = resolveAgentPath('opencode');
    if (!openCodePath) {
      throw new Error('OpenCode nao encontrado. Instale-o ou abra Terminal Orion.');
    }

    openAiTerminalInDirectory(cwd, vaultRoot, {
      openCodePath,
      agentPrompt: buildAgentPrompt(vaultRoot)
    });
  }
}));

ipcMain.handle('ai-claude-code:open', createAiTerminalOpenHandler({
  getActiveDesktopVaultRoot,
  openAiTerminal: (cwd, vaultRoot) => {
    const claudeCodePath = resolveAgentPath('claude');
    if (!claudeCodePath) {
      throw new Error('Claude Code nao encontrado. Instale-o ou abra Terminal Orion.');
    }

    openAiTerminalInDirectory(cwd, vaultRoot, {
      claudeCodePath,
      agentPrompt: buildAgentPrompt(vaultRoot)
    });
  }
}));

ipcMain.handle('agenda:notify', async (_event, payload?: { title?: string; body?: string }) => {
  const title = String(payload?.title ?? 'Lembrete');
  const body = String(payload?.body ?? '');
  await dispatchAgendaReminder({ title, body });
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
  const vaultRoot = getActiveDesktopVaultRoot();
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
  await suppressImmediateAgendaRemindersForCreatedNote(filePath, content);
  mainWindow?.webContents.send('agenda:saved', { vaultRoot, path: filePath });
  emitVaultChanged(vaultRoot, filePath, 'agenda');
  void pollAgendaReminders();
  return { ok: true, vaultRoot, path: filePath };
});

ipcMain.handle('desktop:setup:start', async () => {
  const vaultRoot = getActiveDesktopVaultRoot();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }

  return { ok: true, vaultRoot };
});

ipcMain.handle('vault:activate', async (_event, vaultRoot?: string) => {
  const nextVaultRoot = String(vaultRoot ?? '').trim() || getActiveDesktopVaultRoot();
  desktopWebOptions.activeVaultRoot = nextVaultRoot;
  await normalizeDesktopSessionFile(getDesktopSessionPath(), nextVaultRoot);
  await startVaultWatcher(nextVaultRoot);
  void pollAgendaReminders({ catchUp: true });
  return { ok: true, vaultRoot: nextVaultRoot };
});

ipcMain.handle('desktop:api-token', (event) => {
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) {
    throw new Error('Unauthorized desktop API token request');
  }
  return desktopWebOptions.desktopSessionToken;
});

ipcMain.handle('window:control', (event, action?: string) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) {
    throw new Error('Unauthorized window control request');
  }

  if (action === 'minimize') {
    mainWindow.minimize();
    return { maximized: false };
  }

  if (action === 'toggle-maximize') {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return { maximized: mainWindow.isMaximized() };
  }

  if (action === 'close') {
    mainWindow.close();
    return { maximized: mainWindow.isMaximized() };
  }

  throw new Error('Unsupported window control request');
});

ipcMain.handle('vault:open-folder', async (event) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) {
    throw new Error('Unauthorized vault folder request');
  }

  const result = await shell.openPath(getActiveDesktopVaultRoot());
  if (result) {
    throw new Error(result);
  }
  return { ok: true };
});

ipcMain.handle('feedback:open', async (event) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) {
    throw new Error('Unauthorized feedback request');
  }
  await shell.openExternal('https://orionvault.onrender.com/#feedback');
  return { ok: true };
});

ipcMain.on('desktop:ready', (event) => {
  if (mainWindow && event.sender.id === mainWindow.webContents.id) {
    desktopWindowReady = true;
    revealDesktopWindow();
    if (pendingMarkdownOpen) {
      void openMarkdownFile(pendingMarkdownOpen).catch((error) => {
        void logStartup(`markdown.open.error ${error instanceof Error ? error.stack || error.message : String(error)}`);
      });
    }
    scheduleAgendaOpenSummary(true, 1800);
  }
});

async function startDesktop(): Promise<void> {
  await logStartup('startDesktop.begin');
  const sessionPath = getDesktopSessionPath();
  await session.defaultSession.clearCache();
  await readAgendaReminderState();
  const persistedVaultRoot = await readDesktopSessionVaultRoot(sessionPath);
  const startupVaultRoot = pendingMarkdownOpen?.vaultRoot ?? persistedVaultRoot ?? desktopWebOptions.activeVaultRoot ?? getDesktopVaultRoot();
  desktopWebOptions.activeVaultRoot = await normalizeDesktopSessionFile(sessionPath, startupVaultRoot);
  desktopWebOptions.desktopSessionPath = sessionPath;
  await startVaultWatcher(desktopWebOptions.activeVaultRoot);
  ensureAgendaReminderScheduler();
  const started = await startWebServer(0, desktopWebOptions);
  await logStartup(`startDesktop.webServer port=${started.port}`);
  webServer = started.server;
  desktopUrl = `http://127.0.0.1:${started.port}`;
  desktopWindowReady = false;
  createTray();
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

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

if (process.platform === 'win32') {
  app.setAppUserModelId(desktopShell.appId);
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('second-instance', (_event, commandLine) => {
  const markdownOpen = markdownOpenRequestFromArgs(commandLine);
  if (markdownOpen) {
    void openMarkdownFile(markdownOpen).catch((error) => {
      void logStartup(`markdown.second-instance.error ${error instanceof Error ? error.stack || error.message : String(error)}`);
    });
    return;
  }

  revealDesktopWindow();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  void startDesktop().catch((error) => {
    void logStartup(`startDesktop.error ${(error instanceof Error ? error.stack || error.message : String(error))}`);
  });
});

app.on('activate', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    void maybeNotifyAgendaOnWindowOpen(true);
    return;
  }

  if (BrowserWindow.getAllWindows().length === 0) {
    void startDesktop();
  }
});

app.on('window-all-closed', () => {
  if (!isQuitting) return;

  stopVaultWatcher();
  if (process.platform === 'darwin') {
    return;
  }

  stopAgendaReminderScheduler();
  destroyTray();
  void closeWebServer();
});

export type DesktopShellConfig = typeof desktopShell;
