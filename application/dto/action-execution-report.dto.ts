import type { OrganizationAction } from '../../domain/organization/entities/action';

export interface ActionExecutionReportDto {
  readonly executed: readonly OrganizationAction[];
  readonly skipped: readonly OrganizationAction[];
}
