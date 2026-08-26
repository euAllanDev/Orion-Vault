import { describe, expect, it, vi } from 'vitest';
import type { NoteSnapshotDto } from '../../dto/note-snapshot.dto';
import type { NoteSourcePort } from '../../ports/note-source.port';
import type { VaultWorkspacePort } from '../../ports/vault-workspace.port';
import { classifyRememberCandidate, RememberKnowledgeUseCase } from '../../use-cases/remember-knowledge/remember-knowledge.use-case';

const writeRoot = 'C:/vault-write';
const readRoot = 'C:/vault-read';

function note(relativePath: string, content: string, title?: string): NoteSnapshotDto {
  return { id: `C:/private/${relativePath}`, absolutePath: `C:/private/${relativePath}`, relativePath, content, title, tags: [] };
}

function workspace(): VaultWorkspacePort {
  return {
    createFolder: vi.fn(),
    createMarkdownFile: vi.fn(),
    editMarkdownFile: vi.fn(),
    editMarkdownFileIfUnchanged: vi.fn().mockResolvedValue(true),
    renamePath: vi.fn(),
    movePath: vi.fn(),
    deletePath: vi.fn()
  };
}

function useCase(notes: readonly NoteSnapshotDto[], target = writeRoot, roots: readonly string[] = [writeRoot]) {
  const source: NoteSourcePort = { listNotes: vi.fn().mockResolvedValue(notes), getNote: vi.fn() };
  const writer = workspace();
  return { source, writer, service: new RememberKnowledgeUseCase({ noteSource: source, workspace: writer, writeVaultRoot: target, readVaultRoots: roots }) };
}

