import { describe, expect, it, vi } from 'vitest';
import { RememberKnowledgeError } from '../../../application/use-cases/remember-knowledge/remember-knowledge.use-case';
import {
  handleOrionRemember,
  ORION_REMEMBER_INPUT_SCHEMA,
  type OrionRememberService
} from './orion-remember';

function serviceReturning(result: Awaited<ReturnType<OrionRememberService['execute']>>): OrionRememberService {
  return { execute: vi.fn().mockResolvedValue(result) };
}

describe('orion_remember', () => {
  it('exposes only semantic remember inputs in public schema', () => {
    expect(ORION_REMEMBER_INPUT_SCHEMA).toEqual({
      type: 'object',
      properties: {
        content: { type: 'string', minLength: 1, pattern: '\\S' },
        subject: { type: 'string' },
        project: { type: 'string' },
        kind: { type: 'string' }
      },
      required: ['content'],
      additionalProperties: false
    });
    for (const property of ['path', 'vaultRoot', 'vaultRoots', 'operation', 'overwrite', 'filename', 'directory', 'absolutePath']) {
      expect(ORION_REMEMBER_INPUT_SCHEMA.properties).not.toHaveProperty(property);
    }
  });

  it('accepts semantic input and formats created result', async () => {
    const service = serviceReturning({ action: 'created', note: 'remember-abc.md', summary: 'Knowledge saved in a new note.', source: 'user-explicit-agent' });
    const result = await handleOrionRemember(service, {
      content: 'A Lauren usa PostgreSQL.',
      subject: 'database',
      project: 'Lauren',
      kind: 'decision'
    });

    expect(service.execute).toHaveBeenCalledWith({ content: 'A Lauren usa PostgreSQL.', subject: 'database', project: 'Lauren', kind: 'decision' });
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Saved to Orion.\n\nAction: created\nNote: remember-abc.md\nSummary: Knowledge saved in a new note.\nSource: user-explicit-agent' }]
    });
  });

  it('formats appended result', async () => {
    const result = await handleOrionRemember(
      serviceReturning({ action: 'appended', note: 'lauren.md', summary: 'Knowledge appended to canonical note.', source: 'user-explicit-agent' }),
      { content: 'Lauren prefers PostgreSQL.' }
    );

    expect(result.content[0]).toEqual({ type: 'text', text: 'Saved to Orion.\n\nAction: appended\nNote: lauren.md\nSummary: Knowledge appended to canonical note.\nSource: user-explicit-agent' });
  });

  it('formats noop as successful result', async () => {
    const result = await handleOrionRemember(
      serviceReturning({ action: 'noop', reason: 'equivalent_knowledge_exists', note: 'remember-abc.md', summary: 'Equivalent knowledge already exists.', source: 'user-explicit-agent' }),
      { content: 'Lauren uses PostgreSQL.' }
    );

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Orion already contains equivalent knowledge.\n\nAction: noop\nReason: equivalent_knowledge_exists\nNote: remember-abc.md\nSummary: Equivalent knowledge already exists.' }]
    });
    expect(result.isError).toBeUndefined();
  });

  it('formats expected domain conflicts without claiming success', async () => {
    const result = await handleOrionRemember(
      serviceReturning({ action: 'conflict', reason: 'multiple_strong_candidates', candidates: ['lauren-a.md', 'lauren-b.md'], nextStep: 'clarification_required' }),
      { content: 'Lauren uses PostgreSQL.' }
    );

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Orion could not safely save this yet.\n\nAction: conflict\nReason: multiple_strong_candidates\nCandidates:\n- lauren-a.md\n- lauren-b.md\nNext step: clarification_required' }]
    });
  });

  it.each([
    ['WRITE_TARGET_NOT_CONFIGURED', 'Orion write target is not configured.'],
    ['WRITE_TARGET_NOT_READ_SOURCE', 'Orion write target configuration is invalid.']
  ] as const)('maps %s to controlled configuration error', async (code, text) => {
    const result = await handleOrionRemember({ execute: vi.fn().mockRejectedValue(new RememberKnowledgeError(code)) }, { content: 'Lauren uses PostgreSQL.' });

    expect(result).toEqual({ content: [{ type: 'text', text }], isError: true });
  });

  it('maps unexpected errors without exposing details', async () => {
    const result = await handleOrionRemember({ execute: vi.fn().mockRejectedValue(new Error('C:\\private\\vault failed')) }, { content: 'Lauren uses PostgreSQL.' });

    expect(result).toEqual({ content: [{ type: 'text', text: 'Unable to save knowledge in Orion.' }], isError: true });
  });
});
