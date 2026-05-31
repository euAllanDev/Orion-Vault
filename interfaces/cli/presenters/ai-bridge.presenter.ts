import type {
  AiBridgeAgentContextDataDto,
  AiBridgeApplyDataDto,
  AiBridgeContextDataDto,
  AiBridgePlanDataDto,
  AiBridgeRetrieveDataDto,
  AiBridgeResponseDto,
  AiBridgeSearchDataDto
} from '../../../application/dto/ai-bridge.dto';

function printIssues(issues: readonly { code: string; message: string; path?: string }[]): void {
  if (issues.length === 0) {
    return;
  }

  console.log('Issues:');
  for (const issue of issues) {
    console.log(`- ${issue.code}: ${issue.message}${issue.path ? ` (${issue.path})` : ''}`);
  }
}

function printChunkDebug(chunk: {
  score: number;
  lexicalScore?: number;
  vectorScore?: number;
  rankingMode?: 'lexical-only' | 'hybrid';
  rerankScore?: number;
  rerankReasons?: readonly string[];
}): void {
  console.log(`  total score: ${chunk.score.toFixed(3)}`);
  if (chunk.lexicalScore !== undefined) {
    console.log(`  lexical score: ${chunk.lexicalScore.toFixed(3)}`);
  }
  if (chunk.vectorScore !== undefined) {
    console.log(`  vector score: ${chunk.vectorScore.toFixed(3)}`);
  }
  if (chunk.rankingMode) {
    console.log(`  ranking mode: ${chunk.rankingMode}`);
  }
  if (chunk.rerankScore !== undefined) {
    console.log(`  rerank score: ${chunk.rerankScore.toFixed(3)}`);
  }
  if (chunk.rerankReasons && chunk.rerankReasons.length > 0) {
    console.log(`  rerank reasons: ${chunk.rerankReasons.join(', ')}`);
  }
}

export function presentAiBridgeJson<TData>(response: AiBridgeResponseDto<TData>): void {
  console.log(JSON.stringify(response, null, 2));
}

export function presentContextResponse(response: AiBridgeResponseDto<AiBridgeContextDataDto>): void {
  console.log(response.summary);
  console.log(`Status: ${response.status}`);
  console.log(`Vault: ${response.data.vaultRoot}`);
  console.log(`Notes: ${response.data.summary.noteCount}`);
  console.log(`Markdown files: ${response.data.summary.markdownFileCount}`);
  console.log(`Vault issues: ${response.data.summary.issueCount}`);

  if (response.data.focusNote) {
    console.log(`Focus: ${response.data.focusNote.path}`);
    if (response.data.focusNote.title) {
      console.log(`Title: ${response.data.focusNote.title}`);
    }
    if (response.data.focusNote.tags.length > 0) {
      console.log(`Tags: ${response.data.focusNote.tags.join(', ')}`);
    }
    console.log(`Backlinks: ${response.data.backlinks.length}`);
    console.log(`Related notes: ${response.data.relatedNotes.length}`);
    console.log(`Supporting chunks: ${response.data.supportingChunks.length}`);
  }
  console.log(`Retrieval mode: ${response.data.retrievalMode}`);

  printIssues(response.issues);
}

export function presentSearchResponse(response: AiBridgeResponseDto<AiBridgeSearchDataDto>): void {
  console.log(response.summary);
  console.log(`Status: ${response.status}`);
  if (response.data.query) {
    console.log(`Query: ${response.data.query}`);
  }
  if (response.data.phrase) {
    console.log(`Phrase: ${response.data.phrase}`);
  }
  if (response.data.scopePath) {
    console.log(`Scope: ${response.data.scopePath}`);
  }
  if (response.data.tags.length > 0) {
    console.log(`Tags: ${response.data.tags.join(', ')}`);
  }
  console.log(`Matches: ${response.data.matches.length}`);
  console.log(`Context chunks: ${response.data.chunks.length}`);
  console.log(`Retrieval mode: ${response.data.retrievalMode}`);

  for (const match of response.data.matches) {
    const tagsSuffix = match.tags.length > 0 ? ` [${match.tags.join(', ')}]` : '';
    console.log(`- [${match.kind}] ${match.path}${match.title ? ` - ${match.title}` : ''}${tagsSuffix}`);
    console.log(`  matched: ${match.matchedFields.join(', ')}`);
    console.log(`  score: ${match.score}`);
    if (match.snippet) {
      console.log(`  snippet: ${match.snippet}`);
    }
  }

  for (const chunk of response.data.chunks.slice(0, 3)) {
    console.log(`- [chunk] ${chunk.path}${chunk.heading ? ` -> ${chunk.heading}` : ''}`);
    console.log(`  reasons: ${chunk.reasons.join(', ')}`);
    console.log(`  snippet: ${chunk.snippet}`);
  }

  printIssues(response.issues);
}

