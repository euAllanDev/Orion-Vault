# Tasks

## Domain
- [x] Definir os conceitos de `Vault`, `Note`, `Action`, `AIResponse` e `Command`
- [x] Formalizar invariantes de fronteira do vault
- [x] Definir tipos de ações permitidas para organização
- [x] Especificar o modelo de plano de organização

## Application
- [x] Implementar o caso de uso de coleta de contexto do vault
- [x] Implementar o caso de uso de solicitação de plano à IA
- [x] Implementar validação do retorno estruturado da IA
- [x] Implementar a orquestração `observe -> plan -> preview`
- [x] Implementar modo `dry-run` no fluxo principal
- [x] Definir políticas de falha e interrupção segura

## Infra
- [x] Implementar leitura segura de arquivos Markdown no vault
- [x] Implementar integração com provedor de IA por contrato estruturado
- [x] Implementar planner local determinístico
- [x] Implementar relatórios de preview com validação de fronteira
- [x] Implementar resolução canônica de caminhos e prevenção de escape
- [x] Implementar detecção de conflitos de destino

## CLI
- [x] Adicionar comando `organize`
- [x] Adicionar comando `validate`
- [x] Suportar flag `--dry-run`
- [x] Exibir resumo do plano gerado
- [x] Exibir ações sugeridas ou bloqueadas
- [ ] Exibir relatório final com erros, conflitos e no-ops de forma mais auditável

## Specs e validação
- [x] Definir cenários Given/When/Then do comando `organize`
- [x] Definir cenários de rejeição para ações inválidas
- [x] Definir cenários de segurança para operações fora do vault
- [x] Definir cenários de `dry-run` sem mutação
- [x] Definir critérios de idempotência e conflito

## Qualidade
- [x] Revisar consistência dos termos de domínio entre proposal, design e specs
- [x] Garantir que os artefatos não misturem implementação com comportamento
- [x] Verificar que todos os erros relevantes básicos estão cobertos por cenário

## Fluxo preview-first
- [x] Definir o fluxo `observe -> plan -> preview`
- [x] Tornar explícito que `dry-run` não muta o filesystem
- [x] Permitir execução real apenas fora de `dry-run` e após validação
- [ ] Cobrir relatório de conflitos e no-ops com exemplos mais detalhados

## MVP real do vault
- [x] Criar pasta
- [x] Criar arquivo `.md`
- [x] Editar conteúdo da nota
- [x] Renomear pasta/arquivo
- [x] Mover nota entre pastas
- [x] Preservar leitura + validação como base de segurança

## Refinamento futuro
- [ ] Implementar roots semânticos como preview e contexto de IA
- [ ] Integrar roots ao dashboard com proximidade visual por cor
- [ ] Estruturar códigos de erro por categoria
- [ ] Adicionar mensagens de recuperação orientadas ao usuário
- [ ] Cobrir stack de integrações externas com handling específico
