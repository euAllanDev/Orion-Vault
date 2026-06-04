import type {
  AiBridgeAgentContextDataDto,
  AiBridgeContextDataDto,
  AiBridgeIssueDto,
  AiBridgeResponseDto,
  AiBridgeRetrieveDataDto
} from '../../../application/dto/ai-bridge.dto';
import { createAiBridgeRunner } from '../runtime/ai-bridge-runner';

export interface PrepareEditTaskCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
  readonly query?: string;
  readonly tags?: readonly string[];
  readonly format?: 'text' | 'json';
}

type EditNextStep = 'edit' | 'refine-context';

interface PrepareEditTaskData {
  readonly vaultRoot: string;
  readonly focusPath?: string;
  readonly query?: string;
  readonly summaryText: string;
  readonly focusNote?: AiBridgeContextDataDto['focusNote'];
  readonly supportingChunks: AiBridgeAgentContextDataDto['supportingChunks'];
  readonly retrievalChunks: AiBridgeRetrieveDataDto['chunks'];
  readonly relatedNotes: AiBridgeAgentContextDataDto['relatedNotes'];
  readonly relevantPaths: AiBridgeAgentContextDataDto['relevantPaths'];
  readonly budget: AiBridgeAgentContextDataDto['budget'];
  readonly contextSummary: AiBridgeContextDataDto['summary'];
  readonly editTargets: readonly string[];
  readonly risks: readonly string[];
  readonly nextStep: EditNextStep;
}

function mergeIssues(...groups: ReadonlyArray<readonly AiBridgeIssueDto[]>): readonly AiBridgeIssueDto[] {
  const seen = new Set<string>();
  const issues: AiBridgeIssueDto[] = [];

  for (const group of groups) {
    for (const issue of group) {
      const key = `${issue.code}:${issue.path ?? ''}:${issue.message}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      issues.push(issue);
    }
  }

  return issues;
}

function pickStatus(...statuses: readonly string[]): 'success' | 'conflict' | 'noop' | 'error' {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('conflict')) return 'conflict';
  if (statuses.includes('success')) return 'success';
  return 'noop';
}

function buildRisks(params: {
  focusPath?: string;
  supportingChunkCount: number;
  retrievalChunkCount: number;
}): readonly string[] {
  const risks: string[] = [];
  if (!params.focusPath) {
    risks.push('Nenhuma nota foco foi definida para edição.');
  }
  if (params.supportingChunkCount === 0) {
    risks.push('Faltam supporting chunks fortes para editar com segurança.');
  }
  if (params.retrievalChunkCount === 0) {
    risks.push('O retrieval não trouxe contexto adicional para sustentar a edição.');
  }
  return risks;
}

function presentText(response: AiBridgeResponseDto<PrepareEditTaskData>): void {
  console.log(response.summary);
  console.log(`Status: ${response.status}`);
  if (response.data.focusPath) {
    console.log(`Focus: ${response.data.focusPath}`);
  }
  if (response.data.query) {
    console.log(`Query: ${response.data.query}`);
  }
  console.log(`Summary: ${response.data.summaryText}`);
  console.log(`Supporting chunks: ${response.data.supportingChunks.length}`);
  console.log(`Retrieval chunks: ${response.data.retrievalChunks.length}`);
  console.log(`Related notes: ${response.data.relatedNotes.length}`);
  console.log(`Edit targets: ${response.data.editTargets.length}`);
  console.log(`Next step: ${response.data.nextStep}`);

  if (response.data.editTargets.length > 0) {
    console.log('Edit targets:');
    for (const target of response.data.editTargets) {
      console.log(`- ${target}`);
    }
  }

  if (response.data.risks.length > 0) {
    console.log('Risks:');
    for (const risk of response.data.risks) {
      console.log(`- ${risk}`);
    }
  }

  if (response.issues.length > 0) {
    console.log('Issues:');
    for (const issue of response.issues) {
      console.log(`- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ''}`);
    }
  }
}

export async function executePrepareEditTaskCommand(options: PrepareEditTaskCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRunner(options.vaultRoot);
  const focusPath = options.path?.trim() || undefined;
  const query = options.query?.trim() || undefined;
  const tags = options.tags ?? [];

  const [contextResponse, agentResponse, retrieveResponse] = await Promise.all([
    service.loadContext({ vaultRoot, focusPath }),
    service.loadAgentContext({ vaultRoot, focusPath, scopePath: focusPath, query, tags }),
    service.retrieve({ vaultRoot, scopePath: focusPath, query, tags })
  ]);

  const editTargets = [
    agentResponse.data.focusPath ?? contextResponse.data.focusPath,
    ...agentResponse.data.relatedNotes.map((note) => note.path)
  ].filter((value): value is string => Boolean(value));
  const risks = buildRisks({
    focusPath: agentResponse.data.focusPath ?? contextResponse.data.focusPath,
    supportingChunkCount: agentResponse.data.supportingChunks.length,
    retrievalChunkCount: retrieveResponse.data.chunks.length
  });
  const nextStep: EditNextStep = risks.length === 0 ? 'edit' : 'refine-context';

  const response: AiBridgeResponseDto<PrepareEditTaskData> = {
    provider: 'system',
    summary: focusPath
      ? `Prepared edit task for ${focusPath}.`
      : 'Prepared current edit task context.',
    actions: [],
    status: pickStatus(contextResponse.status, agentResponse.status, retrieveResponse.status),
    issues: mergeIssues(contextResponse.issues, agentResponse.issues, retrieveResponse.issues),
    data: {
      vaultRoot,
      focusPath: agentResponse.data.focusPath ?? contextResponse.data.focusPath,
      query: agentResponse.data.query ?? retrieveResponse.data.query,
      summaryText: agentResponse.data.summaryText,
      focusNote: agentResponse.data.focusNote ?? contextResponse.data.focusNote,
      supportingChunks: agentResponse.data.supportingChunks,
      retrievalChunks: retrieveResponse.data.chunks,
      relatedNotes: agentResponse.data.relatedNotes,
      relevantPaths: agentResponse.data.relevantPaths,
      budget: agentResponse.data.budget,
      contextSummary: contextResponse.data.summary,
      editTargets,
      risks,
      nextStep
    }
  };

  if (options.format === 'json') {
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  presentText(response);
}
