import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startWebServer } from '../../../interfaces/web/server';

async function createTempVault(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'orion-relations-'));
  await fs.mkdir(path.join(root, 'Docs'), { recursive: true });

  await fs.writeFile(path.join(root, 'Docs', 'Alpha.md'), `---
tags: [graph, local]
---
# Alpha

Graph local e relações semânticas com notas vizinhas.

Veja [[Beta]] e [Gamma](../Research/Gamma.md).
`, 'utf8');

await fs.writeFile(path.join(root, 'Docs', 'Beta.md'), `---
tags: [graph, local]
---
# Beta

Graph local e relações semânticas com notas vizinhas.
`, 'utf8');

  await fs.mkdir(path.join(root, 'Research'), { recursive: true });
  await fs.writeFile(path.join(root, 'Research', 'Gamma.md'), `# Gamma

Conteúdo distante.
`, 'utf8');

  return root;
}

describe('semantic note relations api', () => {
  let server: Awaited<ReturnType<typeof startWebServer>>['server'] | null = null;

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
      if (!server) resolve();
    });
    server = null;
  });

  it('serves related notes, previews and apply payloads', async () => {
    const vaultRoot = await createTempVault();
    const started = await startWebServer(0, { activeVaultRoot: vaultRoot });
    server = started.server;

    const relatedResponse = await fetch(`http://127.0.0.1:${started.port}/api/related?vaultRoot=${encodeURIComponent(vaultRoot)}&path=Docs/Alpha.md`);
    expect(relatedResponse.ok).toBe(true);
    const related = await relatedResponse.json() as { related: Array<{ path: string }> ; manualLinks: Array<{ targetPath?: string }> };
    expect(related.manualLinks.length).toBeGreaterThan(0);

    const previewResponse = await fetch(`http://127.0.0.1:${started.port}/api/link-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: 'Docs/Alpha.md', targetPath: 'Docs/Beta.md', mode: 'section' })
    });
    expect(previewResponse.ok).toBe(true);
    const preview = await previewResponse.json() as { proposedContent: string };
    expect(preview.proposedContent).toContain('## Relacionadas');

    const applyResponse = await fetch(`http://127.0.0.1:${started.port}/api/link-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultRoot, path: 'Docs/Alpha.md', targetPath: 'Docs/Beta.md', mode: 'section' })
    });
    expect(applyResponse.ok).toBe(true);

    const updated = await fs.readFile(path.join(vaultRoot, 'Docs', 'Alpha.md'), 'utf8');
    expect(updated).toContain('## Relacionadas');
    expect(updated).toContain('[[Beta|Beta]]');

    const graphResponse = await fetch(`http://127.0.0.1:${started.port}/api/graph-global?vaultRoot=${encodeURIComponent(vaultRoot)}&focusPath=Docs/Alpha.md`);
    expect(graphResponse.ok).toBe(true);
    const graph = await graphResponse.json() as { nodes: Array<{ kind: string }>; edges: unknown[] };
    expect(graph.nodes.some((node) => node.kind === 'folder')).toBe(true);
    expect(graph.nodes.some((node) => node.kind === 'note')).toBe(true);
    expect(graph.edges.length).toBeGreaterThan(0);
  });
});
