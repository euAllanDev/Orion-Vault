import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAppConfig } from '../../infra/config/app-config';
import { NodeVaultWorkspace } from '../../infra/filesystem/workspace/node-vault-workspace';
import { NodeVaultScanner } from '../../infra/filesystem/readers/node-vault-scanner';
import { NodeNoteReader } from '../../infra/filesystem/readers/node-note-reader';
import { VaultVerificationService } from '../../vault/services/vault-verification.service';
import type { VaultEntryDto } from '../../vault/dto/vault-entry.dto';
import { resolveExistingWithinRoot } from '../../infra/filesystem/path-resolution/path-boundary';
import { buildSearchMatches } from '../../interfaces/cli/commands/search';
import { createSemanticNoteRelationsService, parseLinks } from '../../application/services/semantic-note-relations.service';

const config = loadAppConfig();
const webRoot = path.resolve('interfaces/web');
const commandsGuidePath = path.resolve('comandos.md');
const desktopDebugLogPath = path.join(process.env.TEMP ?? process.cwd(), 'marika-desktop-vault-debug.log');
const agendaFolderPath = 'Agenda';
const workspace = new NodeVaultWorkspace();
const scanner = new NodeVaultScanner();
const noteReader = new NodeNoteReader();
const verifier = new VaultVerificationService(scanner);
const semanticRelations = createSemanticNoteRelationsService();

type JsonValue = Record<string, unknown>;

type WebServerOptions = {
  desktopSessionPath?: string;
  activeVaultRoot?: string;
};

type DesktopSessionData = {
  vaultRoot: string;
  pinnedPaths: string[];
};

function isDesktopShellRequest(options: WebServerOptions): boolean {
  return Boolean(options.desktopSessionPath);
}

function getDesktopDefaultVaultRoot(): string {
  return config.vaultRoot;
}

type AgendaStatus = 'pending' | 'done' | 'overdue';

type AgendaItemDto = {
  path: string;
  title: string;
  due: string;
  status: AgendaStatus;
  excerpt: string;
  isAgendaFolder: boolean;
};

function sendJson(res: http.ServerResponse, statusCode: number, body: JsonValue): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendText(res: http.ServerResponse, statusCode: number, body: string, contentType = 'text/plain; charset=utf-8'): void {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
}

async function readBody(req: http.IncomingMessage): Promise<JsonValue> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? (JSON.parse(raw) as JsonValue) : {};
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readMarkdownGuide(): Promise<string | null> {
  if (!(await fileExists(commandsGuidePath))) {
    return null;
  }

  return fs.readFile(commandsGuidePath, 'utf8');
}

async function ensureVaultRoot(vaultRoot: string): Promise<void> {
  await fs.mkdir(vaultRoot, { recursive: true });
}

async function ensureAgendaFolder(vaultRoot: string): Promise<void> {
  await fs.mkdir(path.resolve(vaultRoot, agendaFolderPath), { recursive: true });
}

async function appendDesktopDebugLog(options: WebServerOptions, event: string, payload: Record<string, unknown> = {}): Promise<void> {
  if (!isDesktopShellRequest(options)) return;

  const entry = JSON.stringify({
    at: new Date().toISOString(),
    event,
    ...payload
  });

  try {
    await fs.appendFile(desktopDebugLogPath, `${entry}\n`, 'utf8');
  } catch {
    // Debug logging must never break the desktop flow.
  }
}