describe('RememberKnowledgeUseCase', () => {
  it('blocks writing without a configured target', async () => {
    const { service, writer } = useCase([], '');
    await expect(service.execute({ content: 'Lauren uses PostgreSQL.' })).rejects.toMatchObject({ code: 'WRITE_TARGET_NOT_CONFIGURED' });
    expect(writer.createMarkdownFile).not.toHaveBeenCalled();
  });

  it('blocks writing when target is not a read source', async () => {
    const { service, writer } = useCase([], writeRoot, [readRoot]);
    await expect(service.execute({ content: 'Lauren uses PostgreSQL.' })).rejects.toMatchObject({ code: 'WRITE_TARGET_NOT_READ_SOURCE' });
    expect(writer.createMarkdownFile).not.toHaveBeenCalled();
  });

  it('creates deterministic Markdown only in write target without leaking absolute paths', async () => {
    const { service, source, writer } = useCase([]);
    const result = await service.execute({ content: '  Lauren uses PostgreSQL.  ', subject: ' Lauren ' });

    expect(result.action).toBe('created');
    if (result.action !== 'created') throw new Error('expected created result');
    expect(result.note).toMatch(/^remember-[a-f0-9]{16}\.md$/);
    expect(JSON.stringify(result)).not.toContain('C:/');
    expect(source.listNotes).toHaveBeenCalledWith(writeRoot);
    expect(writer.createMarkdownFile).toHaveBeenCalledWith(writeRoot, result.note, expect.stringContaining('Lauren uses PostgreSQL.'));
  });

  it('returns noop for equivalent content without mutation', async () => {
    const existing = note('remember-a.md', '# Remembered knowledge\n\nLauren uses PostgreSQL.\n');
    const { service, writer } = useCase([existing]);
    const result = await service.execute({ content: ' lauren   uses postgresql. ' });

    expect(result).toMatchObject({ action: 'noop', reason: 'equivalent_knowledge_exists', note: 'remember-a.md' });
    expect(writer.createMarkdownFile).not.toHaveBeenCalled();
    expect(writer.editMarkdownFileIfUnchanged).not.toHaveBeenCalled();
  });

  it('appends a delimited assertion to one canonical note while preserving content', async () => {
    const existing = note('lauren.md', '# Lauren\n\nLauren works on analytics.\n', 'Lauren');
    const { service, writer } = useCase([existing]);
    const result = await service.execute({ content: 'Lauren prefers TypeScript.', subject: 'Lauren' });

    expect(result).toMatchObject({ action: 'appended', note: 'lauren.md' });
    expect(writer.editMarkdownFileIfUnchanged).toHaveBeenCalledWith(
      writeRoot,
      'lauren.md',
      expect.any(String),
      expect.stringContaining('# Lauren\n\nLauren works on analytics.\n\n## Remembered\n\n- Lauren prefers TypeScript.')
    );
  });

  it('returns conflict for multiple strong candidates without mutation', async () => {
    const { service, writer } = useCase([
      note('lauren-a.md', '# Lauren\n\nOne', 'Lauren'),
      note('lauren-b.md', '# Lauren\n\nTwo', 'Lauren')
    ]);
    const result = await service.execute({ content: 'Lauren prefers TypeScript.', subject: 'Lauren' });

    expect(result).toMatchObject({ action: 'conflict', reason: 'multiple_strong_candidates', candidates: ['lauren-a.md', 'lauren-b.md'] });
    expect(writer.createMarkdownFile).not.toHaveBeenCalled();
    expect(writer.editMarkdownFileIfUnchanged).not.toHaveBeenCalled();
  });

  it('creates when a related note is not a canonical destination', async () => {
    const { service, writer } = useCase([note('database.md', '# Database\n\nLauren uses PostgreSQL for reporting.\n', 'Database')]);
    const result = await service.execute({ content: 'Lauren uses PostgreSQL for production.' });

    expect(result).toMatchObject({ action: 'created' });
    expect(writer.editMarkdownFileIfUnchanged).not.toHaveBeenCalled();
  });

  it('classifies discovery candidates without treating them as write targets', () => {
    expect(classifyRememberCandidate(
      note('remember-a.md', '# Remembered\n\nLauren uses PostgreSQL.\n', 'Remembered knowledge'),
      { content: 'Lauren uses PostgreSQL.' }
    )).toBe('equivalent');
    expect(classifyRememberCandidate(
      note('Lauren.md', '# Lauren\n\nLauren works on analytics.\n', 'Lauren'),
      { content: 'Lauren prefers TypeScript.', subject: 'Lauren' }
    )).toBe('canonical');
    expect(classifyRememberCandidate(
      note('Benchmark/banco-de-dados.md', '# Banco de dados\n\nProjeto Benchmark usa PostgreSQL.\n', 'Banco de dados'),
      { content: 'Projeto Benchmark usa SQLite.', project: 'Benchmark', subject: 'Banco de dados' }
    )).toBe('conflicting');
    expect(classifyRememberCandidate(
      note('notes/ideas/lista-ideias.md', '# Lista de ideias\n\nProjetos pessoais futuros e ideias.\n', 'Lista de ideias'),
      { content: 'Projetos pessoais terao revisao mensal.', subject: 'Projetos', kind: 'decision' }
    )).toBe('related');
    expect(classifyRememberCandidate(
      note('notes/archive.md', '# Arquivo\n\nSem assunto relacionado.\n', 'Arquivo'),
      { content: 'Projetos pessoais terao revisao mensal.', subject: 'Projetos', kind: 'decision' }
    )).toBe('ignored');
  });

  it('creates benchmark knowledge despite vaguely related Agent Orion notes', async () => {
    const { service, writer } = useCase([
      note('orion-agent.md', '# Agent Orion\n\nBenchmark de integracao e memoria.\n', 'Agent Orion'),
      note('benchmark-notes.md', '# Benchmark\n\nNotas sobre agentes.\n', 'Benchmark')
    ]);
    const result = await service.execute({
      content: 'Estamos realizando um benchmark do Agent Orion v0.3.',
      subject: 'Benchmark Agent Orion v0.3',
      kind: 'benchmark'
    });

    expect(result).toMatchObject({ action: 'created' });
    expect(writer.editMarkdownFileIfUnchanged).not.toHaveBeenCalled();
  });

  it('returns noop when the benchmark assertion is repeated after creation', async () => {
    const input = {
      content: 'Estamos realizando um benchmark do Agent Orion v0.3.',
      subject: 'Benchmark Agent Orion v0.3',
      kind: 'benchmark'
    };
    const first = useCase([]);
    const created = await first.service.execute(input);
    if (created.action !== 'created') throw new Error('expected created result');

    const second = useCase([note(created.note, `# Remembered knowledge\n\n${input.content}\n`)]);
    const result = await second.service.execute(input);

    expect(result).toMatchObject({ action: 'noop', note: created.note });
    expect(second.writer.createMarkdownFile).not.toHaveBeenCalled();
  });

  it('creates a project database decision when only a generic project checklist exists', async () => {
    const { service, writer } = useCase([
      note('notas/projetos/checklist-projeto.md', '# Checklist de projeto\n\nPlanejar banco e tarefas.\n', 'Checklist de projeto')
    ]);
    const result = await service.execute({
      content: 'Para o projeto Benchmark, vamos usar SQLite.',
      project: 'Benchmark',
      subject: 'Banco de dados',
      kind: 'decision'
    });

    expect(result).toMatchObject({ action: 'created' });
    expect(writer.editMarkdownFileIfUnchanged).not.toHaveBeenCalled();
  });

  it('creates a project review decision when an ideas note is merely related', async () => {
    const { service, writer } = useCase([
      note('notas/ideias/lista-ideias.md', '# Lista de ideias\n\nProjetos pessoais futuros.\n', 'Lista de ideias')
    ]);
    const result = await service.execute({ content: 'Projetos pessoais terao revisao mensal.', subject: 'Projetos', kind: 'decision' });

    expect(result).toMatchObject({ action: 'created' });
    expect(writer.editMarkdownFileIfUnchanged).not.toHaveBeenCalled();
  });

  it('creates a new database decision when retrieved notes are not canonical targets', async () => {
    const { service, writer } = useCase([
      note('tecnologia/banco-de-dados-ficticio.md', '# Banco de dados ficticio\n\nEntidades e colecoes.\n', 'Banco de dados ficticio'),
      note('notas-tecnologia.md', '# Notas sobre Tecnologia\n\nBanco de dados armazena informacoes.\n', 'Notas sobre Tecnologia')
    ]);
    const result = await service.execute({ content: 'Agora vamos usar PostgreSQL.', subject: 'Banco de dados', kind: 'decision' });

    expect(result).toMatchObject({ action: 'created' });
    expect(writer.editMarkdownFileIfUnchanged).not.toHaveBeenCalled();
  });

  it('appends complementary knowledge to one canonical project database note', async () => {
    const existing = note(
      'Benchmark/banco-de-dados.md',
      '# Banco de dados\n\nProjeto Benchmark usa PostgreSQL.\n',
      'Banco de dados'
    );
    const { service, writer } = useCase([existing]);
    const result = await service.execute({
      content: 'Projeto Benchmark tem backup diario do banco de dados.',
      project: 'Benchmark',
      subject: 'Banco de dados',
      kind: 'decision'
    });

    expect(result).toMatchObject({ action: 'appended', note: 'Benchmark/banco-de-dados.md' });
    expect(writer.editMarkdownFileIfUnchanged).toHaveBeenCalledTimes(1);
  });

  it('conflicts when two project database notes are canonical', async () => {
    const { service, writer } = useCase([
      note('Benchmark/banco-de-dados.md', '# Banco de dados\n\nProjeto Benchmark usa PostgreSQL.\n', 'Banco de dados'),
      note('Benchmark/arquitetura/banco-de-dados.md', '# Banco de dados\n\nProjeto Benchmark usa PostgreSQL.\n', 'Banco de dados')
    ]);
    const result = await service.execute({
      content: 'Projeto Benchmark tem backup diario do banco de dados.',
      project: 'Benchmark',
      subject: 'Banco de dados',
      kind: 'decision'
    });

    expect(result).toMatchObject({ action: 'conflict', reason: 'multiple_strong_candidates' });
    expect(writer.createMarkdownFile).not.toHaveBeenCalled();
  });

  it('conflicts rather than creating a contradictory canonical database decision', async () => {
    const { service, writer } = useCase([
      note('Benchmark/banco-de-dados.md', '# Banco de dados\n\nProjeto Benchmark usa PostgreSQL.\n', 'Banco de dados')
    ]);
    const result = await service.execute({
      content: 'Projeto Benchmark usa SQLite.',
      project: 'Benchmark',
      subject: 'Banco de dados',
      kind: 'decision'
    });

    expect(result).toMatchObject({ action: 'conflict', reason: 'candidate_requires_clarification' });
    expect(writer.createMarkdownFile).not.toHaveBeenCalled();
    expect(writer.editMarkdownFileIfUnchanged).not.toHaveBeenCalled();
  });

  it('returns conflict when canonical note changes before conditional append', async () => {
    const existing = note('lauren.md', '# Lauren\n\nLauren works on analytics.\n', 'Lauren');
    const { service, writer } = useCase([existing]);
    vi.mocked(writer.editMarkdownFileIfUnchanged).mockResolvedValue(false);
    const result = await service.execute({ content: 'Lauren prefers TypeScript.', subject: 'Lauren' });

    expect(result).toMatchObject({ action: 'conflict', reason: 'note_changed_during_append' });
    expect(writer.editMarkdownFile).not.toHaveBeenCalled();
  });

  it('does not overwrite a create collision', async () => {
    const { service, writer } = useCase([]);
    vi.mocked(writer.createMarkdownFile).mockRejectedValue(Object.assign(new Error('exists'), { code: 'VAULT_FILE_EXISTS' }));
    const result = await service.execute({ content: 'Lauren uses PostgreSQL.' });

    expect(result).toMatchObject({ action: 'conflict', reason: 'create_target_collision' });
  });

  it('uses only configured write target when multiple roots exist', async () => {
    const { service, source, writer } = useCase([], writeRoot, [readRoot, writeRoot]);
    await service.execute({ content: 'Lauren uses PostgreSQL.' });

    expect(source.listNotes).toHaveBeenCalledTimes(1);
    expect(source.listNotes).toHaveBeenCalledWith(writeRoot);
    expect(writer.createMarkdownFile).toHaveBeenCalledWith(writeRoot, expect.any(String), expect.any(String));
  });
});
