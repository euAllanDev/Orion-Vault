import type { AiProviderPort } from '../../../application/ports/ai-provider.port';
import type { AIResponse } from '../../../domain/ai/entities/ai-response';
import type { VaultContextDto } from '../../../application/dto/vault-context.dto';

export class NoopOrganizationAiProvider implements AiProviderPort {
  async generateOrganizationPlan(_context: VaultContextDto): Promise<AIResponse> {
    return {
      provider: 'noop',
      summary: 'No-op provider returned no actions.',
      actions: []
    };
  }
}
