import type { AiBridgeResponseDto, AiBridgeAgentContextDataDto, AiBridgeContextDataDto, AiBridgeIssueDto } from '../../../application/dto/ai-bridge.dto';
import { createAiBridgeRunner } from '../runtime/ai-bridge-runner';

export interface AnalyzeNoteCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
  readonly query?: string;
  readonly format?: 'text' | 'json';
}

interface AnalyzeNoteData {
  readonly vaultRoot: string;
  readonly focusPath?: string;
  readonly query?: string;
  readonly summaryText: string;
  readonly focusNote?: AiBridgeContextDataDto['focusNote'];
  readonly backlinks: AiBridgeContextDataDto['backlinks'];
  readonly relatedNotes: AiBridgeAgentContextDataDto['relatedNotes'];
  readonly supportingChunks: AiBridgeAgentContextDataDto['supportingChunks'];
  readonly relevantPaths: AiBridgeAgentContextDataDto['relevantPaths'];
  readonly budget: AiBridgeAgentContextDataDto['budget'];
  readonly contextSummary: AiBridgeContextDataDto['summary'];
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

function pickStatus(contextStatus: string, agentStatus: string): 'success' | 'conflict' | 'noop' | 'error' {
  if (contextStatus === 'error' || agentStatus === 'error') {
    return 'error';
  }

  if (contextStatus === 'conflict' || agentStatus === 'conflict') {
    return 'conflict';
  }

  if (contextStatus === 'success' || agentStatus === 'success') {
    return 'success';
  }

  return 'noop';
}

function presentText(response: AiBridgeResponseDto<AnalyzeNoteData>): void {
  console.log(response.summary);
  console.log(`Status: ${response.status}`);
  if (response.data.focusPath) {
    console.log(`Focus: ${response.data.focusPath}`);
  }
  if (response.data.query) {
    console.log(`Query: ${response.data.query}`);
  }
  if (response.data.summaryText) {
    console.log(`Summary: ${response.data.summaryText}`);
  }
  console.log(`Backlinks: ${response.data.backlinks.length}`);
  console.log(`Related notes: ${response.data.relatedNotes.length}`);
  console.log(`Supporting chunks: ${response.data.supportingChunks.length}`);
  console.log(`Budget: ${response.data.budget.deliveredChunks}/${response.data.budget.maxChunks} chunks`);

  if (response.data.relatedNotes.length > 0) {
    console.log('Related:');
    for (const item of response.data.relatedNotes.slice(0, 4)) {
      console.log(`- ${item.path} (${item.score.toFixed(3)})`);
    }
  }

  if (response.issues.length > 0) {
    console.log('Issues:');
    for (const issue of response.issues) {
      console.log(`- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ''}`);
    }
  }
}

export async function executeAnalyzeNoteCommand(options: AnalyzeNoteCommandOptions): Promise<void> {
  const { service, vaultRoot } = createAiBridgeRunner(options.vaultRoot);
  const focusPath = options.path?.trim() || undefined;
  const [contextResponse, agentResponse] = await Promise.all([
    service.loadContext({ vaultRoot, focusPath }),
    service.loadAgentContext({ vaultRoot, focusPath, query: options.query?.trim() || undefined })
  ]);

  const response: AiBridgeResponseDto<AnalyzeNoteData> = {
    provider: 'system',
    summary: focusPath
      ? `Analyzed note context for ${focusPath}.`
      : 'Analyzed current vault context.',
    actions: [],
    status: pickStatus(contextResponse.status, agentResponse.status),
    issues: mergeIssues(contextResponse.issues, agentResponse.issues),
    data: {
      vaultRoot,
      focusPath: agentResponse.data.focusPath ?? contextResponse.data.focusPath,
      query: agentResponse.data.query,
      summaryText: agentResponse.data.summaryText,
      focusNote: agentResponse.data.focusNote ?? contextResponse.data.focusNote,
      backlinks: contextResponse.data.backlinks,
      relatedNotes: agentResponse.data.relatedNotes,
      supportingChunks: agentResponse.data.supportingChunks,
      relevantPaths: agentResponse.data.relevantPaths,
      budget: agentResponse.data.budget,
      contextSummary: contextResponse.data.summary
    }
  };

  if (options.format === 'json') {
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  presentText(response);
}
