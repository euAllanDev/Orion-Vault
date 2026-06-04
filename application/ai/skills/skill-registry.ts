export type OrionSkillCategory = 'context' | 'planning' | 'execution' | 'maintenance';
export type OrionSkillKind = 'primitive' | 'composed';
export type OrionSkillCompletion = 'read' | 'preview' | 'mutation';

export interface OrionSkillDefinition {
  readonly id: string;
  readonly category: OrionSkillCategory;
  readonly kind: OrionSkillKind;
  readonly description: string;
  readonly whenToUse: string;
  readonly inputs: readonly string[];
  readonly output: string;
  readonly mutatesVault: boolean;
  readonly requiresPreview: boolean;
  readonly dependsOn: readonly string[];
  readonly completion: OrionSkillCompletion;
  readonly examples: readonly string[];
}

export interface OrionSkillFlowDefinition {
  readonly id: string;
  readonly description: string;
  readonly steps: readonly string[];
  readonly notes: readonly string[];
}

export const orionSkills: readonly OrionSkillDefinition[] = [
  {
    id: 'start',
    category: 'context',
    kind: 'primitive',
    description: 'Abre a orientacao inicial da IA para o fluxo do produto.',
    whenToUse: 'Use no inicio da sessao para lembrar a estrategia principal.',
    inputs: [],
    output: 'Markdown curto com orientacao operacional.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion /start']
  },
  {
    id: 'guide',
    category: 'context',
    kind: 'primitive',
    description: 'Abre o guia completo de comandos e fluxo recomendado.',
    whenToUse: 'Use quando precisar rever os contratos disponiveis.',
    inputs: [],
    output: 'Markdown com catalogo e exemplos de uso.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion /guide']
  },
  {
    id: 'product-context',
    category: 'context',
    kind: 'primitive',
    description: 'Explica o que e o Orion Vault, distingue produto, vault e codigo do app, e orienta perguntas sobre o app.',
    whenToUse: 'Use quando a pergunta mencionar o app, o produto, a ferramenta ou quando houver ambiguidade entre vault e codigo-fonte.',
    inputs: [],
    output: 'Resumo estruturado do produto, superficies principais, fronteiras da sessao e proximo passo recomendado.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion /product-context']
  },
  {
    id: 'route-intent',
    category: 'context',
    kind: 'primitive',
    description: 'Classifica se a pergunta parece ser sobre produto, vault ativo, codigo do app ou se ainda esta ambigua.',
    whenToUse: 'Use quando a pergunta mencionar o app ou quando quiser decidir explicitamente entre contexto de produto, notas do vault e manutencao do codigo.',
    inputs: ['query'],
    output: 'Classificacao de intencao, motivo curto, proximo comando recomendado e necessidade de esclarecimento.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion /route-intent --query "o que voce acha desse app?"']
  },
  {
    id: 'context',
    category: 'context',
    kind: 'primitive',
    description: 'Carrega contexto estruturado do vault ou de uma nota foco.',
    whenToUse: 'Use antes de responder, editar ou planejar algo no vault.',
    inputs: ['path?'],
    output: 'Resumo do vault, nota foco, backlinks, related notes e chunks de apoio.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion /context', 'orion /context --path Architecture/clean.md']
  },
  {
    id: 'search',
    category: 'context',
    kind: 'primitive',
    description: 'Busca notas por consulta, frase, tag e escopo.',
    whenToUse: 'Use para ampliar contexto antes de decidir a proxima acao.',
    inputs: ['query?', 'phrase?', 'tags?', 'path?'],
    output: 'Lista de matches e chunks relevantes.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion /search --query "arquitetura local"', 'orion /search --tag architecture --path Architecture']
  },
  {
    id: 'retrieve',
    category: 'context',
    kind: 'primitive',
    description: 'Recupera um pacote enxuto de chunks relevantes para a task.',
    whenToUse: 'Use quando quiser reduzir leitura e custo de contexto.',
    inputs: ['query?', 'tags?', 'path?'],
    output: 'Chunks ranqueados com score, reasons e snippet.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion /retrieve --query "clean architecture" --path Architecture']
  },
  {
    id: 'agent-context',
    category: 'context',
    kind: 'primitive',
    description: 'Monta um pacote pronto para task com foco, chunks e relacionadas.',
    whenToUse: 'Use antes de uma task orientada a conhecimento ou execucao por agente.',
    inputs: ['query?', 'tags?', 'path?'],
    output: 'Resumo curto, nota foco, supporting chunks, related notes e budget.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion /agent-context --query "clean architecture" --path Architecture']
  },
  {
    id: 'related',
    category: 'context',
    kind: 'primitive',
    description: 'Lista notas relacionadas a uma nota foco.',
    whenToUse: 'Use para navegar relacoes antes de decidir o recorte da task.',
    inputs: ['path', 'limit?'],
    output: 'Lista de notas relacionadas com score.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion /related --path alpha.md --limit 5']
  },
  {
    id: 'analyze-note',
    category: 'context',
    kind: 'composed',
    description: 'Compõe leitura de contexto para entender rapidamente uma nota ou escopo.',
    whenToUse: 'Use quando precisar montar compreensão rápida antes de responder ou decidir próximos passos.',
    inputs: ['path?', 'query?'],
    output: 'Foco principal, resumo curto, supporting chunks, related notes e limites do contexto.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: ['context', 'related', 'agent-context'],
    completion: 'read',
    examples: ['orion /analyze-note --path alpha.md']
  },
  {
    id: 'prepare-writing-task',
    category: 'planning',
    kind: 'composed',
    description: 'Prepara contexto e próximo passo antes de escrita assistida ou resposta longa.',
    whenToUse: 'Use quando a task exige reunir contexto, lacunas e possíveis riscos antes de escrever.',
    inputs: ['path?', 'query?', 'tags?'],
    output: 'Foco da escrita, chunks principais, lacunas de contexto e próximo passo recomendado.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: ['context', 'agent-context', 'search', 'retrieve', 'preview'],
    completion: 'preview',
    examples: ['orion /prepare-writing-task --path alpha.md --query "draft summary"']
  },
  {
    id: 'prepare-edit-task',
    category: 'planning',
    kind: 'composed',
    description: 'Prepara contexto, riscos e próximos alvos antes de editar uma nota existente.',
    whenToUse: 'Use quando quiser revisar, expandir ou corrigir uma nota com mais contexto antes de editar.',
    inputs: ['path?', 'query?', 'tags?'],
    output: 'Foco da edição, supporting chunks, related notes, riscos e próximo passo recomendado.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: ['context', 'agent-context', 'retrieve', 'related'],
    completion: 'read',
    examples: ['orion /prepare-edit-task --path alpha.md --query "review summary"']
  },
  {
    id: 'plan',
    category: 'planning',
    kind: 'primitive',
    description: 'Gera um plano estruturado de organizacao sem mutar o vault.',
    whenToUse: 'Use para revisar a intencao da IA antes de qualquer escrita.',
    inputs: [],
    output: 'Preview estruturado com actions e previewId.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'preview',
    examples: ['orion /plan']
  },
  {
    id: 'preview',
    category: 'planning',
    kind: 'primitive',
    description: 'Alias operacional de preview do plano atual sem mutacao.',
    whenToUse: 'Use como passo final de validacao antes do apply.',
    inputs: [],
    output: 'Preview estruturado com actions e previewId.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'preview',
    examples: ['orion /preview']
  },
  {
    id: 'diff',
    category: 'planning',
    kind: 'primitive',
    description: 'Mostra diferencas relevantes do fluxo de organizacao.',
    whenToUse: 'Use quando precisar inspecionar a mudanca planejada ou recente.',
    inputs: [],
    output: 'Saida textual de diferencas.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'preview',
    examples: ['orion diff']
  },
  {
    id: 'organize-batch',
    category: 'execution',
    kind: 'composed',
    description: 'Encapsula o fluxo preview-first para organizar o vault ativo em lote com confirmação válida.',
    whenToUse: 'Use quando quiser gerar um preview de organização em lote antes de aplicar o plano no vault ativo.',
    inputs: ['path?', 'query?'],
    output: 'Preview estruturado com ações sugeridas, previewId, escopo opcional, query opcional e próximo passo para apply.',
    mutatesVault: true,
    requiresPreview: true,
    dependsOn: ['context', 'search', 'plan', 'preview', 'apply'],
    completion: 'mutation',
    examples: ['orion /organize-batch']
  },
  {
    id: 'apply',
    category: 'execution',
    kind: 'primitive',
    description: 'Executa somente um preview validado ou payload forcado.',
    whenToUse: 'Use apenas depois de revisar o previewId.',
    inputs: ['previewId?', 'force?'],
    output: 'Actions executadas, puladas, conflitos e previewId.',
    mutatesVault: true,
    requiresPreview: true,
    dependsOn: [],
    completion: 'mutation',
    examples: ['orion /apply --preview-id <id>']
  },
  {
    id: 'mkdir',
    category: 'execution',
    kind: 'primitive',
    description: 'Cria uma pasta dentro do vault ativo.',
    whenToUse: 'Use para escrita direta e objetiva no workspace.',
    inputs: ['path'],
    output: 'Confirmacao textual da pasta criada.',
    mutatesVault: true,
    requiresPreview: false,
    dependsOn: [],
    completion: 'mutation',
    examples: ['orion mkdir --path Projetos']
  },
  {
    id: 'touch',
    category: 'execution',
    kind: 'primitive',
    description: 'Cria uma nota Markdown dentro do vault ativo.',
    whenToUse: 'Use para criar notas novas com conteudo controlado.',
    inputs: ['path', 'content? | content-file? | stdin?'],
    output: 'Confirmacao textual do arquivo criado.',
    mutatesVault: true,
    requiresPreview: false,
    dependsOn: [],
    completion: 'mutation',
    examples: ['orion touch --path Projetos/minha-nota.md --content "# Minha nota"']
  },
  {
    id: 'edit',
    category: 'execution',
    kind: 'primitive',
    description: 'Substitui o conteudo de uma nota existente dentro do vault.',
    whenToUse: 'Use para escrita direta quando a tarefa nao depende de preview.',
    inputs: ['path', 'content? | content-file? | stdin?'],
    output: 'Confirmacao textual do arquivo editado.',
    mutatesVault: true,
    requiresPreview: false,
    dependsOn: [],
    completion: 'mutation',
    examples: ['orion edit --path Projetos/minha-nota.md --stdin']
  },
  {
    id: 'rename',
    category: 'execution',
    kind: 'primitive',
    description: 'Renomeia arquivo ou pasta dentro do vault.',
    whenToUse: 'Use para ajustes de nome mantendo a fronteira do vault.',
    inputs: ['source', 'destination'],
    output: 'Confirmacao textual da operacao.',
    mutatesVault: true,
    requiresPreview: false,
    dependsOn: [],
    completion: 'mutation',
    examples: ['orion rename --source Projetos/a.md --destination Projetos/b.md']
  },
  {
    id: 'move',
    category: 'execution',
    kind: 'primitive',
    description: 'Move arquivo ou pasta entre caminhos validos do vault.',
    whenToUse: 'Use para reorganizacao manual e objetiva.',
    inputs: ['source', 'destination'],
    output: 'Confirmacao textual da operacao.',
    mutatesVault: true,
    requiresPreview: false,
    dependsOn: [],
    completion: 'mutation',
    examples: ['orion move --source Projetos/a.md --destination Arquivo/a.md']
  },
  {
    id: 'maintenance-diagnose',
    category: 'maintenance',
    kind: 'composed',
    description: 'Compõe um pacote de leitura técnica para diagnosticar app e vault sem contaminar o fluxo normal de notas.',
    whenToUse: 'Use quando precisar investigar issues técnicas, fronteira do vault ou estado estrutural.',
    inputs: [],
    output: 'Resumo técnico, issues encontradas e ações de manutenção sugeridas.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: ['inspect', 'validate', 'scan', 'doctor'],
    completion: 'read',
    examples: ['orion /maintenance-diagnose']
  },
  {
    id: 'inspect',
    category: 'maintenance',
    kind: 'primitive',
    description: 'Inspeciona o estado estrutural do vault.',
    whenToUse: 'Use para diagnostico manual do workspace.',
    inputs: [],
    output: 'Resumo estrutural textual.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion inspect']
  },
  {
    id: 'validate',
    category: 'maintenance',
    kind: 'primitive',
    description: 'Valida a raiz e a fronteira operacional do vault.',
    whenToUse: 'Use antes de operacoes sensiveis ou diagnostico de ambiente.',
    inputs: [],
    output: 'Resultado textual de validacao.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion validate']
  },
  {
    id: 'scan',
    category: 'maintenance',
    kind: 'primitive',
    description: 'Escaneia o vault e consolida informacoes estruturais.',
    whenToUse: 'Use para inventario local e verificacao de estado.',
    inputs: [],
    output: 'Saida textual de scan.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion scan']
  },
  {
    id: 'doctor',
    category: 'maintenance',
    kind: 'primitive',
    description: 'Roda um diagnostico local de saude do ambiente.',
    whenToUse: 'Use quando o comportamento do app ou do vault parecer inconsistente.',
    inputs: [],
    output: 'Relatorio textual de diagnostico.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion doctor']
  },
  {
    id: 'sync',
    category: 'maintenance',
    kind: 'primitive',
    description: 'Executa fluxo tecnico de sincronizacao do registry.',
    whenToUse: 'Use em manutencao interna do app.',
    inputs: [],
    output: 'Confirmacao textual de sincronizacao.',
    mutatesVault: false,
    requiresPreview: false,
    dependsOn: [],
    completion: 'read',
    examples: ['orion sync']
  }
];

