# Participant Selection Evidence

## Motivo

Phase 6 tinha criação de sessão e validação server-side de `participantId`, mas nenhuma forma de selecionar participante na UI. Isto bloqueava evidência do fluxo opcional de `REQ-SESSION-001`.

## SourceRefs

- `orion:src_Q-nOQSmBtNdSJ7PlQ7l6cmHp`: requisitos de sessão e participante.
- `orion:src_z4ZETeH_D58mpmgxZrur5QZs`: relação opcional `Session -> Participant` e `Participant -> Project`.
- `orion:src_miuGxu8EakCaYD6gb4C07VV9`: contrato de sessões.
- `orion:src_ZcFT0ORTgioDSRQQyb3edyyd`: escopo e RBAC aplicados no servidor.

## Contrato

`GET /api/v1/projects/:projectId/participants` exige Auth.js e membership `VIEWER+`. O handler obtém `workspaceId` pela relação real do projeto, então IDs inexistentes e de outro workspace retornam o mesmo `403 { error: { code: "FORBIDDEN", message: "Access denied" } }`. Resposta: `[{ id, displayName, consentStatus }]`.

`POST /api/v1/projects/:projectId/sessions` continua validando `participantId` pelo mesmo `projectId` no repositório. Cliente não envia ou controla `workspaceId` nem role.

## Decisão UI

`ProjectWorkspace` usa `select` nativo opcional: `Sem participante` omite `participantId`; opções mostram nome e consentimento. Sem busca, filtros, paginação ou CRUD. Loading, erro e lista vazia possuem estados explícitos; em erro ainda é possível criar sem participante.

## Testes executados

- `npm run test:api` passou: endpoint autenticado, OWNER e VIEWER autorizados, sem membership, projeto cross-workspace e inexistente negados; criação rejeita participante de outro workspace.
- `npm run test:frontend` passou: lista participante por HTTP real, cria sessão com `participantId` e sem ele, e verifica código de carregamento/erro e payload opcional do seletor.
- `npm run db:validate`, `db:migrate`, `db:seed`, `test:integration`, `test:auth` e `test:rbac` passaram antes dos testes acima.

REQ-SESSION-001 permanece `PARCIAL`: E2E de navegador e critérios restantes do requisito não foram concluídos.
