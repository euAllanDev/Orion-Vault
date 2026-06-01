import fs from 'node:fs/promises';
import readline from 'node:readline';

const counterFilePath = String(process.env.ORION_TEST_COUNTER_FILE ?? '').trim();

async function incrementCounter() {
  if (!counterFilePath) {
    return;
  }

  let current = 0;
  try {
    current = Number.parseInt(await fs.readFile(counterFilePath, 'utf8'), 10) || 0;
  } catch {
    current = 0;
  }

  await fs.writeFile(counterFilePath, String(current + 1), 'utf8');
}

function buildResponse(payload) {
  return {
    requestId: payload.requestId,
    model: 'counter-embedder-v1',
    version: '1',
    dimensions: 3,
    vector: [1, 2, 3]
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

async function handlePayload(payload) {
  await incrementCounter();
  return buildAnyResponse(payload);
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
      process.stdout.write(`${JSON.stringify(await handlePayload(payload))}\n`);
    }
    return;
  }

  const raw = await readStdin();
  const payload = raw ? JSON.parse(raw) : {};
  process.stdout.write(JSON.stringify(await handlePayload(payload)));
}

main().catch(() => {
  process.exitCode = 1;
});
