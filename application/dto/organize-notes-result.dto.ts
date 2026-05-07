import type { OrganizationAction } from '../../domain/organization/entities/action';

export interface OrganizeNotesResultDto {
  readonly vaultRoot: string;
  readonly dryRun: boolean;
  readonly plannedActions: readonly OrganizationAction[];
  readonly executedActions: readonly OrganizationAction[];
  readonly skippedActions: readonly OrganizationAction[];
  readonly summary: string;
}
