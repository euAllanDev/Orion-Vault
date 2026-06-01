import readline from 'node:readline';

function readArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return undefined;
  }

  return String(process.argv[index + 1] ?? '').trim() || undefined;
}

function normalizeHost(value) {
  return String(value ?? 'http://127.0.0.1:11434').trim().replace(/\/+$/, '');
}

function buildTextParts(payload) {
  if (payload.kind === 'chunk') {
    return [payload.title ?? '', payload.heading ?? '', ...(Array.isArray(payload.tags) ? payload.tags : []), payload.text ?? ''];
  }

  return [payload.text ?? ''];
}

function applyOptionalPrefix(text, prefix) {
  const normalizedText = String(text ?? '').trim();
  if (!normalizedText) {
    return normalizedText;
  }

  const normalizedPrefix = String(prefix ?? '').trim();
  return normalizedPrefix ? `${normalizedPrefix}: ${normalizedText}` : normalizedText;
}

function buildEmptyResponse(payload, model) {
  return {
    requestId: payload.requestId,
    model: `ollama:${model}`,
    version: '1',
    dimensions: 0,
    vector: []
  };
}

function toVector(data) {
  if (Array.isArray(data?.embedding)) {
    return data.embedding.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }

  if (Array.isArray(data?.embeddings) && Array.isArray(data.embeddings[0])) {
    return data.embeddings[0].map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }

  return [];
}

async function requestEmbedding(host, model, text, timeoutMs) {
  let lastVector = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const vector = await requestEmbeddingOnce(host, model, text, timeoutMs);
    if (vector.length > 0) {
      return vector;
    }

    lastVector = vector;
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  return lastVector;
}

async function requestEmbeddingOnce(host, model, text, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const embedResponse = await fetch(`${host}/api/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, input: text }),
      signal: controller.signal
    });

    if (embedResponse.ok) {
      const embedData = await embedResponse.json();
      const vector = toVector(embedData);
      if (vector.length > 0) {
        return vector;
      }
    }

    const legacyResponse = await fetch(`${host}/api/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
      signal: controller.signal
    });

    if (!legacyResponse.ok) {
      return [];
    }

    const legacyData = await legacyResponse.json();
    return toVector(legacyData);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function buildResponse(payload) {
  const model = String(process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text').trim() || 'nomic-embed-text';
  const host = normalizeHost(process.env.OLLAMA_HOST);
  const timeoutMs = Math.max(1000, Number(process.env.OLLAMA_EMBED_TIMEOUT_MS ?? '30000') || 30000);
  const queryPrefix = readArgValue('--query-prefix');
  const documentPrefix = readArgValue('--document-prefix');
  const rawText = buildTextParts(payload).filter(Boolean).join(' ').trim();
  const text = payload.kind === 'query'
    ? applyOptionalPrefix(rawText, queryPrefix)
    : applyOptionalPrefix(rawText, documentPrefix);

  if (!text) {
    return buildEmptyResponse(payload, model);
  }

  try {
    const vector = await requestEmbedding(host, model, text, timeoutMs);
    if (vector.length === 0) {
      return buildEmptyResponse(payload, model);
    }

    return {
      requestId: payload.requestId,
      model: `ollama:${model}`,
      version: '1',
      dimensions: vector.length,
      vector
    };
  } catch {
    return buildEmptyResponse(payload, model);
  }
}

async function buildAnyResponse(payload) {
  if (payload.kind === 'batch' && Array.isArray(payload.items)) {
    const items = [];
    for (const item of payload.items) {
      items.push(await buildResponse(item));
    }

    return {
      kind: 'batch-result',
      items
    };
  }

  return buildResponse(payload);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  if (process.argv.includes('--stdio-server')) {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = String(line ?? '').trim();
      if (!trimmed) {
        continue;
      }

      const payload = JSON.parse(trimmed);
      process.stdout.write(`${JSON.stringify(await buildAnyResponse(payload))}\n`);
    }
    return;
  }

  const raw = await readStdin();
  const payload = raw ? JSON.parse(raw) : {};
  process.stdout.write(JSON.stringify(await buildAnyResponse(payload)));
}

main().catch(() => {
  process.exitCode = 1;
});
