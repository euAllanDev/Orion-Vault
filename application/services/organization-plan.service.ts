import type { AIResponse } from '../../domain/ai/entities/ai-response';
import { OrganizationAction } from '../../domain/organization/entities/action';
import { z } from 'zod';

const organizationActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('move-note'),
    id: z.string().min(1),
    reason: z.string().optional(),
    sourcePath: z.string().min(1),
    destinationPath: z.string().min(1)
  }),
  z.object({
    kind: z.literal('create-folder'),
    id: z.string().min(1),
    reason: z.string().optional(),
    folderPath: z.string().min(1)
  })
]);

const aiResponseSchema = z.object({
  provider: z.string().min(1),
  summary: z.string().optional(),
  actions: z.array(organizationActionSchema)
});

export class OrganizationPlanService {
  validate(response: AIResponse): readonly OrganizationAction[] {
    const parsed = aiResponseSchema.parse(response);

    return parsed.actions.map((action) =>
      action.kind === 'move-note'
        ? OrganizationAction.moveNote(action)
        : OrganizationAction.createFolder(action)
    );
  }
}
