import { spawn } from 'node:child_process';
import type { EmbeddingProviderPort, LocalChunkEmbeddingInput, LocalEmbeddingVector, LocalQueryEmbeddingInput } from '../../../application/ports/embedding-provider.port';

type ExternalEmbeddingCommandRequest = {
  readonly kind: 'chunk' | 'query';
  readonly text: string;
  readonly fingerprint: string;
  readonly chunkId?: string;
  readonly notePath?: string;
  readonly title?: string;
  readonly heading?: string;
  readonly tags?: readonly string[];
};

type ExternalEmbeddingBatchRequest = {
  readonly kind: 'batch';
  readonly items: ReadonlyArray<(ExternalEmbeddingCommandRequest & { readonly requestId: string })>;
};

type ExternalEmbeddingCommandResponse = {
  readonly requestId?: string;
  readonly model?: string;
  readonly version?: string;
  readonly dimensions?: number;
  readonly vector?: readonly number[];
};

type ExternalEmbeddingBatchResponse = {
  readonly kind?: 'batch-result';
  readonly items?: readonly ExternalEmbeddingCommandResponse[];
};

type PendingPersistentRequest = {
  readonly fingerprint: string;
  readonly resolve: (value: LocalEmbeddingVector | null) => void;
  readonly timeout: NodeJS.Timeout;
};

type QueuedPersistentRequest = {
  readonly requestId: string;
  readonly request: ExternalEmbeddingCommandRequest;
};

function parseCommand(command: string): { file: string; args: string[] } | null {
  const trimmed = command.trim();
  if (!trimmed) {
    return null;
  }

  const parts: string[] = [];
  let current = '';
  let quote: '"' | '\'' | null = null;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index] ?? '';
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    parts.push(current);
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    file: parts[0] ?? '',
    args: parts.slice(1)
  };
}

export class ExternalCommandEmbeddingProvider implements EmbeddingProviderPort {
  readonly providerId = 'external-command-local';
  private readonly parsedCommand: { file: string; args: string[] } | null;
  private readonly persistentMode: boolean;
  private persistentChild: ReturnType<typeof spawn> | null = null;
  private stdoutBuffer = '';
  private nextRequestId = 0;
  private readonly pendingRequests = new Map<string, PendingPersistentRequest>();
  private readonly embeddingCache = new Map<string, LocalEmbeddingVector>();
  private readonly inFlightRequests = new Map<string, Promise<LocalEmbeddingVector | null>>();
  private readonly queuedPersistentRequests: QueuedPersistentRequest[] = [];
  private batchFlushTimeout: NodeJS.Timeout | null = null;

  constructor(private readonly command: string) {
    this.parsedCommand = parseCommand(command);
    this.persistentMode = this.parsedCommand?.args.includes('--stdio-server') ?? false;
  }

  close(): void {
    this.shutdownPersistentChild();
  }

  async embedChunk(input: LocalChunkEmbeddingInput): Promise<LocalEmbeddingVector | null> {
    return this.run({
      kind: 'chunk',
      text: input.text,
      fingerprint: input.fingerprint,
      chunkId: input.chunkId,
      notePath: input.notePath,
      title: input.title,
      heading: input.heading,
      tags: input.tags
    });
  }

  async embedQuery(input: LocalQueryEmbeddingInput): Promise<LocalEmbeddingVector | null> {
    return this.run({
      kind: 'query',
      text: input.text,
      fingerprint: input.text.trim().toLowerCase()
    });
  }

  private async run(request: ExternalEmbeddingCommandRequest): Promise<LocalEmbeddingVector | null> {
    const cacheKey = this.buildCacheKey(request);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const inFlight = this.inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const parsedCommand = this.parsedCommand;
    if (!parsedCommand) {
      return null;
    }

    const promise = (this.persistentMode
      ? this.runPersistent(request, parsedCommand)
      : this.runSingleRequest(request, parsedCommand))
      .then((result) => {
        if (result) {
          this.embeddingCache.set(cacheKey, result);
        }

        return result;
      })
      .finally(() => {
        this.inFlightRequests.delete(cacheKey);
      });

    this.inFlightRequests.set(cacheKey, promise);
    return promise;
  }

  private buildCacheKey(request: ExternalEmbeddingCommandRequest): string {
    return `${request.kind}:${request.fingerprint}`;
  }

