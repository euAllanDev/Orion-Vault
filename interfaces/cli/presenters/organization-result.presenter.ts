import type { OrganizeNotesResultDto } from '../../../application/dto/organize-notes-result.dto';

export function presentOrganizeResult(result: OrganizeNotesResultDto): void {
  console.log(result.summary);
  console.log(`Vault: ${result.vaultRoot}`);
  console.log(`Dry-run: ${result.dryRun ? 'yes' : 'no'}`);
  console.log(`Planned actions: ${result.plannedActions.length}`);
  console.log(`Executed actions: ${result.executedActions.length}`);
  console.log(`Skipped actions: ${result.skippedActions.length}`);
}
