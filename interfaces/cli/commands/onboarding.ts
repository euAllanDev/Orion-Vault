import { buildOrionAiOnboarding } from '../../../application/ai/skills/skill-catalog';

export interface OnboardingCommandOptions {
  readonly format?: 'text' | 'json';
}

export async function executeOnboardingCommand(options: OnboardingCommandOptions): Promise<void> {
  const onboarding = buildOrionAiOnboarding();

  if (options.format === 'json') {
    console.log(JSON.stringify(onboarding, null, 2));
    return;
  }

  console.log(onboarding.commandLines.join('\n'));
  console.log('');
  for (const line of onboarding.policyLines) {
    console.log(`- ${line}`);
  }
  console.log('');
  console.log(onboarding.statusText);
}
