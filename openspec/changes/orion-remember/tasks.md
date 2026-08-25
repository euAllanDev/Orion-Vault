# Tasks

## Especificacao
- [x] Definir contrato publico sem path, root ou operacao CRUD
- [x] Definir autorizacao explicita de escrita independente de leitura
- [x] Definir write target unico e regras multi-vault
- [x] Definir estados `noop`, `created`, `appended` e `conflict`
- [x] Definir dedupe, idempotencia e concorrencia conservadores
- [x] Definir cenarios A-L, invariantes, escopo e criterios de aceite

## Implementacao futura
- [ ] Adicionar configuracao validada de `ORION_WRITE_VAULT_ROOT`
- [ ] Criar use case de aplicacao e DTOs de remember
- [ ] Expor tool MCP e resposta estruturada
- [ ] Integrar autorizacao explicita na skill/Agent
- [ ] Implementar append com verificacao de conteudo-base
- [ ] Cobrir contrato, configuracao, dedupe, concorrencia e seguranca com testes
