export interface RememberKnowledgeInputDto {
  readonly content: string;
  readonly subject?: string;
  readonly project?: string;
  readonly kind?: string;
}

export type RememberKnowledgeResultDto =
  | {
      readonly action: 'noop';
      readonly reason: 'equivalent_knowledge_exists';
      readonly note: string;
      readonly summary: string;
      readonly source: 'user-explicit-agent';
    }
  | {
      readonly action: 'created' | 'appended';
      readonly note: string;
      readonly summary: string;
      readonly source: 'user-explicit-agent';
    }
  | {
      readonly action: 'conflict';
      readonly reason: string;
      readonly candidates?: readonly string[];
      readonly nextStep: 'confirmation_required' | 'clarification_required';
    };
