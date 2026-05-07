import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAppConfig } from '../../infra/config/app-config';
import { NodeVaultWorkspace } from '../../infra/filesystem/workspace/node-vault-workspace';
import { NodeVaultScanner } from '../../infra/filesystem/readers/node-vault-scanner';
import { VaultVerificationService } from '../../vault/services/vault-verification.service';
import { resolveExistingWithinRoot } from '../../infra/filesystem/path-resolution/path-boundary';

const config = loadAppConfig();
const webRoot = path.resolve('interfaces/web');
const workspace = new NodeVaultWorkspace();
const scanner = new NodeVaultScanner();
const verifier = new VaultVerificationService(scanner);

type JsonValue = Record<string, unknown>;

type WebServerOptions = {
  desktopSessionPath?: string;
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

async function ensureVaultRoot(vaultRoot: string): Promise<void> {
  await fs.mkdir(vaultRoot, { recursive: true });
}

async function readDesktopSessionVaultRoot(sessionPath?: string): Promise<string> {
  if (!sessionPath) return '';

  try {
    const raw = await fs.readFile(sessionPath, 'utf8');
    const parsed = JSON.parse(raw) as { vaultRoot?: unknown };
    return typeof parsed.vaultRoot === 'string' ? parsed.vaultRoot.trim() : '';
  } catch {
    return '';
  }
}

async function writeDesktopSessionVaultRoot(sessionPath: string | undefined, vaultRoot: string): Promise<void> {
  if (!sessionPath) return;

  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  await fs.writeFile(sessionPath, JSON.stringify({ vaultRoot }, null, 2), 'utf8');
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
    'application/octet-stream';

  sendText(res, 200, await fs.readFile(absolutePath, 'utf8'), contentType);
  return true;
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL, options: WebServerOptions): Promise<void> {
  if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
    const sessionVaultRoot = await readDesktopSessionVaultRoot(options.desktopSessionPath);
    const vaultRoot = sessionVaultRoot || process.env.MARIKA_VAULT_ROOT?.trim() || '';
    sendJson(res, 200, { vaultRoot, defaultDryRun: config.defaultDryRun });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/workspace') {
    const vaultRoot = url.searchParams.get('vaultRoot') ?? config.vaultRoot;
    const exists = await fileExists(vaultRoot);

    if (!exists) {
      sendJson(res, 200, { vaultRoot, exists: false, tree: null, summary: null });
      return;
    }

    const report = await verifier.verify(vaultRoot);
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
    const vaultRoot = url.searchParams.get('vaultRoot') ?? config.vaultRoot;
    const relativePath = url.searchParams.get('path') ?? '';
    const absolutePath = await resolveExistingWithinRoot(vaultRoot, relativePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    sendJson(res, 200, { path: relativePath, content });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/setup') {
    const body = await readBody(req);
    const vaultRoot = String(body.vaultRoot ?? '').trim();
    const action = String(body.action ?? 'open');

    if (!vaultRoot) {
      sendJson(res, 400, { error: 'vaultRoot is required' });
      return;
    }

    if (action === 'create') {
      await ensureVaultRoot(vaultRoot);
      await writeDesktopSessionVaultRoot(options.desktopSessionPath, vaultRoot);
      sendJson(res, 200, { vaultRoot, created: true });
      return;
    }

    if (!(await fileExists(vaultRoot))) {
      sendJson(res, 404, { error: 'vault root does not exist' });
      return;
    }

    await writeDesktopSessionVaultRoot(options.desktopSessionPath, vaultRoot);
    sendJson(res, 200, { vaultRoot, opened: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/folder') {
    const body = await readBody(req);
    await workspace.createFolder(String(body.vaultRoot ?? ''), String(body.path ?? ''));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/file') {
    const body = await readBody(req);
    const vaultRoot = String(body.vaultRoot ?? '');
    const filePath = String(body.path ?? '');
    const content = String(body.content ?? '');
    const operation = String(body.operation ?? 'edit');

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
    await workspace.renamePath(String(body.vaultRoot ?? ''), String(body.source ?? ''), String(body.destination ?? ''));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/move') {
    const body = await readBody(req);
    await workspace.movePath(String(body.vaultRoot ?? ''), String(body.source ?? ''), String(body.destination ?? ''));
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
