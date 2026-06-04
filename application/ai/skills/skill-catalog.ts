import {
  listOrionSkillFlows,
  listOrionSkills,
  type OrionSkillCategory,
  type OrionSkillDefinition,
  type OrionSkillFlowDefinition
} from './skill-registry';

const categoryLabels: Record<OrionSkillCategory, string> = {
  context: 'Contexto',
  planning: 'Planejamento',
  execution: 'Execucao Segura',
  maintenance: 'Manutencao'
};

const categoryDescriptions: Record<OrionSkillCategory, string> = {
  context: 'Skills para onboarding, leitura, busca e montagem de contexto.',
  planning: 'Skills para preview, plano e inspecao da intencao antes de mutacao.',
  execution: 'Recursos de escrita e execucao validada dentro do vault.',
  maintenance: 'Capacidades tecnicas e de diagnostico, separadas do fluxo normal de notas.'
};

const productName = 'Orion Vault';

export interface OrionSkillGroup {
  readonly category: OrionSkillCategory;
  readonly label: string;
  readonly description: string;
  readonly skills: readonly OrionSkillDefinition[];
}

export interface OrionSkillCatalogDto {
  readonly count: number;
  readonly skills: readonly OrionSkillDefinition[];
  readonly groups: readonly OrionSkillGroup[];
}

export interface OrionAiOnboardingDto {
  readonly commandLines: readonly string[];
  readonly statusText: string;
  readonly setupHintTemplate: string;
  readonly policyLines: readonly string[];
  readonly taskExamples: readonly { readonly intent: string; readonly command: string }[];
}

export interface OrionProductContextDto {
  readonly productName: string;
  readonly identity: string;
  readonly primarySurfaces: readonly string[];
  readonly sessionContract: readonly string[];
  readonly distinction: {
    readonly app: string;
    readonly vault: string;
    readonly appCode: string;
  };
  readonly whenUserAsksAboutTheApp: readonly string[];
  readonly recommendedCommands: readonly string[];
}

export { routeOrionIntent, type OrionIntentRouteDto } from './intent-routing';

function orderedCategories(): readonly OrionSkillCategory[] {
  return ['context', 'planning', 'execution', 'maintenance'];
}

export function groupOrionSkills(category?: string): readonly OrionSkillGroup[] {
  const skills = listOrionSkills(category);
  const byCategory = new Map<OrionSkillCategory, OrionSkillDefinition[]>();

  for (const skill of skills) {
    const current = byCategory.get(skill.category) ?? [];
    current.push(skill);
    byCategory.set(skill.category, current);
  }

  return orderedCategories()
    .filter((skillCategory) => (byCategory.get(skillCategory)?.length ?? 0) > 0)
    .map((skillCategory) => ({
      category: skillCategory,
      label: categoryLabels[skillCategory],
      description: categoryDescriptions[skillCategory],
      skills: byCategory.get(skillCategory) ?? []
    }));
}

export function buildOrionSkillCatalog(category?: string): OrionSkillCatalogDto {
  const skills = listOrionSkills(category);
  return {
    count: skills.length,
    skills,
    groups: groupOrionSkills(category)
  };
}

function formatInputs(skill: OrionSkillDefinition): string {
  return skill.inputs.length > 0 ? skill.inputs.join(', ') : '(none)';
}

function formatExamples(skill: OrionSkillDefinition): string {
  return skill.examples.join(' | ');
}

function formatDependencies(skill: OrionSkillDefinition): string {
  return skill.dependsOn.length > 0 ? skill.dependsOn.join(', ') : '(none)';
}

