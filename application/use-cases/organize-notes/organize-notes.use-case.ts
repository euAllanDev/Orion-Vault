import type { AiProviderPort } from '../../ports/ai-provider.port';
import type { ActionExecutorPort } from '../../ports/action-executor.port';
import type { LoggerPort } from '../../ports/logger.port';
import type { NoteSourcePort } from '../../ports/note-source.port';
import type { OrganizeNotesRequestDto } from '../../dto/organize-notes-request.dto';
import type { OrganizeNotesResultDto } from '../../dto/organize-notes-result.dto';
import { OrganizationContextService } from '../../services/organization-context.service';
import { OrganizationPlanService } from '../../services/organization-plan.service';

export interface OrganizeNotesUseCaseDependencies {
  readonly noteSource: NoteSourcePort;
  readonly aiProvider: AiProviderPort;
  readonly actionExecutor: ActionExecutorPort;
  readonly logger: LoggerPort;
}

export class OrganizeNotesUseCase {
  constructor(
    private readonly dependencies: OrganizeNotesUseCaseDependencies,
    private readonly contextService = new OrganizationContextService(),
    private readonly planService = new OrganizationPlanService()
  ) {}

  async execute(request: OrganizeNotesRequestDto): Promise<OrganizeNotesResultDto> {
    this.dependencies.logger.info('Starting organize command', {
      vaultRoot: request.vaultRoot,
      dryRun: request.dryRun
    });

    const notes = await this.dependencies.noteSource.listNotes(request.vaultRoot);
    const context = this.contextService.build(request.vaultRoot, notes);
    const aiResponse = await this.dependencies.aiProvider.generateOrganizationPlan(context);
    const plannedActions = this.planService.validate(aiResponse);

    if (request.dryRun) {
      return {
        vaultRoot: request.vaultRoot,
        dryRun: true,
        plannedActions,
        executedActions: [],
        skippedActions: plannedActions,
        summary: 'Dry-run completed without filesystem changes.'
      };
    }

    const report = await this.dependencies.actionExecutor.execute(plannedActions, request.vaultRoot);

    return {
      vaultRoot: request.vaultRoot,
      dryRun: false,
      plannedActions,
      executedActions: report.executed,
      skippedActions: report.skipped,
      summary: `Executed ${report.executed.length} action(s).`
    };
  }
}