async function readDesktopSessionData(sessionPath?: string, forcedVaultRoot?: string): Promise<DesktopSessionData> {
  if (!sessionPath) {
    return { vaultRoot: forcedVaultRoot ?? '', pinnedPaths: [] };
  }

  try {
    const raw = await fs.readFile(sessionPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DesktopSessionData>;
    return {
      vaultRoot: forcedVaultRoot ?? (typeof parsed.vaultRoot === 'string' ? parsed.vaultRoot.trim() : ''),
      pinnedPaths: Array.isArray(parsed.pinnedPaths)
        ? parsed.pinnedPaths.map((value) => String(value).replace(/\\/g, '/').trim()).filter(Boolean)
        : []
    };
  } catch {
    return { vaultRoot: forcedVaultRoot ?? '', pinnedPaths: [] };
  }
}

async function writeDesktopSessionData(sessionPath: string | undefined, data: DesktopSessionData): Promise<void> {
  if (!sessionPath) return;

  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  await fs.writeFile(sessionPath, JSON.stringify(data, null, 2), 'utf8');
}

async function resolveActiveVaultRoot(options: WebServerOptions): Promise<string> {
  if (isDesktopShellRequest(options)) return getDesktopDefaultVaultRoot();
  if (options.activeVaultRoot) return options.activeVaultRoot;
  return config.vaultRoot;
}

function pickVaultRoot(candidate: string | undefined, fallback: string): string {
  return String(candidate ?? '').trim() || fallback;
}

function resolveRequestVaultRoot(options: WebServerOptions, candidate: string | undefined, fallback: string): string {
  if (isDesktopShellRequest(options)) return getDesktopDefaultVaultRoot();
  return pickVaultRoot(candidate, fallback);
}

function normalizeApiPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function parseFrontmatter(content: string): { fields: Record<string, string>; body: string } {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { fields: {}, body: content };
  }

  const fields: Record<string, string> = {};
  let index = 1;

  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === '---') {
      index += 1;
      break;
    }

    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (match) {
      const key = String(match[1] ?? '').toLowerCase();
      const value = String(match[2] ?? '').trim().replace(/^['"`]|['"`]$/g, '');
      fields[key] = value;
    }
  }

  return { fields, body: lines.slice(index).join('\n') };
}

function normalizeAgendaStatus(value: string): AgendaStatus {
  const normalized = value.trim().toLowerCase();
  if (['done', 'completed', 'complete', 'concluida', 'concluída', 'concluido', 'concluído'].includes(normalized)) {
    return 'done';
  }

  if (normalized === 'overdue' || normalized === 'atrasado' || normalized === 'em atraso') {
    return 'overdue';
  }

  return 'pending';
}

function normalizeRootPath(value: string): string {
  return path.resolve(String(value ?? '').trim()).replace(/\\/g, '/').toLowerCase();
}

function extractBodyExcerpt(body: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => Boolean(line) && !line.startsWith('# '))
    ?.slice(0, 140) ?? '';
}

function buildAgendaItem(note: { relativePath: string; title?: string; content: string }, activeVaultRoot: string): AgendaItemDto | null {
  const { fields, body } = parseFrontmatter(note.content);
  const dueValue = fields.due ?? fields.date ?? '';
  if (!dueValue) return null;

  const due = new Date(dueValue);
  if (Number.isNaN(due.getTime())) return null;

  const storedStatus = normalizeAgendaStatus(fields.status ?? 'pending');
  const isOverdue = storedStatus !== 'done' && due.getTime() < Date.now();

  return {
    path: normalizeApiPath(note.relativePath),
    title: note.title ?? path.basename(note.relativePath, path.extname(note.relativePath)),
    due: due.toISOString(),
    status: isOverdue ? 'overdue' : storedStatus,
    excerpt: extractBodyExcerpt(body),
    isAgendaFolder: normalizeApiPath(note.relativePath).startsWith('Agenda/')
  };
}