  private async runSingleRequest(
    request: ExternalEmbeddingCommandRequest,
    parsedCommand: { file: string; args: string[] }
  ): Promise<LocalEmbeddingVector | null> {
    return new Promise<LocalEmbeddingVector | null>((resolve) => {
      const child = spawn(parsedCommand.file, parsedCommand.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: process.env
      });
      let stdout = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.on('error', () => {
        resolve(null);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          resolve(null);
          return;
        }

        resolve(this.toEmbeddingVector(stdout, request.fingerprint));
      });

      child.stdin.write(JSON.stringify(request));
      child.stdin.end();
    });
  }

  private async runPersistent(
    request: ExternalEmbeddingCommandRequest,
    parsedCommand: { file: string; args: string[] }
  ): Promise<LocalEmbeddingVector | null> {
    const child = this.ensurePersistentChild(parsedCommand);
    const stdin = child.stdin;
    if (!stdin || stdin.destroyed) {
      return null;
    }

    const requestId = `req-${++this.nextRequestId}`;
    return new Promise<LocalEmbeddingVector | null>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        resolve(null);
      }, 30_000);

      this.pendingRequests.set(requestId, {
        fingerprint: request.fingerprint,
        resolve,
        timeout
      });

      this.queuedPersistentRequests.push({ requestId, request });
      this.scheduleBatchFlush(stdin);
    });
  }

  private scheduleBatchFlush(stdin: NodeJS.WritableStream): void {
    if (this.batchFlushTimeout) {
      return;
    }

    this.batchFlushTimeout = setTimeout(() => {
      this.batchFlushTimeout = null;
      this.flushQueuedPersistentRequests(stdin);
    }, 0);
  }

  private flushQueuedPersistentRequests(stdin: NodeJS.WritableStream): void {
    if (stdin.destroyed || this.queuedPersistentRequests.length === 0) {
      return;
    }

    const queued = this.queuedPersistentRequests.splice(0, this.queuedPersistentRequests.length);
    if (queued.length === 1) {
      const single = queued[0];
      stdin.write(`${JSON.stringify({ ...single.request, requestId: single.requestId })}\n`);
      return;
    }

    const batchPayload: ExternalEmbeddingBatchRequest = {
      kind: 'batch',
      items: queued.map((item) => ({ ...item.request, requestId: item.requestId }))
    };
    stdin.write(`${JSON.stringify(batchPayload)}\n`);
  }

  private ensurePersistentChild(parsedCommand: { file: string; args: string[] }) {
    if (this.persistentChild && !this.persistentChild.killed) {
      return this.persistentChild;
    }

    const child = spawn(parsedCommand.file, parsedCommand.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: process.env
    });

    this.stdoutBuffer = '';
    child.stdout.on('data', (chunk) => {
      this.handlePersistentStdout(chunk.toString());
    });

    const handleShutdown = () => {
      if (this.persistentChild === child) {
        this.shutdownPersistentChild(false);
      }
    };

    child.on('error', handleShutdown);
    child.on('close', handleShutdown);
    this.persistentChild = child;
    return child;
  }

  private shutdownPersistentChild(killChild = true): void {
    const child = this.persistentChild;
    this.persistentChild = null;
    this.stdoutBuffer = '';
    if (this.batchFlushTimeout) {
      clearTimeout(this.batchFlushTimeout);
      this.batchFlushTimeout = null;
    }
    this.queuedPersistentRequests.length = 0;

    for (const [requestId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.resolve(null);
      this.pendingRequests.delete(requestId);
    }

    if (killChild && child && !child.killed) {
      child.kill();
    }
  }

  private handlePersistentStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed) as ExternalEmbeddingCommandResponse | ExternalEmbeddingBatchResponse;
        if (this.isBatchResponse(parsed)) {
          for (const item of parsed.items) {
            this.resolvePendingPersistentRequest(item);
          }
          continue;
        }

        this.resolvePendingPersistentRequest(parsed);
      } catch {
        // Ignore malformed lines so the provider can continue operating.
      }
    }
  }

  private isBatchResponse(value: ExternalEmbeddingCommandResponse | ExternalEmbeddingBatchResponse): value is ExternalEmbeddingBatchResponse {
    return Array.isArray((value as ExternalEmbeddingBatchResponse).items);
  }

  private resolvePendingPersistentRequest(parsed: ExternalEmbeddingCommandResponse): void {
    const requestId = parsed.requestId?.trim();
    if (!requestId) {
      return;
    }

    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);
    pending.resolve(this.toEmbeddingVector(parsed, pending.fingerprint));
  }

  private toEmbeddingVector(raw: string | ExternalEmbeddingCommandResponse, fingerprint: string): LocalEmbeddingVector | null {
    try {
      const parsed = typeof raw === 'string'
        ? JSON.parse(raw) as ExternalEmbeddingCommandResponse
        : raw;
      const vector = Array.isArray(parsed.vector)
        ? parsed.vector.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [];
      if (vector.length === 0) {
        return null;
      }

      return {
        model: parsed.model?.trim() || this.providerId,
        version: parsed.version?.trim() || '1',
        dimensions: typeof parsed.dimensions === 'number' && parsed.dimensions > 0 ? parsed.dimensions : vector.length,
        vector,
        fingerprint
      };
    } catch {
      return null;
    }
  }
}
