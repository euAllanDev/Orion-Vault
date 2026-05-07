import type { VaultContextDto } from '../../../application/dto/vault-context.dto';

export class OrganizationPromptBuilder {
  build(context: VaultContextDto): string {
    const notes = context.notes
      .map((note) => `- ${note.relativePath}${note.title ? ` | ${note.title}` : ''}`)
      .join('\n');

    return [
      'You are an organization planner for a Markdown vault.',
      `Vault root: ${context.vaultRoot}`,
      'Return a structured list of actions only inside the vault boundary.',
      'Notes:',
      notes || '- (no notes found)'
    ].join('\n');
  }
}
