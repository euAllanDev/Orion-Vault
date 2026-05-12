# Tasks

## Vault Setup
- [ ] Definir a página de fallback para o vault padrão
- [ ] Definir validação visual da raiz selecionada
- [x] Definir estados de vazio, carregando, válido e inválido
- [x] Registrar que o bootstrap automático do desktop usa o mesmo fluxo de `open` da interface
- [x] Registrar que ações de escrita ficam bloqueadas até o vault ativo concluir a abertura

## Vault Workspace
- [ ] Agrupar os comandos por intenção
- [ ] Definir cards, tabs ou seções para inspeção, planejamento e workspace
- [ ] Exibir previews, conflitos, no-ops e erros de forma clara
- [x] Registrar que a árvore deve refletir pastas vazias recém-criadas após o refresh
- [x] Registrar que diálogos internos mantêm apenas uma sessão ativa por vez

## Contratos
- [ ] Mapear a interface para os comandos existentes
- [ ] Garantir que `organize` permaneça preview-first no fluxo principal
- [ ] Garantir que as escritas passem por validação antes de executar

## Specs e documentação
- [ ] Manter a linguagem consistente com OpenSpec e SDD
- [ ] Atualizar o registry com a change e módulos relevantes
- [x] Registrar a interface de duas páginas como referência do protótipo

## Notes
- O caso real corrigido no desktop mostrou que um workspace visualmente montado ainda pode estar sem vault ativo pronto.
- O próximo agente deve tratar esse estado como `loading`, não como `ready`.
- O próximo agente também deve evitar qualquer reintrodução de listeners acumulados em diálogos internos da interface.