export const orionSkillFlows: readonly OrionSkillFlowDefinition[] = [
  {
    id: 'default-note-workflow',
    description: 'Fluxo padrao para operar sobre notas com contexto, planejamento e execucao segura.',
    steps: ['start', 'guide', 'context', 'search | retrieve | agent-context', 'plan | preview', 'apply'],
    notes: ['Priorize leitura antes de mutacao.', 'Use apply somente com previewId validado.']
  },
  {
    id: 'knowledge-task-workflow',
    description: 'Fluxo enxuto para tasks orientadas a conhecimento ou resposta de agente.',
    steps: ['start', 'agent-template', 'agent-context', 'related'],
    notes: ['Use quando a tarefa pede resposta ou analise com menos ruido.', 'Evite carregar o vault inteiro sem necessidade.']
  },
  {
    id: 'direct-write-workflow',
    description: 'Fluxo para escrita manual objetiva dentro do vault ativo.',
    steps: ['context', 'mkdir | touch | edit | rename | move'],
    notes: ['Prefira content-file ou stdin para textos longos.', 'Mantenha caminhos dentro do vault ativo.']
  },
  {
    id: 'analyze-note-workflow',
    description: 'Fluxo composto para entendimento rápido de nota ou escopo.',
    steps: ['analyze-note', 'context', 'related', 'agent-context'],
    notes: ['Termina em leitura.', 'Use antes de escrever, responder ou planejar.']
  },
  {
    id: 'prepare-writing-task-workflow',
    description: 'Fluxo composto para preparar escrita assistida ou resposta longa.',
    steps: ['prepare-writing-task', 'context | agent-context', 'search | retrieve', 'preview?'],
    notes: ['Use preview apenas quando a task realmente envolver mutação.', 'Explicita lacunas antes de escrever.']
  },
  {
    id: 'prepare-edit-task-workflow',
    description: 'Fluxo composto para preparar edição segura de nota existente.',
    steps: ['prepare-edit-task', 'context | agent-context', 'retrieve | related', 'edit'],
    notes: ['Termina em leitura orientada para edição.', 'Ajuda a decidir se já vale editar ou se ainda falta contexto.']
  },
  {
    id: 'organize-batch-workflow',
    description: 'Fluxo composto para organização em lote com preview-first.',
    steps: ['organize-batch', 'context', 'plan | preview', 'apply'],
    notes: ['Exige confirmação válida antes de mutação.', 'Preserva o fluxo preview-first.']
  },
  {
    id: 'maintenance-diagnose-workflow',
    description: 'Fluxo composto separado para diagnóstico técnico de app e vault.',
    steps: ['maintenance-diagnose', 'inspect', 'validate', 'scan', 'doctor'],
    notes: ['Aparece separado do fluxo normal de notas.', 'Termina em leitura técnica.']
  }
];

export function listOrionSkills(category?: string): readonly OrionSkillDefinition[] {
  const normalizedCategory = category?.trim().toLowerCase() as OrionSkillCategory | undefined;
  if (!normalizedCategory) {
    return orionSkills;
  }

  return orionSkills.filter((skill) => skill.category === normalizedCategory);
}

export function listOrionSkillFlows(): readonly OrionSkillFlowDefinition[] {
  return orionSkillFlows;
}
