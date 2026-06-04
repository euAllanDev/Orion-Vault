import { routeOrionIntent, type OrionIntentRouteDto } from '../../../application/ai/skills/intent-routing';

export interface RouteIntentCommandOptions {
  readonly query?: string;
  readonly format?: 'text' | 'json';
}

function presentText(route: OrionIntentRouteDto): void {
  console.log(`Classification: ${route.classification}`);
  console.log(`Reason: ${route.reason}`);
  console.log(`Next: ${route.nextCommand}`);

  if (route.followUpCommands.length > 0) {
    console.log('Follow-up:');
    for (const command of route.followUpCommands) {
      console.log(`- ${command}`);
    }
  }

  if (route.clarificationPrompt) {
    console.log(`Clarify: ${route.clarificationPrompt}`);
  }
}

export async function executeRouteIntentCommand(options: RouteIntentCommandOptions): Promise<void> {
  const route = routeOrionIntent(options.query?.trim() ?? '');

  if (options.format === 'json') {
    console.log(JSON.stringify(route, null, 2));
    return;
  }

  presentText(route);
}