export function presentRetrieveResponse(response: AiBridgeResponseDto<AiBridgeRetrieveDataDto>, debug = false): void {
  console.log(response.summary);
  console.log(`Status: ${response.status}`);
  if (response.data.query) {
    console.log(`Query: ${response.data.query}`);
  }
  if (response.data.scopePath) {
    console.log(`Scope: ${response.data.scopePath}`);
  }
  if (response.data.tags.length > 0) {
    console.log(`Tags: ${response.data.tags.join(', ')}`);
  }
  console.log(`Scoped notes: ${response.data.counts.notes}`);
  console.log(`Context chunks: ${response.data.counts.chunks}`);
  console.log(`Retrieval mode: ${response.data.retrievalMode}`);

  for (const chunk of response.data.chunks) {
    console.log(`- ${chunk.path}${chunk.heading ? ` -> ${chunk.heading}` : ''}`);
    if (debug) {
      printChunkDebug(chunk);
    } else {
      console.log(`  score: ${chunk.score.toFixed(3)}`);
    }
    console.log(`  reasons: ${chunk.reasons.join(', ')}`);
    console.log(`  snippet: ${chunk.snippet}`);
  }

  printIssues(response.issues);
}

export function presentAgentContextResponse(response: AiBridgeResponseDto<AiBridgeAgentContextDataDto>, debug = false): void {
  console.log(response.summary);
  console.log(`Status: ${response.status}`);
  if (response.data.query) {
    console.log(`Query: ${response.data.query}`);
  }
  if (response.data.scopePath) {
    console.log(`Scope: ${response.data.scopePath}`);
  }
  if (response.data.focusPath) {
    console.log(`Focus: ${response.data.focusPath}`);
  }
  if (response.data.summaryText) {
    console.log(`Summary: ${response.data.summaryText}`);
  }
  console.log(`Budget: ${response.data.budget.deliveredChunks}/${response.data.budget.maxChunks} chunks`);
  console.log(`Retrieval mode: ${response.data.retrievalMode}`);

  if (response.data.focusNote) {
    console.log(`Focus title: ${response.data.focusNote.title ?? '(sem titulo)'}`);
  }

  for (const chunk of response.data.supportingChunks) {
    console.log(`- chunk ${chunk.path}${chunk.heading ? ` -> ${chunk.heading}` : ''}`);
    if (debug) {
      printChunkDebug(chunk);
    }
    console.log(`  reasons: ${chunk.reasons.join(', ')}`);
    console.log(`  snippet: ${chunk.snippet}`);
  }

  if (response.data.relatedNotes.length > 0) {
    console.log('Related:');
    for (const item of response.data.relatedNotes.slice(0, 4)) {
      console.log(`- ${item.path} (${item.score.toFixed(3)})`);
    }
  }

  printIssues(response.issues);
}

export function presentPlanResponse(response: AiBridgeResponseDto<AiBridgePlanDataDto>): void {
  console.log(response.summary);
  console.log(`Status: ${response.status}`);
  console.log(`Vault: ${response.data.vaultRoot}`);
  if (response.data.query) {
    console.log(`Query: ${response.data.query}`);
  }
  if (response.data.scopePath) {
    console.log(`Scope: ${response.data.scopePath}`);
  }
  console.log(`Dry-run: ${response.data.dryRun ? 'yes' : 'no'}`);
  console.log(`Preview: ${response.data.previewId || '(none)'}`);
  console.log(`Actions: ${response.actions.length}`);

  for (const action of response.actions) {
    if (action.kind === 'move-note') {
      console.log(`- move ${action.sourcePath} -> ${action.destinationPath}`);
      continue;
    }

    console.log(`- create folder ${action.folderPath}`);
  }

  printIssues(response.issues);
}

export function presentApplyResponse(response: AiBridgeResponseDto<AiBridgeApplyDataDto>): void {
  console.log(response.summary);
  console.log(`Status: ${response.status}`);
  console.log(`Vault: ${response.data.vaultRoot}`);
  if (response.data.query) {
    console.log(`Query: ${response.data.query}`);
  }
  if (response.data.scopePath) {
    console.log(`Scope: ${response.data.scopePath}`);
  }
  console.log(`Preview: ${response.data.previewId || '(none)'}`);
  console.log(`Requested actions: ${response.actions.length}`);
  console.log(`Executed actions: ${response.data.executedActions.length}`);
  console.log(`Skipped actions: ${response.data.skippedActions.length}`);
  printIssues(response.issues);
}