function normalizeLinkTarget(value: string): string {
  return normalizeApiPath(path.posix.normalize(value))
    .replace(/^\.\/+/, '')
    .replace(/^(\.\.\/)+/g, '')
    .replace(/\.(md|markdown)$/i, '')
    .replace(/#.*$/, '')
    .toLowerCase();
}

function collectWikiTargets(content: string): string[] {
  return [...new Set(parseLinks(content).map((link) => link.target).filter(Boolean))];
}

function buildNoteIdentifiers(relativePath: string, title?: string): string[] {
  return [
    normalizeLinkTarget(relativePath),
    normalizeLinkTarget(path.basename(relativePath, path.extname(relativePath))),
    normalizeLinkTarget(title ?? '')
  ].filter(Boolean);
}

function matchesIdentifiers(target: string, identifiers: readonly string[]): boolean {
  const normalizedTarget = normalizeLinkTarget(target);
  return identifiers.some((identifier) => identifier === normalizedTarget);
}

function normalizeFolderPath(value: string): string {
  const normalized = normalizeApiPath(value);
  return normalized ? normalized.replace(/\/+$/g, '') : '';
}

function folderParent(value: string): string {
  const normalized = normalizeFolderPath(value);
  if (!normalized) return '';
  const parent = path.posix.dirname(normalized);
  return parent === '.' ? '' : parent;
}

function folderAncestors(value: string, stopAt = ''): string[] {
  const result: string[] = [];
  let current = normalizeFolderPath(value);

  while (current && current !== stopAt) {
    result.push(current);
    const parent = folderParent(current);
    if (!parent || parent === current) break;
    current = parent;
  }

  return result;
}

async function serveStatic(res: http.ServerResponse, requestPath: string): Promise<boolean> {
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const absolutePath = path.resolve(webRoot, `.${normalizedPath}`);
  const relativePath = path.relative(webRoot, absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    sendText(res, 403, 'Forbidden');
    return true;
  }

  if (!(await fileExists(absolutePath))) {
    return false;
  }

  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) {
    return false;
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const contentType =
    ext === '.html' ? 'text/html; charset=utf-8' :
    ext === '.css' ? 'text/css; charset=utf-8' :
    ext === '.js' ? 'text/javascript; charset=utf-8' :
    ext === '.svg' ? 'image/svg+xml; charset=utf-8' :
    ext === '.png' ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.gif' ? 'image/gif' :
    ext === '.webp' ? 'image/webp' :
    ext === '.ico' ? 'image/x-icon' :
    'application/octet-stream';

  if (contentType.startsWith('text/') || contentType.startsWith('image/svg+xml')) {
    sendText(res, 200, await fs.readFile(absolutePath, 'utf8'), contentType);
    return true;
  }

  res.writeHead(200, { 'Content-Type': contentType });
  res.end(await fs.readFile(absolutePath));
  return true;
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL, options: WebServerOptions): Promise<void> {
  if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
    const vaultRoot = await resolveActiveVaultRoot(options);
    const sessionData = await readDesktopSessionData(options.desktopSessionPath, vaultRoot);
    await appendDesktopDebugLog(options, 'api.bootstrap', { vaultRoot, pinnedCount: sessionData.pinnedPaths.length });
    sendJson(res, 200, { vaultRoot, pinnedPaths: sessionData.pinnedPaths, defaultDryRun: config.defaultDryRun });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/workspace') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));
    const exists = await fileExists(vaultRoot);
    await appendDesktopDebugLog(options, 'api.workspace.request', {
      requestedVaultRoot: url.searchParams.get('vaultRoot') ?? '',
      resolvedVaultRoot: vaultRoot,
      exists
    });

    if (!exists) {
      sendJson(res, 200, { vaultRoot, exists: false, tree: null, summary: null });
      return;
    }

    const report = await verifier.verify(vaultRoot);
    await appendDesktopDebugLog(options, 'api.workspace.response', {
      vaultRoot,
      childCount: report.root.kind === 'folder' ? report.root.children.length : 0,
      firstChildren: report.root.kind === 'folder' ? report.root.children.slice(0, 8).map((child) => child.relativePath) : []
    });
    sendJson(res, 200, {
      vaultRoot,
      exists: true,
      tree: report.root,
      summary: {
        folderCount: report.folderCount,
        fileCount: report.fileCount,
        markdownFileCount: report.markdownFileCount,
        totalBytes: report.totalBytes,
        issues: report.issues
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/file') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));
    const relativePath = url.searchParams.get('path') ?? '';
    const absolutePath = await resolveExistingWithinRoot(vaultRoot, relativePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    sendJson(res, 200, { path: relativePath, content });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/search') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));
    const query = url.searchParams.get('query')?.trim() || undefined;
    const phrase = url.searchParams.get('phrase')?.trim() || undefined;
    const tags = (url.searchParams.get('tags') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!query && !phrase && tags.length === 0) {
      sendJson(res, 200, { vaultRoot, matches: [], issues: [] });
      return;
    }

    const report = await verifier.verify(vaultRoot);
    const notes = await noteReader.listNotes(vaultRoot);
    const verifiedMarkdownPaths = new Set<string>();

    const collectMarkdownPaths = (entry: VaultEntryDto): void => {
      if (entry.kind === 'file') {
        if (String(entry.extension ?? '').toLowerCase() === 'md') {
          verifiedMarkdownPaths.add(entry.relativePath);
        }
        return;
      }

      for (const child of entry.children ?? []) {
        collectMarkdownPaths(child);
      }
    };

    collectMarkdownPaths(report.root);

    const notesByPath = notes.filter((note) => verifiedMarkdownPaths.has(note.relativePath));
    const matches = buildSearchMatches(notesByPath, { query, phrase, tags });

    sendJson(res, 200, {
      vaultRoot,
      matches,
      issues: report.issues,
      counts: {
        notes: notesByPath.length,
        matches: matches.length
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/guide') {
    const content = await readMarkdownGuide();
    if (content === null) {
      sendJson(res, 404, { error: 'commands guide not found' });
      return;
    }

    sendJson(res, 200, { path: 'comandos.md', content });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/setup') {
    const body = await readBody(req);
    const action = String(body.action ?? 'open');
    const requestedVaultRoot = String(body.vaultRoot ?? '').trim();
    const vaultRoot = resolveRequestVaultRoot(options, requestedVaultRoot, await resolveActiveVaultRoot(options));
    const sessionData = await readDesktopSessionData(options.desktopSessionPath, vaultRoot);
    await appendDesktopDebugLog(options, 'api.setup', { action, requestedVaultRoot, resolvedVaultRoot: vaultRoot });

    if (action === 'create') {
      await ensureVaultRoot(vaultRoot);
      await ensureAgendaFolder(vaultRoot);
      await writeDesktopSessionData(options.desktopSessionPath, { vaultRoot, pinnedPaths: sessionData.pinnedPaths });
      sendJson(res, 200, { vaultRoot, created: true });
      return;
    }

    if (!(await fileExists(vaultRoot))) {
      sendJson(res, 404, { error: 'vault root does not exist' });
      return;
    }

    await ensureAgendaFolder(vaultRoot);
    await writeDesktopSessionData(options.desktopSessionPath, { vaultRoot, pinnedPaths: sessionData.pinnedPaths });
    sendJson(res, 200, { vaultRoot, opened: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/pins') {
    const sessionData = await readDesktopSessionData(options.desktopSessionPath, await resolveActiveVaultRoot(options));
    sendJson(res, 200, { pinnedPaths: sessionData.pinnedPaths });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/pins') {
    const body = await readBody(req);
    const pathValue = normalizeApiPath(String(body.path ?? ''));
    const sessionData = await readDesktopSessionData(options.desktopSessionPath, await resolveActiveVaultRoot(options));
    const current = new Set(sessionData.pinnedPaths.map((value) => normalizeApiPath(value)));

    if (current.has(pathValue)) {
      current.delete(pathValue);
    } else if (pathValue) {
      current.add(pathValue);
    }

    const pinnedPaths = [...current].sort((left, right) => left.localeCompare(right, 'pt-BR'));
    await writeDesktopSessionData(options.desktopSessionPath, { vaultRoot: await resolveActiveVaultRoot(options), pinnedPaths });
    sendJson(res, 200, { pinnedPaths });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/templates') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));
    const notes = await noteReader.listNotes(vaultRoot);
    const templates = notes
      .filter((note) => normalizeApiPath(note.relativePath).startsWith('Templates/'))
      .map((note) => ({
        path: normalizeApiPath(note.relativePath),
        title: note.title ?? path.basename(note.relativePath, path.extname(note.relativePath)),
        content: note.content
      }));

    sendJson(res, 200, { templates });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/agenda') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));

    await ensureAgendaFolder(vaultRoot);

    if (!(await fileExists(vaultRoot))) {
      sendJson(res, 200, { vaultRoot, items: [] });
      return;
    }

    const notes = await noteReader.listNotes(vaultRoot);
    const items = notes
      .filter((note) => normalizeApiPath(note.relativePath).startsWith('Agenda/'))
      .map((note) => buildAgendaItem(note, vaultRoot))
      .filter((item): item is AgendaItemDto => Boolean(item))
      .sort((left, right) => {
        const leftTime = new Date(left.due).getTime();
        const rightTime = new Date(right.due).getTime();
        if (leftTime !== rightTime) return leftTime - rightTime;
        return left.title.localeCompare(right.title, 'pt-BR');
      });

    sendJson(res, 200, { vaultRoot, items });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/backlinks') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));
    const relativePath = normalizeApiPath(url.searchParams.get('path') ?? '');
    const notes = await noteReader.listNotes(vaultRoot);
    const backlinks = semanticRelations.getRelated(vaultRoot, notes, relativePath).backlinks.map((item) => ({
      path: item.targetPath ?? '',
      title: item.label
    })).filter((item) => Boolean(item.path));

    sendJson(res, 200, { backlinks });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/related') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));
    const relativePath = normalizeApiPath(url.searchParams.get('path') ?? '');
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10);
    const notes = await noteReader.listNotes(vaultRoot);
    const related = semanticRelations.getRelated(vaultRoot, notes, relativePath, Number.isFinite(limit) ? limit : 12);
    sendJson(res, 200, related as unknown as JsonValue);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/link-suggestions') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));
    const relativePath = normalizeApiPath(url.searchParams.get('path') ?? '');
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '8', 10);
    const notes = await noteReader.listNotes(vaultRoot);
    const suggestions = semanticRelations.suggestLinks(vaultRoot, notes, relativePath, Number.isFinite(limit) ? limit : 8);
    sendJson(res, 200, { vaultRoot, sourcePath: relativePath, suggestions });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/link-preview') {
    const body = await readBody(req);
    const vaultRoot = resolveRequestVaultRoot(options, String(body.vaultRoot ?? ''), await resolveActiveVaultRoot(options));
    const sourcePath = normalizeApiPath(String(body.path ?? ''));
    const targetPath = normalizeApiPath(String(body.targetPath ?? ''));
    const mode = String(body.mode ?? 'section') === 'inline' ? 'inline' : 'section';
    const notes = await noteReader.listNotes(vaultRoot);
    const preview = semanticRelations.previewLinkApplication(vaultRoot, notes, sourcePath, targetPath, mode);
    sendJson(res, 200, preview as unknown as JsonValue);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/link-apply') {
    const body = await readBody(req);
    const vaultRoot = resolveRequestVaultRoot(options, String(body.vaultRoot ?? ''), await resolveActiveVaultRoot(options));
    const sourcePath = normalizeApiPath(String(body.path ?? ''));
    const targetPath = normalizeApiPath(String(body.targetPath ?? ''));
    const mode = String(body.mode ?? 'section') === 'inline' ? 'inline' : 'section';
    const notes = await noteReader.listNotes(vaultRoot);
    const preview = semanticRelations.previewLinkApplication(vaultRoot, notes, sourcePath, targetPath, mode);
    await workspace.editMarkdownFile(vaultRoot, sourcePath, preview.proposedContent);
    sendJson(res, 200, { ok: true, preview });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/graph-global') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));
    const focusPath = normalizeApiPath(url.searchParams.get('focusPath') ?? '');
    const limitValue = url.searchParams.get('limit');
    const limit = limitValue === null ? Number.POSITIVE_INFINITY : Number.parseInt(limitValue, 10);
    const notes = await noteReader.listNotes(vaultRoot);
    const graph = semanticRelations.buildGlobalGraph(vaultRoot, notes, focusPath || undefined, Number.isFinite(limit) ? limit : Number.POSITIVE_INFINITY);
    sendJson(res, 200, graph as unknown as JsonValue);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/graph') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));
    const relativePath = normalizeApiPath(url.searchParams.get('path') ?? '');
    const folderPath = normalizeApiPath(url.searchParams.get('folderPath') ?? '');
    const notes = await noteReader.listNotes(vaultRoot);
    const edgeKeys = new Set<string>();
    const edges: Array<{ from: string; to: string }> = [];
    const nodeMap = new Map<string, { id: string; label: string; path: string; kind: 'current' | 'linked' | 'folder' }>();

    if (folderPath) {
      const folderPrefix = normalizeFolderPath(folderPath);
      const folderNotes = notes.filter((note) => normalizeApiPath(note.relativePath).startsWith(`${folderPrefix}/`) && note.relativePath.toLowerCase().endsWith('.md'));
      const folderSet = new Set<string>([folderPrefix]);

      for (const note of folderNotes) {
        const noteFolder = normalizeFolderPath(folderParent(note.relativePath));
        for (const ancestor of folderAncestors(noteFolder, folderPrefix)) {
          folderSet.add(ancestor);
        }
      }

      const centerId = `folder:${folderPrefix || 'root'}`;
      nodeMap.set(centerId, {
        id: centerId,
        label: folderPrefix ? path.basename(folderPrefix) : 'Vault',
        path: folderPrefix,
        kind: 'current'
      });

      const folderNodes = [...folderSet]
        .sort((left, right) => left.localeCompare(right, 'pt-BR'))
        .map((folder) => ({
          id: `folder:${folder}`,
          label: folder === folderPrefix ? path.basename(folderPrefix) || 'Vault' : path.basename(folder),
          path: folder,
          kind: 'folder' as const,
          depth: folder === folderPrefix ? 0 : folder.split('/').length - folderPrefix.split('/').length
        }));

      for (const folderNode of folderNodes) {
        nodeMap.set(folderNode.id, { id: folderNode.id, label: folderNode.label, path: folderNode.path, kind: folderNode.kind });
      }

      for (const folderNode of folderNodes) {
        const parentFolder = normalizeFolderPath(folderParent(folderNode.path));
        const parentId = folderNode.id === centerId ? centerId : `folder:${parentFolder}`;
        if (folderNode.id !== centerId && nodeMap.has(parentId)) {
          const key = `${parentId}->${folderNode.id}`;
          if (!edgeKeys.has(key)) {
            edgeKeys.add(key);
            edges.push({ from: parentId, to: folderNode.id });
          }
        }
      }

      const noteNodes = folderNotes.map((note) => ({
        id: normalizeApiPath(note.relativePath),
        label: note.title ?? path.basename(note.relativePath, path.extname(note.relativePath)),
        path: normalizeApiPath(note.relativePath),
        kind: 'linked' as const,
        identifiers: buildNoteIdentifiers(note.relativePath, note.title),
        content: note.content,
        folderId: `folder:${normalizeFolderPath(folderParent(note.relativePath)) || folderPrefix}`
      }));

      for (const noteNode of noteNodes) {
        nodeMap.set(noteNode.id, { id: noteNode.id, label: noteNode.label, path: noteNode.path, kind: noteNode.kind });
        const noteParent = nodeMap.has(noteNode.folderId) ? noteNode.folderId : centerId;
        const key = `${noteParent}->${noteNode.id}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ from: noteParent, to: noteNode.id });
        }
      }

      for (const source of noteNodes) {
        for (const target of noteNodes) {
          if (source.id === target.id) continue;
          const matched = collectWikiTargets(source.content).some((wikiTarget) => matchesIdentifiers(wikiTarget, target.identifiers));
          if (!matched) continue;
          const key = `${source.id}->${target.id}`;
          if (!edgeKeys.has(key)) {
            edgeKeys.add(key);
            edges.push({ from: source.id, to: target.id });
          }
        }
      }

      sendJson(res, 200, { scope: 'folder', centerId, nodes: [...nodeMap.values()], edges });
      return;
    }

    const current = notes.find((note) => normalizeApiPath(note.relativePath) === relativePath);

    if (!current) {
      sendJson(res, 200, { scope: 'note', nodes: [], edges: [] });
      return;
    }

    const currentIdentifiers = buildNoteIdentifiers(current.relativePath, current.title);
    const currentNode = {
      id: normalizeApiPath(current.relativePath),
      label: current.title ?? path.basename(current.relativePath, path.extname(current.relativePath)),
      path: normalizeApiPath(current.relativePath),
      kind: 'current' as const
    };

    nodeMap.set(currentNode.id, currentNode);

    const addEdge = (from: string, to: string): void => {
      const key = `${from}->${to}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push({ from, to });
    };

    const ensureFolderNode = (folderPath: string): string => {
      const normalizedFolder = normalizeFolderPath(folderPath);
      const id = `folder:${normalizedFolder}`;
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          label: normalizedFolder ? path.basename(normalizedFolder) : 'Vault',
          path: normalizedFolder,
          kind: 'folder'
        });
      }
      return id;
    };

    const linkFolderChain = (folderPath: string): string => {
      const normalizedFolder = normalizeFolderPath(folderPath);
      const rootId = ensureFolderNode('');
      let parentId = rootId;

      if (!normalizedFolder) {
        return rootId;
      }

      const chain = folderAncestors(normalizedFolder, '').reverse();
      for (const folder of chain) {
        const folderId = ensureFolderNode(folder);
        addEdge(parentId, folderId);
        parentId = folderId;
      }

      return parentId;
    };

    const currentFolderId = linkFolderChain(folderParent(current.relativePath));
    addEdge(currentFolderId, currentNode.id);

    for (const note of notes) {
      const notePath = normalizeApiPath(note.relativePath);
      if (notePath === currentNode.id) {
        continue;
      }

      const identifiers = buildNoteIdentifiers(note.relativePath, note.title);
      const outgoingTargets = collectWikiTargets(current.content);
      const incomingTargets = collectWikiTargets(note.content);

      const outgoingMatch = outgoingTargets.some((target) => matchesIdentifiers(target, identifiers));
      const incomingMatch = incomingTargets.some((target) => matchesIdentifiers(target, currentIdentifiers));

      if (outgoingMatch || incomingMatch) {
        nodeMap.set(notePath, {
          id: notePath,
          label: note.title ?? path.basename(note.relativePath, path.extname(note.relativePath)),
          path: notePath,
          kind: 'linked'
        });
        const linkedFolderId = linkFolderChain(folderParent(note.relativePath));
        addEdge(linkedFolderId, notePath);
      }

      if (outgoingMatch) {
        addEdge(currentNode.id, notePath);
      }

      if (incomingMatch) {
        addEdge(notePath, currentNode.id);
      }
    }

    sendJson(res, 200, { scope: 'note', nodes: [...nodeMap.values()], edges });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/daily') {
    const vaultRoot = resolveRequestVaultRoot(options, url.searchParams.get('vaultRoot') ?? undefined, await resolveActiveVaultRoot(options));
    const day = new Date().toISOString().slice(0, 10);
    const relativePath = `Daily/${day}.md`;
    const absolutePath = path.resolve(vaultRoot, relativePath);
    const exists = await fileExists(absolutePath);

    if (!exists) {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, `# ${day}\n\n`, 'utf8');
    }

    const content = await fs.readFile(absolutePath, 'utf8');
    sendJson(res, 200, { path: relativePath, content });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/folder') {
    const body = await readBody(req);
    const vaultRoot = resolveRequestVaultRoot(options, String(body.vaultRoot ?? ''), await resolveActiveVaultRoot(options));
    await workspace.createFolder(vaultRoot, String(body.path ?? ''));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/file') {
    const body = await readBody(req);
    const vaultRoot = resolveRequestVaultRoot(options, String(body.vaultRoot ?? ''), await resolveActiveVaultRoot(options));
    const filePath = String(body.path ?? '');
    const content = String(body.content ?? '');
    const operation = String(body.operation ?? 'edit');
    await appendDesktopDebugLog(options, 'api.file', {
      requestedVaultRoot: String(body.vaultRoot ?? ''),
      resolvedVaultRoot: vaultRoot,
      filePath,
      operation
    });

    if (operation === 'create') {
      await workspace.createMarkdownFile(vaultRoot, filePath, content);
      sendJson(res, 200, { ok: true });
      return;
    }

    await workspace.editMarkdownFile(vaultRoot, filePath, content);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/rename') {
    const body = await readBody(req);
    const vaultRoot = resolveRequestVaultRoot(options, String(body.vaultRoot ?? ''), await resolveActiveVaultRoot(options));
    await appendDesktopDebugLog(options, 'api.rename', {
      requestedVaultRoot: String(body.vaultRoot ?? ''),
      resolvedVaultRoot: vaultRoot,
      source: String(body.source ?? ''),
      destination: String(body.destination ?? '')
    });
    await workspace.renamePath(vaultRoot, String(body.source ?? ''), String(body.destination ?? ''));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/move') {
    const body = await readBody(req);
    const vaultRoot = resolveRequestVaultRoot(options, String(body.vaultRoot ?? ''), await resolveActiveVaultRoot(options));
    await appendDesktopDebugLog(options, 'api.move', {
      requestedVaultRoot: String(body.vaultRoot ?? ''),
      resolvedVaultRoot: vaultRoot,
      source: String(body.source ?? ''),
      destination: String(body.destination ?? '')
    });
    await workspace.movePath(vaultRoot, String(body.source ?? ''), String(body.destination ?? ''));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/debug/client-state') {
    const body = await readBody(req);
    await appendDesktopDebugLog(options, 'client.state', {
      label: String(body.label ?? ''),
      state: body.state && typeof body.state === 'object' ? body.state : {}
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'unknown api route' });
}

export function createWebServer(options: WebServerOptions = {}): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://localhost');

      if (requestUrl.pathname.startsWith('/api/')) {
        await handleApi(req, res, requestUrl, options);
        return;
      }

      const served = await serveStatic(res, requestUrl.pathname);
      if (!served) {
        sendText(res, 404, 'Not found');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error';
      sendJson(res, 500, { error: message });
    }
  });
}

export async function startWebServer(port = 4173, options: WebServerOptions = {}): Promise<{ server: http.Server; port: number }> {
  const server = createWebServer(options);

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  console.log(`Marika web running at http://localhost:${boundPort}`);
  return { server, port: boundPort };
}

const isEntryPoint = process.argv[1] ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) : false;

if (isEntryPoint) {
  void startWebServer();
}
