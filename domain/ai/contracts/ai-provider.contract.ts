import type { AIResponse } from '../entities/ai-response';
import type { VaultContext } from '../../shared/value-objects/vault-context';

export interface AIProviderContract {
  generateOrganizationPlan(context: VaultContext): Promise<AIResponse>;
}