function buildSkillSection(group: OrionSkillGroup): string {
  const lines = [`## ${group.label}`, '', group.description, ''];

  for (const skill of group.skills) {
    lines.push(`### ${skill.id}`);
    lines.push(`- descricao: ${skill.description}`);
    lines.push(`- tipo: ${skill.kind}`);
    lines.push(`- quando usar: ${skill.whenToUse}`);
    lines.push(`- inputs: ${formatInputs(skill)}`);
    lines.push(`- output: ${skill.output}`);
    lines.push(`- muta vault: ${skill.mutatesVault ? 'sim' : 'nao'}`);
    lines.push(`- exige preview: ${skill.requiresPreview ? 'sim' : 'nao'}`);
    lines.push(`- dependencies: ${formatDependencies(skill)}`);
    lines.push(`- termina em: ${skill.completion}`);
    if (skill.examples.length > 0) {
      lines.push(`- exemplos: ${formatExamples(skill)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildFlowSection(flow: OrionSkillFlowDefinition): string {
  const lines = [`### ${flow.id}`, `- descricao: ${flow.description}`, `- steps: ${flow.steps.join(' -> ')}`];

  if (flow.notes.length > 0) {
    lines.push(`- notas: ${flow.notes.join(' | ')}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function buildOrionGuideMarkdown(): string {
  const groups = groupOrionSkills();
  const flows = listOrionSkillFlows();
  const onboarding = buildOrionAiOnboarding();

  return [
    '# Comandos da Aplicacao',
    '',
    `Este guia e gerado a partir do catalogo interno de skills e flows do ${productName}.`,
    '',
    '## Como a IA deve comecar',
    '- rode `orion /start` para a orientacao inicial',
    '- rode `orion /skills` para ver o catalogo de capabilities',
    '- rode `orion /flows` para ver sequencias recomendadas',
    '- priorize contexto e planejamento antes de execucao',
    ...onboarding.policyLines.map((line) => `- ${line}`),
    '',
    '## Exemplos por intencao',
    ...onboarding.taskExamples.map((item) => `- ${item.intent}: \`${item.command}\``),
    '',
    ...groups.map(buildSkillSection),
    '## Flows Recomendados',
    '',
    ...flows.map(buildFlowSection),
    '## Respostas estruturadas',
    '- `success`: comando executado com sucesso',
    '- `conflict`: o plano ou a escrita exigem revisao ou confirmacao',
    '- `noop`: nao havia mudancas validas para executar',
    '- `error`: houve falha de validacao ou execucao',
    ''
  ].join('\n');
}

export function buildOrionStartMarkdown(): string {
  const contextSkills = listOrionSkills('context');
  const planningSkills = listOrionSkills('planning');
  const executionSkills = listOrionSkills('execution');
  const defaultFlow = listOrionSkillFlows().find((flow) => flow.id === 'default-note-workflow');

  return [
    '# AI Start Here',
    '',
    `Este texto e gerado a partir do catalogo interno de skills e flows do ${productName}.`,
    '',
    `## O que e o ${productName}`,
    `${productName} e um app local-first de notas Markdown, adaptado para trabalho conjunto com IA e agentes dentro de um vault seguro.`,
    '',
    'Ele nao e um terminal generico nem um explorador livre do filesystem.',
    'Ele existe para ajudar IA e agentes a ler, buscar, planejar, editar e organizar notas usando contratos explicitos do produto.',
    '',
    'O app oferece uma ponte controlada entre IA e vault:',
    '- a IA consulta contexto do vault',
    '- a IA busca notas relacionadas',
    '- a IA gera plano e preview antes de escrever',
    '- a IA aplica mudancas usando os comandos do app',
    '- o app valida a fronteira do vault antes de executar escrita',
    '- a IA e os agentes trabalham sobre notas, agenda, relacoes e organizacao local',
    '',
    '## Como a IA deve agir',
    'Antes de executar qualquer tarefa:',
    '- rode `orion /guide` para ver o guia completo',
    '- rode `orion /product-context` quando a pergunta for sobre o app em si, e nao apenas sobre uma nota ou o vault atual',
    '- rode `orion /route-intent --query "<pergunta>"` quando quiser classificar explicitamente produto, vault ativo ou codigo do app',
    '- rode `orion /skills` para ver o catalogo estruturado',
    '- rode `orion /flows` para ver sequencias recomendadas',
    '- use os contratos do app como caminho principal',
    '- evite acesso direto a arquivos quando houver comando equivalente',
    '- nunca prefira filesystem direto se existir skill ou comando do Orion Vault para a tarefa',
    '- priorize contexto e planejamento antes de execucao',
    '',
    '## Skills principais',
    `- contexto: ${contextSkills.map((skill) => `\`${skill.id}\``).join(', ')}`,
    `- planejamento: ${planningSkills.map((skill) => `\`${skill.id}\``).join(', ')}`,
    `- execucao segura: ${executionSkills.map((skill) => `\`${skill.id}\``).join(', ')}`,
    '',
    '## Fluxo recomendado',
    defaultFlow ? `- ${defaultFlow.steps.join(' -> ')}` : '- start -> guide -> context -> preview -> apply',
    '- use `apply` somente com `previewId` validado',
    '',
    '## Escrita no vault',
    '- use `mkdir`, `touch`, `edit`, `rename` e `move` para escrita direta e objetiva',
    '- para textos grandes, prefira `--content-file` ou `--stdin`',
    '- mantenha tudo dentro do vault ativo',
    '',
    '## Resumo curto',
    'Primeiro rode `orion /start`. Se a pergunta estiver ambigua, rode `orion /route-intent --query "<pergunta>"`. Se for sobre o produto, rode `orion /product-context`. Depois leia contexto. Depois busque. Depois gere preview. So aplique quando houver confirmacao valida.',
    ''
  ].join('\n');
}

export function buildOrionProductContext(): OrionProductContextDto {
  return {
    productName,
    identity: 'Orion Vault e um app de notas local-first em Markdown, adaptado para uso com IA e agentes dentro de um vault seguro.',
    primarySurfaces: [
      'notas Markdown',
      'agenda',
      'relacoes entre notas',
      'busca e retrieval local',
      'organizacao preview-first',
      'workspace seguro dentro do vault'
    ],
    sessionContract: [
      'a sessao padrao nasce no vault ativo',
      'a IA deve tratar o vault como contexto primario',
      'comandos e skills do Orion Vault sao o caminho principal',
      'o fluxo normal nao deve assumir que o codigo-fonte do app esta no diretório atual'
    ],
    distinction: {
      app: 'o produto Orion Vault como ferramenta de notas orientada a IA e agentes',
      vault: 'o conteudo do usuario dentro do vault ativo, como notas, agenda e pastas',
      appCode: 'o repositorio e a implementacao interna do Orion Vault, separados do fluxo normal de notas'
    },
    whenUserAsksAboutTheApp: [
      'primeiro diferencie se o pedido e sobre o produto, sobre o conteudo do vault ou sobre o codigo do app',
      'se a sessao atual estiver no vault, nao conclua que o vault e o codigo-fonte do produto',
      'descreva o Orion Vault pelo contexto do produto antes de inferir arquitetura a partir do diretório atual',
      'so analise o codigo-fonte do app quando houver um fluxo explicito de manutencao ou contexto de repositorio disponivel'
    ],
    recommendedCommands: [
      'orion /start',
      'orion /route-intent --query "<pergunta>"',
      'orion /product-context',
      'orion /guide',
      'orion /skills',
      'orion /flows'
    ]
  };
}

export function buildOrionAiOnboarding(): OrionAiOnboardingDto {
  return {
    commandLines: [
      'orion /start',
      'orion /route-intent --query "o que voce quer descobrir?"',
      'orion /product-context',
      'orion /guide',
      'orion /skills',
      'orion /flows',
      'orion /context',
      'orion /search --query "arquitetura local"',
      'orion /analyze-note --path Estudos/Clean Architecture.md',
      'orion /prepare-edit-task --path Estudos/SDD.md --query "revisar resumo"',
      'orion /prepare-writing-task --path Estudos/SDD.md --query "resumo"',
      'orion /plan',
      'orion /preview',
      'orion /apply --preview-id <id>'
    ],
    statusText: 'Voce esta dentro do Orion Vault, um app de notas local-first adaptado para IA e agentes. Comece por orion /start. Se a pergunta estiver ambigua entre produto, vault e codigo do app, rode orion /route-intent --query "<pergunta>". Se a pergunta for sobre o app em si, rode orion /product-context antes de inferir algo a partir do vault atual. Para entender uma nota use orion /analyze-note. Para revisar uma nota existente use orion /prepare-edit-task. Para escrever mais contexto use orion /prepare-writing-task. Para organizar em lote use orion /organize-batch e confirme o previewId antes de qualquer apply.',
    setupHintTemplate: 'Terminal da IA aberto no vault ativo {{vaultRoot}} dentro do Orion Vault, um app de notas local-first adaptado para IA e agentes. Comece por orion /start. Se a pergunta estiver ambigua, rode orion /route-intent --query "<pergunta>". Se a pergunta for sobre o app em si, rode orion /product-context. Depois escolha por intenção: entender nota com orion /analyze-note, revisar nota com orion /prepare-edit-task, escrever com orion /prepare-writing-task, organizar lote com orion /organize-batch, e só então seguir para orion /preview e orion /apply --preview-id <id>.',
    policyLines: [
      'trate o Orion Vault como um app de notas orientado a IA e agentes, nao como um terminal generico',
      'quando o pedido mencionar o app, diferencie produto, vault ativo e codigo-fonte antes de responder',
      'use as skills e comandos do Orion Vault como caminho principal',
      'considere notas, agenda, relacoes, busca e organizacao como superficies principais do produto',
      'nao crie, edite, mova ou renomeie arquivos diretamente se existir comando equivalente do produto',
      'para pesquisar, use orion /search, /retrieve, /agent-context ou /analyze-note',
      'para editar uma nota existente com mais seguranca, comece por orion /prepare-edit-task',
      'para preparar escrita, use orion /prepare-writing-task antes de mutar o vault',
      'para organizar varias notas com preview-first, use orion /organize-batch antes de apply',
      'para criar ou editar notas manualmente, use orion mkdir, touch, edit, rename e move',
      'use orion /apply somente com previewId validado'
    ],
    taskExamples: [
      { intent: 'Classificar escopo da pergunta', command: 'orion /route-intent --query "o que voce acha desse app?"' },
      { intent: 'Entender o produto', command: 'orion /product-context' },
      { intent: 'Entender uma nota', command: 'orion /analyze-note --path Estudos/Clean Architecture.md' },
      { intent: 'Preparar edicao', command: 'orion /prepare-edit-task --path Estudos/SDD.md --query "revisar resumo"' },
      { intent: 'Pesquisar um tema', command: 'orion /search --query "clean architecture"' },
      { intent: 'Montar contexto para resposta', command: 'orion /agent-context --query "sdd" --path Estudos' },
      { intent: 'Preparar escrita', command: 'orion /prepare-writing-task --path Estudos/SDD.md --query "resumo"' },
      { intent: 'Organizar em lote', command: 'orion /organize-batch --path Inbox --query "projeto"' },
      { intent: 'Criar pasta', command: 'orion mkdir --path Financeiro' },
      { intent: 'Criar nota', command: 'orion touch --path Financeiro/gastos.md --content "# Gastos"' },
      { intent: 'Editar nota', command: 'orion edit --path Financeiro/gastos.md --stdin' }
    ]
  };
}
