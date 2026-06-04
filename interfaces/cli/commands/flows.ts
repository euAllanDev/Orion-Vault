import { listOrionSkillFlows, type OrionSkillFlowDefinition } from '../../../application/ai/skills/skill-registry';

export interface FlowsCommandOptions {
  readonly format?: 'text' | 'json';
}

function presentText(flows: readonly OrionSkillFlowDefinition[]): void {
  console.log(`Flows: ${flows.length}`);
  for (const flow of flows) {
    console.log(`- ${flow.id}`);
    console.log(`  description: ${flow.description}`);
    console.log(`  steps: ${flow.steps.join(' -> ')}`);
    if (flow.notes.length > 0) {
      console.log(`  notes: ${flow.notes.join(' | ')}`);
    }
  }
}

export async function executeFlowsCommand(options: FlowsCommandOptions): Promise<void> {
  const flows = listOrionSkillFlows();

  if (options.format === 'json') {
    console.log(JSON.stringify({ count: flows.length, flows }, null, 2));
    return;
  }

  presentText(flows);
}
