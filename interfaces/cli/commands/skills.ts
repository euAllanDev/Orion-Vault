import { listOrionSkills, type OrionSkillDefinition } from '../../../application/ai/skills/skill-registry';

export interface SkillsCommandOptions {
  readonly category?: string;
  readonly format?: 'text' | 'json';
}

function presentText(skills: readonly OrionSkillDefinition[]): void {
  if (skills.length === 0) {
    console.log('No skills found for the requested category.');
    return;
  }

  console.log(`Skills: ${skills.length}`);
  for (const skill of skills) {
    console.log(`- ${skill.id} [${skill.category}]`);
    console.log(`  kind: ${skill.kind}`);
    console.log(`  description: ${skill.description}`);
    console.log(`  when: ${skill.whenToUse}`);
    console.log(`  mutates vault: ${skill.mutatesVault ? 'yes' : 'no'}`);
    console.log(`  requires preview: ${skill.requiresPreview ? 'yes' : 'no'}`);
    console.log(`  depends on: ${skill.dependsOn.length > 0 ? skill.dependsOn.join(', ') : '(none)'}`);
    console.log(`  completion: ${skill.completion}`);
    console.log(`  inputs: ${skill.inputs.length > 0 ? skill.inputs.join(', ') : '(none)'}`);
    console.log(`  output: ${skill.output}`);
    if (skill.examples.length > 0) {
      console.log(`  examples: ${skill.examples.join(' | ')}`);
    }
  }
}

export async function executeSkillsCommand(options: SkillsCommandOptions): Promise<void> {
  const skills = listOrionSkills(options.category);

  if (options.format === 'json') {
    console.log(JSON.stringify({ category: options.category?.trim() || null, count: skills.length, skills }, null, 2));
    return;
  }

  presentText(skills);
}
