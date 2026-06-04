export type OrionIntentClassification = 'product' | 'vault' | 'app-code' | 'ambiguous';

export interface OrionIntentRouteDto {
  readonly query: string;
  readonly classification: OrionIntentClassification;
  readonly reason: string;
  readonly nextCommand: string;
  readonly followUpCommands: readonly string[];
  readonly needsClarification: boolean;
  readonly clarificationPrompt?: string;
}

const productKeywords = [
  'app',
  'produto',
  'ferramenta',
  'projeto',
  'orion',
  'orion vault'
];

const vaultKeywords = [
  'vault',
  'nota',
  'notas',
  'agenda',
  'pasta',
  'pastas',
  'arquivo',
  'arquivos',
  'markdown',
  'wiki link',
  'backlink'
];

const appCodeKeywords = [
  'codigo',
  'código',
  'code',
  'codebase',
  'repositorio',
  'repositório',
  'fonte',
  'source',
  'implementacao',
  'implementação',
  'arquitetura do app'
];

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function includesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function quoteQuery(query: string): string {
  return query.replace(/"/g, '\\"');
}

export function routeOrionIntent(query: string): OrionIntentRouteDto {
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return {
      query,
      classification: 'ambiguous',
      reason: 'Sem uma pergunta concreta, a sessao nao consegue distinguir entre produto, vault ativo e codigo do app.',
      nextCommand: 'orion /product-context',
      followUpCommands: ['orion /product-context', 'orion /guide'],
      needsClarification: true,
      clarificationPrompt: 'Explique se voce quer entender o produto Orion Vault, o conteudo do vault ativo ou o codigo-fonte do app.'
    };
  }

  const mentionsProduct = includesAny(normalizedQuery, productKeywords);
  const mentionsVault = includesAny(normalizedQuery, vaultKeywords);
  const mentionsAppCode = includesAny(normalizedQuery, appCodeKeywords);

  if (mentionsAppCode && !mentionsVault) {
    return {
      query,
      classification: 'app-code',
      reason: 'A pergunta menciona codigo, repositorio ou implementacao, entao o alvo parece ser o codigo-fonte do Orion Vault, nao o vault ativo.',
      nextCommand: 'orion /product-context',
      followUpCommands: ['orion /product-context'],
      needsClarification: false
    };
  }

  if (mentionsVault && !mentionsProduct && !mentionsAppCode) {
    return {
      query,
      classification: 'vault',
      reason: 'A pergunta fala de notas, agenda, pastas ou do vault ativo, entao o alvo operacional parece ser o conteudo do usuario.',
      nextCommand: `orion /search --query "${quoteQuery(query)}"`,
      followUpCommands: [`orion /agent-context --query "${quoteQuery(query)}"`, 'orion /analyze-note --path <nota.md>'],
      needsClarification: false
    };
  }

  if (mentionsProduct && !mentionsVault && !mentionsAppCode) {
    return {
      query,
      classification: 'product',
      reason: 'A pergunta menciona o app, produto ou ferramenta sem sinal de nota especifica, entao o alvo parece ser o Orion Vault como produto.',
      nextCommand: 'orion /product-context',
      followUpCommands: ['orion /guide', 'orion /skills'],
      needsClarification: false
    };
  }

  if (mentionsProduct && mentionsVault) {
    return {
      query,
      classification: 'ambiguous',
      reason: 'A pergunta mistura sinais de produto e de vault ativo, entao a sessao precisa separar contexto do app e conteudo das notas antes de responder.',
      nextCommand: 'orion /product-context',
      followUpCommands: [`orion /search --query "${quoteQuery(query)}"`],
      needsClarification: true,
      clarificationPrompt: 'Diga se voce quer uma resposta sobre o produto Orion Vault ou sobre as notas e pastas do vault ativo.'
    };
  }

  return {
    query,
    classification: 'ambiguous',
    reason: 'A pergunta nao traz sinais suficientes para classificar com seguranca entre produto, vault ativo e codigo do app.',
    nextCommand: 'orion /product-context',
    followUpCommands: [`orion /search --query "${quoteQuery(query)}"`],
    needsClarification: true,
    clarificationPrompt: 'Reformule a pergunta dizendo se o foco e o produto, o vault ativo ou o codigo-fonte do Orion Vault.'
  };
}
