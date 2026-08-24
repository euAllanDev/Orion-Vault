import { describe, expect, it, vi } from 'vitest';
import type { AiBridgeAgentContextDataDto, AiBridgeResponseDto } from '../../../application/dto/ai-bridge.dto';
import { handleOrionContext, ORION_CONTEXT_INPUT_SCHEMA, type OrionContextService } from './orion-context';

function createContextResponse(overrides: Partial<AiBridgeResponseDto<AiBridgeAgentContextDataDto>> = {}): AiBridgeResponseDto<AiBridgeAgentContextDataDto> {
  return {
    provider: 'system',
    summary: 'No agent context could be prepared from the current vault scope.',
    actions: [],
    status: 'noop',
    issues: [],
    data: {
      vaultRoot: '/vault',
      summaryText: 'Contexto montado para a tarefa atual, 0 chunk(s) principais selecionados.',
      supportingChunks: [],
      retrievalMode: 'lexical-only',
      relatedNotes: [],
      relevantPaths: [],
      budget: { maxChunks: 8, maxCharacters: 4800, deliveredChunks: 0 }
    },
    ...overrides
  };
}

describe('orion_context', () => {
  it('does not expose vaultRoot and keeps focusPath and scopePath independent', () => {
    expect(ORION_CONTEXT_INPUT_SCHEMA).toEqual({
      type: 'object',
      properties: {
        query: { type: 'string' },
        focusPath: { type: 'string' },
        scopePath: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      additionalProperties: false
    });
  });

  it('forwards only the supported input with the configured vault root', async () => {
    const loadAgentContext = vi.fn().mockResolvedValue(createContextResponse());
    const service: OrionContextService = { loadAgentContext };

    await handleOrionContext(service, '/vault/configured', {
      query: 'incident response',
      focusPath: 'Operations/Incident.md',
      scopePath: 'Operations',
      tags: ['incident']
    });

    expect(loadAgentContext).toHaveBeenCalledWith({
      vaultRoot: '/vault/configured',
      query: 'incident response',
      focusPath: 'Operations/Incident.md',
      scopePath: 'Operations',
      tags: ['incident']
    });
  });

  it('formats focused context for an agent', async () => {
    const response = createContextResponse({
      status: 'success',
      summary: 'Prepared agent context with 1 chunk(s).',
      data: {
        vaultRoot: '/vault',
        summaryText: 'Foco principal em Incident Playbook, 1 chunk(s) principais selecionados.',
        focusPath: 'Operations/Incident.md',
        focusNote: {
          path: 'Operations/Incident.md',
          title: 'Incident Playbook',
          tags: ['incident'],
          wordCount: 3,
          content: 'Escalate the incident.'
        },
        supportingChunks: [{
          chunkId: 'chunk-1',
          path: 'Operations/Runbook.md',
          heading: 'Escalation',
          tags: ['incident'],
          score: 0.9,
          snippet: 'Escalate to the on-call owner.',
          text: 'Escalate to the on-call owner.',
          tokenCount: 6,
          matchedTerms: ['incident'],
          reasons: ['keyword']
        }],
        retrievalMode: 'hybrid',
        relatedNotes: [{
          path: 'Operations/Runbook.md',
          title: 'Operations Runbook',
          score: 0.8,
          intensity: 'strong',
          signals: { tfidf: 0, tags: 0, titleHeadings: 0, links: 1, folder: 0 },
          reasons: ['link'],
          kind: 'manual'
        }],
        relevantPaths: ['Operations/Incident.md', 'Operations/Runbook.md'],
        budget: { maxChunks: 8, maxCharacters: 4800, deliveredChunks: 1 }
      }
    });

    const result = await handleOrionContext({ loadAgentContext: vi.fn().mockResolvedValue(response) }, '/vault', {});

    expect(result).toEqual({
      content: [{
        type: 'text',
        text: 'Foco principal em Incident Playbook, 1 chunk(s) principais selecionados.\n\nFocus: Operations/Incident.md\nFocus title: Incident Playbook\nFocus tags: incident\n\nRelated notes:\n- Operations Runbook (Operations/Runbook.md, strong, score 0.8)\n\nRelevant paths:\n- Operations/Incident.md\n- Operations/Runbook.md\n\nSupporting chunks:\n- Operations/Runbook.md -> Escalation\n  Escalate to the on-call owner.\n\nRetrieval mode: hybrid\nBudget: 1/8 chunks, 4800 characters'
      }]
    });
  });

  it('returns an empty context without crashing when no chunks exist', async () => {
    const result = await handleOrionContext({ loadAgentContext: vi.fn().mockResolvedValue(createContextResponse()) }, '/vault', {});

    expect(result).toEqual({
      content: [{
        type: 'text',
        text: 'Contexto montado para a tarefa atual, 0 chunk(s) principais selecionados.\n\nRetrieval mode: lexical-only\nBudget: 0/8 chunks, 4800 characters'
      }]
    });
  });

  it('converts application errors into controlled MCP responses', async () => {
    const response = createContextResponse({
      summary: 'Failed to load agent context.',
      status: 'error',
      issues: [{ code: 'VAULT_ERROR', message: 'Vault is unavailable.' }]
    });

    const result = await handleOrionContext({ loadAgentContext: vi.fn().mockResolvedValue(response) }, '/vault', {});

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Failed to load agent context.\n- VAULT_ERROR: Vault is unavailable.' }],
      isError: true
    });
  });

  it('converts unexpected service failures into controlled MCP responses', async () => {
    const result = await handleOrionContext({ loadAgentContext: vi.fn().mockRejectedValue(new Error('internal details')) }, '/vault', {});

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Unable to load Orion Vault context.' }],
      isError: true
    });
  });
});
