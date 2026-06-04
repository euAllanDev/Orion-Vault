import { buildOrionProductContext, type OrionProductContextDto } from '../../../application/ai/skills/skill-catalog';

export interface ProductContextCommandOptions {
  readonly format?: 'text' | 'json';
}

function presentText(context: OrionProductContextDto): void {
  console.log(context.identity);
  console.log('');
  console.log('Superficies principais:');
  for (const item of context.primarySurfaces) {
    console.log(`- ${item}`);
  }
  console.log('');
  console.log('Contrato da sessao:');
  for (const item of context.sessionContract) {
    console.log(`- ${item}`);
  }
  console.log('');
  console.log('Diferencas importantes:');
  console.log(`- app: ${context.distinction.app}`);
  console.log(`- vault: ${context.distinction.vault}`);
  console.log(`- codigo do app: ${context.distinction.appCode}`);
  console.log('');
  console.log('Quando a pergunta for sobre o app:');
  for (const item of context.whenUserAsksAboutTheApp) {
    console.log(`- ${item}`);
  }
  console.log('');
  console.log('Comandos recomendados:');
  for (const item of context.recommendedCommands) {
    console.log(`- ${item}`);
  }
}

export async function executeProductContextCommand(options: ProductContextCommandOptions): Promise<void> {
  const context = buildOrionProductContext();

  if (options.format === 'json') {
    console.log(JSON.stringify(context, null, 2));
    return;
  }

  presentText(context);
}
