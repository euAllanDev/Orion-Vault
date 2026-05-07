import type { OrganizationAction } from '../../domain/organization/entities/action';
import type { ActionExecutionReportDto } from '../dto/action-execution-report.dto';

export interface ActionExecutorPort {
  execute(actions: readonly OrganizationAction[], vaultRoot: string): Promise<ActionExecutionReportDto>;
}
