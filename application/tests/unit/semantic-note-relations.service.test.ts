import { createSemanticNoteRelationsService, parseLinks, buildSemanticNoteIndex } from '../../services/semantic-note-relations.service';
import type { NoteSnapshotDto } from '../../dto/note-snapshot.dto';

const notes: NoteSnapshotDto[] = [
  {
    id: 'alpha',
    relativePath: 'Docs/Alpha.md',
    absolutePath: 'C:/vault/Docs/Alpha.md',
    title: 'Alpha',
    tags: ['graph', 'local'],
    content: `---
tags: [graph, local]
---
# Alpha

Graph local e relações semânticas com notas vizinhas.
`,
  },
  {
    id: 'beta',
    relativePath: 'Docs/Beta.md',
    absolutePath: 'C:/vault/Docs/Beta.md',
    title: 'Beta',
    tags: ['graph', 'local'],
    content: `---
tags: [graph, local]
---
# Beta

Graph local e relações semânticas com notas vizinhas.
`,
  },
  {
    id: 'gamma',
    relativePath: 'Research/Gamma.md',
    absolutePath: 'C:/vault/Research/Gamma.md',
    title: 'Gamma',
    tags: ['other'],
    content: `# Gamma

Conteúdo distante.
`,
  }
];

describe('semantic note relations service', () => {
  it('ranks related notes with the hybrid score', () => {
    const service = createSemanticNoteRelationsService();
    const result = service.getRelated('C:/vault', notes, 'Docs/Alpha.md', 5);

    expect(result.related[0]?.path).toBe('Docs/Beta.md');
    expect(result.related[0]?.score).toBeGreaterThan(0.35);
    expect(result.related[0]?.signals.tfidf).toBeGreaterThan(0);
    expect(result.related[0]?.evidenceChunks?.length).toBeGreaterThan(0);
    expect(result.related[0]?.evidenceChunks?.[0]?.matchedTerms.length).toBeGreaterThan(0);
  });

  it('parses wiki and markdown links', () => {
    const links = parseLinks(`See [[Beta]] and [Gamma](Research/Gamma.md).`);

    expect(links).toHaveLength(2);
    expect(links.map((link) => link.kind)).toEqual(['wiki', 'markdown']);
    expect(links.map((link) => link.target)).toEqual(['Beta', 'Research/Gamma.md']);
  });

  it('suggests a safe preview before applying links', () => {
    const service = createSemanticNoteRelationsService();
    const preview = service.previewLinkApplication('C:/vault', notes, 'Docs/Alpha.md', 'Docs/Beta.md', 'section');

    expect(preview.applicationMode).toBe('section');
    expect(preview.proposedContent).toContain('## Relacionadas');
    expect(preview.diff.after.join('\n')).toContain('Relacionadas');
  });

  it('builds a global graph with note and folder nodes', () => {
    const graph = buildSemanticNoteIndex(notes, 'C:/vault');

    expect(graph.nodes.some((node) => node.kind === 'note')).toBe(true);
    expect(graph.nodes.some((node) => node.kind === 'folder')).toBe(true);
    expect(graph.edges.length).toBeGreaterThan(0);
  });
});
