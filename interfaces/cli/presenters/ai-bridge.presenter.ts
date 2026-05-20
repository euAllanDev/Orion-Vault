import type {
  AiBridgeApplyDataDto,
  AiBridgeContextDataDto,
  AiBridgePlanDataDto,
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
  }

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
  if (response.data.tags.length > 0) {
    console.log(`Tags: ${response.data.tags.join(', ')}`);
  }
  console.log(`Matches: ${response.data.matches.length}`);

  for (const match of response.data.matches) {
    const tagsSuffix = match.tags.length > 0 ? ` [${match.tags.join(', ')}]` : '';
    console.log(`- [${match.kind}] ${match.path}${match.title ? ` - ${match.title}` : ''}${tagsSuffix}`);
    console.log(`  matched: ${match.matchedFields.join(', ')}`);
    console.log(`  score: ${match.score}`);
    if (match.snippet) {
      console.log(`  snippet: ${match.snippet}`);
    }
  }

  printIssues(response.issues);
}

export function presentPlanResponse(response: AiBridgeResponseDto<AiBridgePlanDataDto>): void {
  console.log(response.summary);
  console.log(`Status: ${response.status}`);
  console.log(`Vault: ${response.data.vaultRoot}`);
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
  console.log(`Preview: ${response.data.previewId || '(none)'}`);
  console.log(`Requested actions: ${response.actions.length}`);
  console.log(`Executed actions: ${response.data.executedActions.length}`);
  console.log(`Skipped actions: ${response.data.skippedActions.length}`);
  printIssues(response.issues);
}
