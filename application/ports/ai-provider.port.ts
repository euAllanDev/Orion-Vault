import type { VaultContextDto } from '../dto/vault-context.dto';
import type { AIResponse } from '../../domain/ai/entities/ai-response';

export interface AiProviderPort {
  generateOrganizationPlan(context: VaultContextDto): Promise<AIResponse>;
}
