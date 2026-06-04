import type {
  AiBridgeAgentContextDataDto,
  AiBridgeContextDataDto,
  AiBridgeIssueDto,
  AiBridgeResponseDto,
  AiBridgeRetrieveDataDto
} from '../../../application/dto/ai-bridge.dto';
import { createAiBridgeRunner } from '../runtime/ai-bridge-runner';

export interface PrepareWritingTaskCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
  readonly query?: string;
  readonly tags?: readonly string[];
  readonly format?: 'text' | 'json';
}

type WritingNextStep = 'preview' | 'refine-context';

interface PrepareWritingTaskData {
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
  readonly gaps: readonly string[];
  readonly nextStep: WritingNextStep;
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

function buildGaps(params: {
  focusPath?: string;
  supportingChunkCount: number;
  retrievalChunkCount: number;
  query?: string;
}): readonly string[] {
  const gaps: string[] = [];
  if (!params.focusPath) {
    gaps.push('Nenhuma nota foco definida.');
  }
  if (params.supportingChunkCount === 0) {
    gaps.push('Nenhum supporting chunk forte foi encontrado.');
  }
  if (params.query && params.retrievalChunkCount === 0) {
    gaps.push('A consulta ainda nao trouxe retrieval suficiente para escrita.');
  }
  return gaps;
}

function presentText(response: AiBridgeResponseDto<PrepareWritingTaskData>): void {
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
  console.log(`Next step: ${response.data.nextStep}`);

  if (response.data.gaps.length > 0) {
    console.log('Gaps:');
    for (const gap of response.data.gaps) {
      console.log(`- ${gap}`);
    }
  }

  if (response.issues.length > 0) {
    console.log('Issues:');
    for (const issue of response.issues) {
      console.log(`- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ''}`);
    }
  }
}

export async function executePrepareWritingTaskCommand(options: PrepareWritingTaskCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRunner(options.vaultRoot);
  const focusPath = options.path?.trim() || undefined;
  const query = options.query?.trim() || undefined;
  const tags = options.tags ?? [];

  const [contextResponse, agentResponse, retrieveResponse] = await Promise.all([
    service.loadContext({ vaultRoot, focusPath }),
    service.loadAgentContext({ vaultRoot, focusPath, scopePath: focusPath, query, tags }),
    service.retrieve({ vaultRoot, scopePath: focusPath, query, tags })
  ]);

  const gaps = buildGaps({
    focusPath: agentResponse.data.focusPath ?? contextResponse.data.focusPath,
    supportingChunkCount: agentResponse.data.supportingChunks.length,
    retrievalChunkCount: retrieveResponse.data.chunks.length,
    query
  });
  const nextStep: WritingNextStep = gaps.length === 0 ? 'preview' : 'refine-context';

  const response: AiBridgeResponseDto<PrepareWritingTaskData> = {
    provider: 'system',
    summary: focusPath
      ? `Prepared writing task for ${focusPath}.`
      : 'Prepared current writing task context.',
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
      gaps,
      nextStep
    }
  };

  if (options.format === 'json') {
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  presentText(response);
}
