# Design

## Visão geral
A ponte de IA via CLI é um fluxo local que conversa com o vault usando os mesmos contratos já existentes no projeto.

## Fluxo exato
1. A IA pede contexto com `/context` ou `/inspect`.
2. O sistema retorna vault, nota ativa, backlinks, sumário e caminhos relevantes.
3. A IA chama `/search` para ampliar o conjunto de notas candidatas.
4. A IA gera um plano com `/plan`, `/preview` ou `/organize` em modo preview.
5. O sistema apresenta o preview e não muta o vault nessa etapa.
6. Se a IA solicitar escrita com `/apply`, o sistema valida o destino e a fronteira do vault.
7. Somente então os comandos de `/mkdir`, `/touch`, `/edit`, `/rename` ou `/move` são executados.
8. O resultado retorna para a IA como sucesso, conflito, no-op ou erro.

## Contratos reutilizados
- `/context`
- `/inspect`
- `/search`
- `/plan`
- `/preview`
- `/organize`
- `/apply`
- `/mkdir`
- `/touch`
- `/edit`
- `/rename`
- `/move`

## Regras
- a IA não fala direto com o filesystem
- a IA só atua através dos contratos do produto
- qualquer mutação passa por validação de segurança
- o preview deve ser legível e determinístico
- o fluxo deve ser local-first e opcional

## Alternativas consideradas
### API nova para IA
Adiada. Aumenta superfície sem necessidade imediata.

### Integração remota com agente
Rejeitada. Contraria o objetivo local-first.

### Reimplementar contratos específicos para IA
Rejeitada. Duplicaria regras já existentes.
