import { createHash } from 'node:crypto';
import readline from 'node:readline';

const synonymGroups = [
  ['architecture', 'design', 'structure', 'layers', 'layered', 'boundaries', 'adapters', 'modularity'],
  ['operations', 'ops', 'incident', 'rollback', 'runbook', 'maintenance', 'diagnosis', 'support'],
  ['writing', 'drafting', 'revision', 'editing', 'outline', 'authoring'],
  ['finance', 'budget', 'expenses', 'spending', 'cashflow', 'cash-flow', 'money'],
  ['learning', 'study', 'recall', 'review', 'practice', 'memory'],
  ['knowledge', 'notes', 'graph', 'backlinks', 'relations', 'connected'],
  ['health', 'training', 'fitness', 'recovery', 'mobility', 'exercise'],
  ['product', 'discovery', 'research', 'hypothesis', 'experiment', 'feedback']
];

const synonymMap = new Map(
  synonymGroups.flatMap((group) => group.map((token) => [token, group]))
);

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
    .replace(/[`*_>~\[\]#!|():,.;]/g, ' ')
    .split(/[^a-z0-9-]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildCharacterTrigrams(value) {
  const compact = normalizeText(value).replace(/[^a-z0-9]+/g, '');
  if (compact.length < 3) {
    return compact ? [compact] : [];
  }

  const trigrams = [];
  for (let index = 0; index <= compact.length - 3; index += 1) {
    trigrams.push(compact.slice(index, index + 3));
  }
  return trigrams;
}

function expandTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    const group = synonymMap.get(token);
    if (!group) {
      continue;
    }

    for (const synonym of group) {
      expanded.add(synonym);
    }
  }

  return [...expanded];
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
  const baseTokens = tokenize(text);
  const tokens = expandTokens(baseTokens);
  const trigrams = buildCharacterTrigrams(text);

  if (tokens.length === 0 && trigrams.length === 0) {
    return {
      requestId: payload.requestId,
      model: 'local-embedder-expanded-v1',
      version: '1',
      dimensions: 192,
      vector: []
    };
  }

  const dimensions = 192;
  const vector = new Array(dimensions).fill(0);

  for (const token of tokens) {
    const { bucket, sign } = hashToken(`tok:${token}`);
    vector[bucket % dimensions] += sign * 1.2;
  }

  for (const trigram of trigrams) {
    const { bucket, sign } = hashToken(`tri:${trigram}`);
    vector[bucket % dimensions] += sign * 0.35;
  }

  return {
    requestId: payload.requestId,
    model: 'local-embedder-expanded-v1',
    version: '1',
    dimensions,
    vector: normalizeVector(vector)
  };
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
      process.stdout.write(`${JSON.stringify(buildResponse(payload))}\n`);
    }
    return;
  }

  const raw = await readStdin();
  const payload = raw ? JSON.parse(raw) : {};
  process.stdout.write(JSON.stringify(buildResponse(payload)));
}

main().catch(() => {
  process.exitCode = 1;
});
