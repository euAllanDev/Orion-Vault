import { createHash } from 'node:crypto';
import readline from 'node:readline';

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .replace(/[`*_>~[]#!|():,.;]/g, ' ')
    .split(/[^a-z0-9-]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function hashToken(token) {
  const digest = createHash('sha256').update(token).digest();
  return {
    bucket: digest.readUInt32BE(0),
    sign: digest[4] % 2 === 0 ? 1 : -1
  };
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

function buildTextParts(payload) {
  if (payload.kind === 'chunk') {
    return [payload.title ?? '', payload.heading ?? '', ...(Array.isArray(payload.tags) ? payload.tags : []), payload.text ?? ''];
  }

  return [payload.text ?? ''];
}

function buildResponse(payload) {
  const text = buildTextParts(payload).filter(Boolean).join(' ');
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return {
      requestId: payload.requestId,
      model: 'local-embedder-token-hash-v1',
      version: '1',
      dimensions: 128,
      vector: []
    };
  }

  const dimensions = 128;
  const vector = new Array(dimensions).fill(0);
  for (const token of tokens) {
    const { bucket, sign } = hashToken(token);
    vector[bucket % dimensions] += sign;
  }

  return {
    requestId: payload.requestId,
    model: 'local-embedder-token-hash-v1',
    version: '1',
    dimensions,
    vector: normalizeVector(vector)
  };
}

function buildAnyResponse(payload) {
  if (payload.kind === 'batch' && Array.isArray(payload.items)) {
    return {
      kind: 'batch-result',
      items: payload.items.map((item) => buildResponse(item))
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
    const rl = readline.createInterface({
      input: process.stdin,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const trimmed = String(line ?? '').trim();
      if (!trimmed) {
        continue;
      }

      const payload = JSON.parse(trimmed);
      process.stdout.write(`${JSON.stringify(buildAnyResponse(payload))}\n`);
    }
    return;
  }

  const raw = await readStdin();
  const payload = raw ? JSON.parse(raw) : {};
  process.stdout.write(JSON.stringify(buildAnyResponse(payload)));
}

main().catch(() => {
  process.exitCode = 1;
});
